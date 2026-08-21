# NestJS와 PostgreSQL(TypeORM) 연결 학습 가이드

이 문서는 이 프로젝트의 NestJS 애플리케이션이 PostgreSQL과 어떻게 연결되고, TypeORM으로 테이블과 코드를 어떻게 이어 붙이는지 학습하기 위한 가이드입니다. AWS RDS for PostgreSQL 연결과 운영 migration 흐름도 함께 다루지만, 먼저 현재 코드에서 요청이 데이터베이스까지 이동하는 구조를 이해하는 데 초점을 둡니다.

## 1. 큰 흐름 먼저 보기

현재 프로젝트의 DB 흐름은 다음 순서로 읽으면 가장 이해하기 쉽습니다.

```text
ConfigModule
  -> TypeOrmModule.forRootAsync
  -> createDatabaseOptions
  -> Entity
  -> TypeOrmModule.forFeature
  -> @InjectRepository
  -> Service
  -> PostgreSQL
```

역할을 한 문장씩 나누면 다음과 같습니다.

- `ConfigModule`: `.env`와 배포 환경변수를 읽고 검증합니다.
- `TypeOrmModule.forRootAsync`: NestJS 앱이 TypeORM DB 연결을 만들도록 설정합니다.
- `createDatabaseOptions`: 앱 실행과 migration CLI가 같은 DB 옵션을 공유하게 합니다.
- `Entity`: TypeScript class로 PostgreSQL 테이블 구조를 표현합니다.
- `TypeOrmModule.forFeature`: 특정 module에서 사용할 repository를 등록합니다.
- `@InjectRepository`: service에 TypeORM repository를 주입합니다.
- `Service`: repository를 사용해 생성, 조회, 수정, 삭제 로직을 수행합니다.
- `Migration`: entity 변경을 운영 DB에 안전하게 반영하는 스키마 변경 이력입니다.

이 프로젝트에서는 PostgreSQL 드라이버로 `pg`, NestJS 연동으로 `@nestjs/typeorm`, ORM으로 `typeorm`을 사용합니다.

## 2. 현재 프로젝트의 DB 대상

현재 migration은 네 개의 주요 테이블을 만듭니다.

```text
NestJS API
  -> PostgreSQL
       users
       track
       playlist
       playlist_track
```

| Entity          | PostgreSQL table | 역할                              | 주요 포인트                                   |
| --------------- | ---------------- | --------------------------------- | --------------------------------------------- |
| `User`          | `users`          | 로컬 회원과 Google 소셜 회원 저장 | `username` unique, `googleId` nullable unique |
| `Track`         | `track`          | 음악 트랙 저장                    | `title`, `artist`, `bpm`, `lengthSec`         |
| `Playlist`      | `playlist`       | 플레이리스트 저장                 | `playDate`, `description` nullable            |
| `PlaylistTrack` | `playlist_track` | playlist와 track의 관계 저장      | `playlistId`, `trackId`, `seq`, `note`        |

`playlist_track`는 playlist와 track을 연결하는 관계 테이블입니다. playlist 또는 track이 삭제되면 연결 row도 함께 삭제되도록 foreign key에 `CASCADE` 정책이 들어갑니다.

## 3. 설정값이 DB 연결로 바뀌는 과정

앱 시작점은 `src/main.ts`이고, DB 연결 조립은 `src/app.module.ts`에서 시작합니다.

`AppModule`은 `ConfigModule.forRoot(...)`로 환경변수를 먼저 읽습니다. 이때 `src/config/app-env.ts`의 `validateAppEnv`가 실행되어 잘못된 설정을 초기에 차단합니다.

중요한 검증 규칙은 다음입니다.

- `DB_TYPE`은 `postgres`만 허용합니다.
- `DB_PORT`는 숫자로 파싱합니다.
- `DB_SYNCHRONIZE`, `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`는 boolean으로 파싱합니다.
- `NODE_ENV=production`에서는 `DB_SYNCHRONIZE=true`를 차단합니다.

그다음 `TypeOrmModule.forRootAsync(...)`가 `ConfigService`에서 DB 설정을 읽어 `createDatabaseOptions(...)`에 전달합니다.

```ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) =>
    createDatabaseOptions({
      DB_HOST: configService.get<string>('DB_HOST', 'localhost'),
      DB_PORT: configService.get<number>('DB_PORT', 5432),
      DB_USERNAME: configService.get<string>('DB_USERNAME', 'postgres'),
      DB_PASSWORD: configService.get<string>('DB_PASSWORD', 'password'),
      DB_DATABASE: configService.get<string>('DB_DATABASE', 'nestjs_db'),
      DATABASE_URL: configService.get<string>('DATABASE_URL'),
      DB_SYNCHRONIZE: configService.get<boolean>('DB_SYNCHRONIZE', false),
      DB_SSL: configService.get<boolean>('DB_SSL', false),
      DB_SSL_REJECT_UNAUTHORIZED: configService.get<boolean>(
        'DB_SSL_REJECT_UNAUTHORIZED',
        true,
      ),
    }),
  inject: [ConfigService],
});
```

학습 포인트는 `process.env`를 service에서 직접 읽지 않는다는 점입니다. 설정은 앱 시작 시 검증하고, 검증된 값을 NestJS DI 흐름으로 전달합니다.

## 4. `createDatabaseOptions`가 하는 일

`src/database/database-options.ts`는 앱 실행과 migration CLI가 공유하는 DB 설정 함수입니다.

이 파일의 핵심 책임은 다음입니다.

- TypeORM 연결 타입을 `postgres`로 고정합니다.
- `DATABASE_URL`이 있으면 `DB_HOST`, `DB_PORT`보다 우선 사용합니다.
- 사용할 entity 목록을 한 곳에서 관리합니다.
- migration 경로 기본값을 지정합니다.
- `DB_SYNCHRONIZE`, SSL, logging 옵션을 TypeORM 형식으로 변환합니다.

```ts
export const databaseEntities = [User, Track, Playlist, PlaylistTrack];
```

entity를 새로 추가하면 이 목록에 포함되어야 앱 실행 시 TypeORM이 해당 entity를 알 수 있습니다. module 내부에서 repository를 쓰려면 별도로 `TypeOrmModule.forFeature([...])`에도 등록해야 합니다.

## 5. Entity는 테이블의 코드 표현이다

TypeORM entity는 PostgreSQL table을 TypeScript class로 표현합니다.

예를 들어 `src/users/entities/user.entity.ts`는 `users` 테이블과 연결됩니다.

```ts
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ nullable: true })
  password: string | null;
}
```

여기서 decorator는 DB 스키마 의미를 가집니다.

| Decorator                     | 의미                             |
| ----------------------------- | -------------------------------- |
| `@Entity('users')`            | 이 class를 `users` 테이블에 매핑 |
| `@PrimaryGeneratedColumn()`   | 자동 증가 primary key            |
| `@Column({ unique: true })`   | unique 제약이 있는 컬럼          |
| `@Column({ nullable: true })` | `NULL`을 허용하는 컬럼           |
| `@CreateDateColumn()`         | 생성 시각 자동 저장              |
| `@UpdateDateColumn()`         | 수정 시각 자동 저장              |

중요한 점은 entity는 "DB 구조의 코드 표현"이고 DTO는 "HTTP 요청/응답의 계약"이라는 점입니다. 예를 들어 `CreateUserDto`는 회원가입 요청 body를 검증하고, `User` entity는 저장될 DB row의 형태를 표현합니다.

## 6. 관계 매핑: playlist와 track

음악 도메인에서는 playlist와 track이 다대다에 가까운 관계를 가집니다. 이 프로젝트는 중간 테이블인 `playlist_track`를 별도 entity로 둡니다. 이유는 단순 연결뿐 아니라 재생 순서 `seq`와 메모 `note`도 함께 저장해야 하기 때문입니다.

`PlaylistTrack`의 핵심 관계는 다음입니다.

```ts
@ManyToOne(() => Playlist, (playlist) => playlist.playlistTracks, {
  onDelete: 'CASCADE',
})
playlist: Playlist;

@ManyToOne(() => Track, (track) => track.playlistTracks, {
  onDelete: 'CASCADE',
})
track: Track;
```

이 관계는 PostgreSQL에서는 foreign key로 표현됩니다.

```text
playlist_track.playlistId -> playlist.id
playlist_track.trackId    -> track.id
```

`onDelete: 'CASCADE'`는 부모 row가 삭제될 때 연결 row도 함께 삭제한다는 뜻입니다. 예를 들어 playlist를 삭제하면 그 playlist에 속한 `playlist_track` row도 같이 정리됩니다.

## 7. Module에서 repository 등록하기

entity를 service에서 사용하려면 module에 repository를 등록해야 합니다.

`src/users/users.module.ts`는 `User` repository를 등록합니다.

```ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

`src/music/music.module.ts`는 세 entity의 repository를 등록합니다.

```ts
TypeOrmModule.forFeature([Track, Playlist, PlaylistTrack]);
```

`forRootAsync`가 애플리케이션 전체 DB 연결을 만든다면, `forFeature`는 특정 feature module 안에서 사용할 repository provider를 등록한다고 이해하면 됩니다.

## 8. Service에서 repository 사용하기

repository는 service에 주입해서 사용합니다.

`src/users/users.service.ts`의 예시는 다음 흐름입니다.

```ts
constructor(
  @InjectRepository(User)
  private usersRepository: Repository<User>,
) {}
```

이후 service method에서 repository를 사용합니다.

- `findOne({ where: { username } })`: 조건으로 한 row를 조회합니다.
- `create(dto)`: entity instance를 만듭니다. 아직 DB에 저장되지는 않습니다.
- `save(user)`: insert 또는 update SQL을 실행합니다.
- `remove(entity)`: delete SQL을 실행합니다.

예를 들어 회원가입 흐름은 다음처럼 읽을 수 있습니다.

```text
UsersController
  -> UsersService.create
       -> usersRepository.findOne(username 중복 확인)
       -> bcrypt.hash(password)
       -> usersRepository.create(...)
       -> usersRepository.save(...)
  -> PostgreSQL users table
```

Google 로그인 흐름에서도 같은 `users` 테이블을 사용합니다. 다만 password는 `null`이고, `provider`, `googleId`, `email`, `name` 값을 저장합니다.

## 9. QueryBuilder로 검색 조건 만들기

단순 조회는 `find`, `findOne`으로 충분하지만 검색, 범위 조건, 정렬, 페이지네이션이 섞이면 QueryBuilder가 더 읽기 좋습니다.

`src/music/services/tracks.service.ts`는 track 목록 조회에서 QueryBuilder를 사용합니다.

```ts
const qb = this.trackRepo.createQueryBuilder('track');

if (search) {
  qb.andWhere('(track.title ILIKE :search OR track.artist ILIKE :search)', {
    search: `%${search}%`,
  });
}

qb.orderBy(`track.${sortBy}`, sortOrder)
  .skip((page - 1) * limit)
  .take(limit);

const [items, total] = await qb.getManyAndCount();
```

여기서 `ILIKE`는 PostgreSQL의 대소문자 구분 없는 검색 연산자입니다. TypeORM이 SQL 문자열과 parameter binding을 함께 처리하므로, 사용자가 입력한 검색어를 문자열로 직접 이어 붙이는 방식보다 안전합니다.

## 10. Migration이 필요한 이유

개발 중에는 `DB_SYNCHRONIZE=true`로 entity 변경을 DB에 자동 반영할 수 있지만, 공유 DB와 운영 DB에서는 위험합니다. 컬럼 삭제, 타입 변경, 관계 변경이 의도치 않게 적용될 수 있기 때문입니다.

그래서 이 프로젝트는 기본적으로 다음 원칙을 사용합니다.

- 로컬 실험을 제외하면 `DB_SYNCHRONIZE=false`를 유지합니다.
- 스키마 변경은 TypeORM migration으로 기록합니다.
- 배포 전에 migration을 먼저 실행한 뒤 애플리케이션을 띄웁니다.

현재 초기 migration은 `src/database/migrations/1760000000000-CreateInitialSchema.ts`입니다. 이 migration은 `users`, `track`, `playlist`, `playlist_track` 테이블과 foreign key를 생성합니다.

```bash
npm run migration:show
npm run migration:run
```

새 entity 변경을 migration으로 만들 때는 개발 DB에서 다음을 실행합니다.

```bash
npm run migration:generate -- src/database/migrations/AddNewChange
npm run migration:run
```

migration CLI는 `src/database/data-source.ts`를 사용합니다. 이 파일도 `createDatabaseOptions`를 호출하므로 앱 실행과 CLI 실행이 같은 DB 옵션 생성 로직을 공유합니다.

## 11. RDS에서 준비할 값

AWS RDS for PostgreSQL을 사용할 때는 RDS 콘솔에서 다음 값을 준비합니다.

| 값                  | 설명                        | 프로젝트 변수 |
| ------------------- | --------------------------- | ------------- |
| Endpoint            | RDS 호스트 이름             | `DB_HOST`     |
| Port                | 기본 PostgreSQL 포트는 5432 | `DB_PORT`     |
| Master/app username | 애플리케이션용 DB 사용자    | `DB_USERNAME` |
| Password            | DB 사용자 비밀번호          | `DB_PASSWORD` |
| Initial database    | 사용할 데이터베이스 이름    | `DB_DATABASE` |

애플리케이션을 실행하는 서버가 RDS에 접근할 수 있어야 합니다. RDS 보안 그룹의 인바운드 규칙은 `0.0.0.0/0` 대신 애플리케이션 서버의 보안 그룹 또는 고정된 운영 IP만 허용하세요. 가능하면 RDS는 private subnet에 두고 애플리케이션도 같은 VPC에서 실행합니다.

## 12. 환경변수 설정

`.env.example`을 복사해 `.env`를 만들고 실제 DB 값을 입력합니다.

```bash
cp .env.example .env
```

로컬 PostgreSQL 예시는 다음과 같습니다.

```env
NODE_ENV=development
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=nestjs_db
DB_SYNCHRONIZE=false
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
```

로컬 장비 사양이 낮거나 Docker Desktop을 항상 켜두기 어렵다면, 로컬 PostgreSQL은 보조 경로로만 사용해도 됩니다. 이 경우 RDS 접근이 가능한 네트워크에서 `.env`의 `DB_HOST`를 RDS endpoint로 바꾸고 같은 migration 명령을 사용합니다.

RDS 운영 환경 예시는 다음과 같습니다.

```env
NODE_ENV=production
DB_TYPE=postgres
DB_HOST=<rds-endpoint>
DB_PORT=5432
DB_USERNAME=app_user
DB_PASSWORD=<Secrets Manager에서 주입>
DB_DATABASE=nestjs_db
DB_SYNCHRONIZE=false
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA=/app/config/rds-ca-bundle.pem
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_CONNECT_TIMEOUT_MS=5000
```

`DB_HOST`에는 프로젝트 밖에서 전달받은 RDS endpoint를 넣습니다. endpoint 자체가 비밀번호는 아니지만 인프라 식별자이므로 `.env`, EC2 shell, PM2 환경변수처럼 Git에서 제외되는 위치에서 관리합니다. `DB_PASSWORD`, `JWT_SECRET`, Google secret은 Git에 커밋하지 않습니다. 운영에서는 AWS Secrets Manager 또는 Parameter Store에서 배포 환경변수로 주입하는 방식을 권장합니다.

### DB_*와 DATABASE_URL

이 프로젝트는 현재 코드와 AWS secret 관리에 맞춰 `DB_*` 방식을 기본으로 사용합니다.

- `DB_*`: 각 값을 독립적으로 관리하므로 Secret Manager에서 일부 값만 교체하기 쉽습니다.
- `DATABASE_URL`: Heroku, Render, 일부 CI/CD 서비스처럼 connection string 하나를 제공하는 플랫폼에 편리합니다.

`DATABASE_URL`을 설정하면 `DB_*`보다 우선합니다.

```env
DATABASE_URL=postgresql://app_user:비밀번호@my-db.example.com:5432/nestjs_db
```

비밀번호에 `@`, `:`, `/`, `#` 같은 문자가 있으면 URL encoding이 필요합니다. 이 문제가 걱정되거나 AWS secret을 항목별로 관리한다면 `DB_*` 방식을 사용하세요.

### Secrets Manager helper

이 프로젝트에는 EC2/PM2 수동 배포를 돕기 위한 helper가 있습니다.

```bash
eval "$(AWS_SECRET_ID=<secret-id> AWS_REGION=ap-northeast-2 npm run -s secrets:export)"
```

지원하는 SecretString 형식은 세 가지입니다.

```json
{
  "DB_PASSWORD": "...",
  "JWT_SECRET": "...",
  "GOOGLE_OAUTH_CLIENT_SECRET": "..."
}
```

```json
{
  "username": "app_user",
  "password": "...",
  "host": "...",
  "port": 5432,
  "dbname": "nestjs_db"
}
```

```text
password-only-secret
```

첫 번째 형식은 앱 환경변수명과 secret 키를 일치시키므로 작은 프로젝트에서 단순합니다. 두 번째 형식은 RDS managed secret과 password rotation에 잘 맞지만 `password`를 `DB_PASSWORD`로 바꾸는 매핑이 필요합니다. 세 번째 형식은 DB password 하나만 관리할 때 가장 작지만 JWT/OAuth secret은 별도 관리해야 합니다. 운영에서는 DB secret과 app secret을 분리하고, 필요한 경우 같은 shell에서 helper를 여러 번 실행해 환경변수를 합칩니다.

## 13. SSL 설정

AWS RDS와 애플리케이션 사이의 전송 구간을 암호화하려면 다음을 사용합니다.

```env
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

- `DB_SSL=true`: PostgreSQL TLS 연결을 사용합니다.
- `DB_SSL_REJECT_UNAUTHORIZED=true`: 서버 인증서를 검증합니다.
- `DB_SSL_CA`: RDS CA 번들 파일 경로입니다. 운영에서 인증서 검증을 켜는 경우 런타임이 이 파일을 읽을 수 있어야 합니다.
- `DB_POOL_MIN`, `DB_POOL_MAX`: `pg` 풀 최소/최대 연결 수입니다. EC2 인스턴스 수와 RDS max connections를 고려해 설정합니다.
- `DB_CONNECT_TIMEOUT_MS`: DB 연결 타임아웃입니다. 부팅/배포 시 장애 감지 시간을 제어할 수 있습니다.
- `DB_SSL_REJECT_UNAUTHORIZED=false`: 암호화는 사용하지만 인증서 검증을 끕니다. 인증서 준비 전 임시 진단 목적 외에는 운영에서 권장하지 않습니다.

RDS CA 인증서를 애플리케이션 런타임에 설치하는 방식은 배포 환경에 따라 달라집니다. 인증서 검증을 적용할 때는 AWS RDS 인증서 번들을 애플리케이션이 읽을 수 있도록 배포하고, `DB_SSL_CA`에 해당 경로를 설정합니다. 인증서 검증 실패 원인 확인을 위해 `DB_SSL_REJECT_UNAUTHORIZED=false`를 임시로 사용할 수 있지만, 운영 배포 기준값으로 남기지 않습니다.

## 14. 기존 RDS에 이미 테이블이 있는 경우

초기 migration은 비어 있는 database를 기준으로 작성되었습니다. 기존 RDS에 이미 테이블이 있다면 초기 migration을 바로 실행하지 마세요.

1. RDS 스냅샷 또는 별도 백업을 만듭니다.
2. 현재 테이블과 entity 정의를 비교합니다.
3. 기존 스키마가 초기 migration과 동일한지 확인합니다.
4. 이미 생성된 스키마라면 baseline 전략을 정한 후 migration 이력을 등록합니다.
5. 별도 테스트 database에서 `migration:run`을 먼저 검증합니다.

운영 DB에서 `migration:revert`는 데이터 손실 가능성이 있으므로 백업과 영향 범위를 확인한 경우에만 사용합니다.

## 15. 배포 실행 순서

현업에서는 migration을 애플리케이션 startup에 숨기지 않고 release/deploy 작업으로 분리합니다.

```text
1. 새 애플리케이션 이미지 준비
2. RDS 백업 및 migration 영향 확인
3. release job에서 npm run migration:run
4. migration 성공 확인
5. NestJS 애플리케이션 배포
6. GET /health 확인
```

개인 프로젝트에서는 RDS에 접근 가능한 운영 터미널에서 수동 실행할 수 있습니다. 단, 실행한 명령과 결과를 기록하고 애플리케이션 배포 전에 migration을 완료하세요.

EC2에서 GitHub 수동 pull과 PM2를 사용하는 흐름은 다음과 같습니다.

```bash
git pull --ff-only
npm ci
npm run build
eval "$(AWS_SECRET_ID=<secret-id> AWS_REGION=ap-northeast-2 npm run -s secrets:export)"
npm run migration:show
npm run migration:run
npm run pm2:reload
curl -fsS http://localhost:${PORT:-3000}/health
```

`npm run pm2:reload`는 `ecosystem.config.cjs`를 사용합니다. 이 파일에는 secret 값을 저장하지 않고, helper가 현재 shell에 export한 환경변수만 PM2에 전달합니다.

## 16. 자주 발생하는 오류

### connection timeout

- RDS가 실행 중인지 확인합니다.
- RDS endpoint와 port가 정확한지 확인합니다.
- RDS 보안 그룹에서 애플리케이션 실행 위치의 접근을 허용했는지 확인합니다.
- private RDS에 외부 PC에서 직접 접근하려는 것은 아닌지 확인합니다.

### password authentication failed

- `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`를 확인합니다.
- `.env`의 따옴표와 공백을 확인합니다.
- Secret Manager의 값이 배포 환경변수에 실제로 주입되었는지 확인합니다.

### database does not exist

- `DB_DATABASE`가 실제 PostgreSQL database 이름과 같은지 확인합니다.
- RDS 생성 시 만든 initial database가 없는 경우 별도로 database를 생성해야 합니다.
- `DATABASE_URL`을 사용 중이면 URL의 마지막 path가 database 이름입니다.

### SSL error

- RDS에서 TLS가 요구되는지 확인합니다.
- 우선 `DB_SSL=true`를 사용합니다.
- 인증서 검증 실패 시 RDS CA 인증서가 런타임에 설치되어 있는지 확인합니다.
- `DB_SSL_REJECT_UNAUTHORIZED=false`는 원인 확인용 임시 설정으로만 사용합니다.

### permission denied

migration을 실행하는 DB 사용자가 테이블과 sequence를 생성할 권한이 있는지 확인합니다. 운영 애플리케이션 사용자는 migration 전용 사용자와 분리하는 것이 좋습니다.

## 17. 추천 학습 순서

처음부터 모든 파일을 열기보다 아래 순서로 읽으면 연결 흐름이 자연스럽습니다.

1. `src/app.module.ts`
2. `src/database/database-options.ts`
3. `src/database/data-source.ts`
4. `src/users/entities/user.entity.ts`
5. `src/music/entities/track.entity.ts`
6. `src/music/entities/playlist.entity.ts`
7. `src/music/entities/playlist-track.entity.ts`
8. `src/users/users.module.ts`
9. `src/users/users.service.ts`
10. `src/music/music.module.ts`
11. `src/music/services/tracks.service.ts`
12. `src/music/services/playlists.service.ts`
13. `src/music/services/playlist-tracks.service.ts`
14. `src/database/migrations/1760000000000-CreateInitialSchema.ts`

각 파일을 읽을 때는 다음 질문을 던져보세요.

- 이 파일은 DB 연결, 테이블 정의, repository 등록, 비즈니스 로직 중 무엇을 담당하는가?
- entity와 DTO가 섞이지 않고 분리되어 있는가?
- service는 SQL 세부사항보다 도메인 흐름을 드러내는가?
- 운영 DB에 반영해야 하는 변경이라면 migration이 필요한가?

## 18. 실습 과제

### 과제 1: Entity 변경과 migration 생성

`Track`에 `genre` 같은 nullable 컬럼을 추가한다고 가정해보세요. entity를 수정한 뒤 개발 DB에서 migration을 생성하고, 생성된 SQL이 기대와 맞는지 확인합니다.

```bash
npm run migration:generate -- src/database/migrations/AddTrackGenre
npm run migration:show
```

### 과제 2: Repository 조회 조건 추가

`TracksService.getTrackList`에 `lengthSec` 범위 검색을 추가한다고 가정해보세요. DTO, service의 QueryBuilder 조건, 테스트 케이스가 함께 바뀌어야 합니다.

### 과제 3: playlist 관계 읽기

`PlaylistsService.getPlaylist`에서 `relations: ['playlistTracks', 'playlistTracks.track']`가 어떤 SQL 조회를 유도하는지 로그를 켜고 확인해보세요. 관계를 eager하게 읽는 경우와 필요한 시점에 별도로 조회하는 경우의 차이를 비교합니다.

### 과제 4: RDS 연결 체크리스트 확인

RDS에 연결하기 전 아래 항목을 스스로 확인해보세요.

- `DB_HOST`, `DB_PORT`, `DB_DATABASE`가 RDS 값과 일치하는가?
- 애플리케이션 실행 위치에서 RDS 보안 그룹 접근이 허용되어 있는가?
- 운영에서 `DB_SYNCHRONIZE=false`인가?
- migration을 애플리케이션 배포 전에 실행하는가?
- 비밀번호, JWT secret, Google token이 로그에 출력되지 않는가?

## 19. 확인 명령

문서만 수정한 경우에도 실제 DB 관련 변경을 했다면 아래 명령을 기준으로 확인합니다.

```bash
npm test -- --runInBand
npm run build
npx eslint "src/**/*.ts" "test/**/*.ts"
```

RDS에 연결한 뒤에는 migration 실행 후 `/health`, 회원 등록/로그인, 음악 track 및 playlist 저장·조회를 확인합니다. 오류 로그에 비밀번호, `DATABASE_URL`, JWT 또는 Google token이 출력되지 않는지도 확인하세요.
