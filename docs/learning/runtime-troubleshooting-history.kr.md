# NestJS 로컬 실행 오류 및 수정 이력

이 문서는 2026-09-10 로컬 점검 과정에서 발생한 오류와 수정 내역을 기록한 학습 가이드입니다. 환경 파일, 원격 MariaDB, TypeORM 엔티티 메타데이터, Jest ESM 설정이 서로 어떻게 연결되는지 재현 가능한 순서로 정리합니다.

> 주의: 실제 DB 비밀번호, JWT secret, OAuth client secret은 이 문서에 기록하지 않습니다.

## 1. 최종 상태

현재 다음 검증이 통과했습니다.

| 검증 | 결과 |
|---|---|
| `npm run build` | 성공 |
| `npm test -- --runInBand` | 27개 스위트, 142개 테스트 통과 |
| `npm run start` | 성공 |
| `GET /health` | HTTP 200, `database: up` |
| `npm run test:e2e` | 1개 스위트, 2개 테스트 통과 |

현재 로컬 테스트는 `.env.test.local`의 `app_db`를 사용합니다. 테스트 전용 `app_db_test`가 준비되면 다시 분리해야 합니다.

## 2. 환경 파일 정리

### 2.1 파일별 역할

| 파일 | 용도 | Git 관리 |
|---|---|---|
| `.env` | 로컬 개발/실행 설정 | 무시됨 |
| `.env.example` | 개발 설정 템플릿 | 추적됨 |
| `.env.test.local` | 로컬 E2E 실제 설정 | 무시됨 |
| `.env.test.example` | E2E 설정 템플릿 | 추적됨 |

실행 시 사용되는 파일은 `NODE_ENV`에 따라 달라집니다.

```text
일반 실행
  NODE_ENV=development -> .env

E2E 실행
  test/e2e-env.ts가 NODE_ENV=test 설정
  -> .env.test.local
```

`.env.test.local`이 존재하더라도 일반 실행이 자동으로 이 파일을 읽지는 않습니다. 반대로 E2E는 테스트 설정을 우선 사용합니다.

### 2.2 확인할 설정

개발 실행과 E2E 실행에서 최소한 다음 값을 확인합니다.

```env
DB_TYPE=mariadb
DB_HOST=<same-as-workbench>
DB_PORT=3306
DB_USERNAME=<same-account-as-workbench>
DB_PASSWORD=<same-password-as-workbench>
DB_DATABASE=app_db
DB_SYNCHRONIZE=false
```

Google Client ID를 아직 발급받지 않은 경우에는 placeholder를 사용할 수 있지만 Google 로그인 기능은 사용할 수 없습니다.

```env
GOOGLE_ALLOWED_AUDIENCES=replace-with-google-client-id.apps.googleusercontent.com
```

## 3. 오류 및 수정 이력

### 3.1 `Only DB_TYPE=mariadb is supported.`

**증상**

```text
Error: Only DB_TYPE=mariadb is supported.
```

**원인**

로컬 `.env`에 다음 값이 있었습니다.

```env
DB_TYPE=mysql
```

현재 애플리케이션의 `validateAppEnv`는 MariaDB만 허용합니다.

**수정**

```env
DB_TYPE=mariadb
```

MariaDB 연결은 TypeORM의 `mariadb` 드라이버와 `mysql2` 패키지를 통해 처리합니다.

### 3.2 `GOOGLE_ALLOWED_AUDIENCES is required.`

**증상**

```text
Error: GOOGLE_ALLOWED_AUDIENCES is required.
```

**원인**

Google OAuth Client ID가 아직 발급되지 않았지만, 현재 설정 검증은 audience 값을 필수로 요구합니다.

**판단**

이 값은 ID Token의 `aud` 검증에 사용되므로 임의로 제거해 검증을 생략하면 안 됩니다. placeholder로 앱 기동을 허용할 수는 있지만 실제 Google 로그인은 Client ID 발급 전까지 사용할 수 없습니다.

**현재 가이드**

- 템플릿에는 placeholder를 둡니다.
- 실제 `.env`와 `.env.test.local`에도 필요한 경우 placeholder를 둡니다.
- Google Client ID 발급 후 실제 값으로 교체합니다.

### 3.3 E2E Jest setup 파일 경로 오류

**증상**

```text
Module <rootDir>/test/e2e-env.ts in the setupFiles option was not found.
```

**원인**

`test/jest-e2e.json`의 `rootDir`가 이미 `test`인데 setup 경로에 다시 `test/`가 포함되어 있었습니다.

**수정**

```json
{
  "rootDir": ".",
  "setupFiles": ["<rootDir>/e2e-env.ts"]
}
```

이제 Jest는 다음 파일을 찾습니다.

```text
test/e2e-env.ts
```

### 3.4 Jest에서 `jose` ESM 파싱 오류

**증상**

```text
SyntaxError: Unexpected token 'export'
node_modules/jose/dist/webapi/index.js
```

**원인**

`jose`는 ESM 패키지인데 기존 Jest 실행 방식이 CommonJS 환경으로 패키지를 읽었습니다.

**수정**

`package.json`의 E2E 스크립트에 Node VM ESM 모드를 적용했습니다.

```json
"test:e2e": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js --config ./test/jest-e2e.json"
```

Node 버전에 따라 experimental warning이 표시될 수 있지만, 테스트 실행 자체에는 문제가 되지 않습니다.

### 3.5 테스트 DB 이름 정책과 `app_db_test` 권한 문제

**초기 정책**

`NODE_ENV=test`에서는 실수로 개발 DB를 사용하지 않도록 DB 이름이 `_test`로 끝나야 했습니다.

```text
DB_DATABASE=app_db_test
```

하지만 원격 MariaDB에서 현재 테스트 계정 `appuser`가 접근할 수 있는 DB는 `app_db`였고, `app_db_test` 접근 시 다음 오류가 발생했습니다.

```text
Access denied for user 'appuser'@'%' to database 'app_db_test'
```

**현재 임시 조치**

현재는 테스트 환경에서 아래 두 경우를 허용합니다.

- `app_db`: 현재 테스트 계정 권한에 맞는 임시 설정
- `*_test`: 추후 권장되는 전용 테스트 DB

전용 테스트 DB를 준비하기 전까지는 다음 설정을 사용합니다.

```env
NODE_ENV=test
DB_DATABASE=app_db
```

**향후 복구 작업**

DB 관리자가 전용 테스트 DB와 권한을 준비하면 다음 순서로 복구합니다.

```sql
CREATE DATABASE app_db_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON app_db_test.* TO 'appuser'@'%';
FLUSH PRIVILEGES;
```

그 후 다음을 수행합니다.

1. `.env.test.local`의 `DB_DATABASE`를 `app_db_test`로 변경
2. `src/config/app-env.ts`에서 임시 `app_db` 허용 조건 제거
3. `src/config/app-env.spec.ts`의 테스트를 `_test` 전용 정책으로 복구
4. `docs/learning/deployment-secrets-checklist.kr.md`의 미완료 체크 항목 완료 처리
5. migration 실행 후 E2E 재검증

> 실제 운영에서는 `%`보다 허용할 클라이언트 주소를 좁혀 권한을 부여하는 편이 안전합니다.

### 3.6 `DB_SYNCHRONIZE` 설정 점검

`.env`와 `.env.test.local`의 `DB_SYNCHRONIZE`를 `false`로 변경했습니다.

```env
DB_SYNCHRONIZE=false
```

이 설정은 TypeORM이 애플리케이션 시작 시 엔티티 변경을 DB에 자동 반영하지 않도록 합니다. 공유 DB나 운영 DB에서 `true`로 두면 컬럼, 관계, 타입 변경이 의도치 않게 적용될 수 있습니다.

스키마 변경은 migration으로 처리합니다.

```powershell
$env:NODE_ENV='test'
npm run migration:run
```

## 4. `DB_SYNCHRONIZE=false` 이후 드러난 TypeORM 오류

자동 동기화 설정을 끄고 실제 TypeORM 초기화를 진행하자, 이전에 가려져 있던 엔티티 메타데이터 문제가 드러났습니다.

### 4.1 `User#socialAccounts` 메타데이터 누락

**증상**

```text
Entity metadata for User#socialAccounts was not found.
```

**원인**

`User`가 `SocialAccount`과 관계를 선언하고 있었지만 전역 `databaseEntities` 배열에 `SocialAccount`이 빠져 있었습니다.

**수정**

`src/database/database-options.ts`에 엔티티를 등록했습니다.

```ts
export const databaseEntities = [
  User,
  SocialAccount,
  Artist,
  Track,
  Playlist,
  PlaylistTrack,
];
```

### 4.2 MariaDB의 `Data type "Object"` 오류

**증상**

다음과 같은 오류가 순서대로 발생했습니다.

```text
Data type "Object" in "SocialAccount.email" is not supported by "mariadb"
Data type "Object" in "User.password" is not supported by "mariadb"
Data type "Object" in "Playlist.description" is not supported by "mariadb"
Data type "Object" in "PlaylistTrack.note" is not supported by "mariadb"
```

**원인**

TypeScript의 `string | null` union 타입을 TypeORM decorator가 MariaDB 컬럼 타입으로 안정적으로 추론하지 못했습니다. 런타임 메타데이터가 `Object`가 되어 MariaDB가 거부했습니다.

**수정**

nullable 문자열 컬럼의 DB 타입을 명시했습니다.

```ts
@Column({ type: 'varchar', nullable: true })
email: string | null;
```

적용 대상:

- `User.password`
- `User.email`
- `User.name`
- `SocialAccount.email`
- `SocialAccount.name`
- `Artist.description`
- `Playlist.description`
- `PlaylistTrack.note`

이미 `type`이 명시되어 있던 nullable 날짜/숫자 컬럼은 추가 변경하지 않았습니다.

## 5. Workbench와 NestJS 연결 비교 가이드

MySQL Workbench에서 연결되더라도 NestJS가 실패할 수 있습니다. 두 프로그램이 정확히 같은 접속 정보를 사용하는지 비교해야 합니다.

```sql
SELECT USER(), CURRENT_USER(), DATABASE(), @@hostname, @@port;
SHOW GRANTS FOR CURRENT_USER();
```

다음 항목을 1:1로 비교합니다.

- Host: `DB_HOST`
- Port: `DB_PORT`
- Username: `DB_USERNAME`
- Password: `DB_PASSWORD`
- Database/schema: `DB_DATABASE`
- SSL 사용 여부: `DB_SSL`
- 접속 클라이언트의 출발지 IP

특히 MariaDB 권한은 다음처럼 계정과 host 조합에 따라 달라질 수 있습니다.

```sql
SHOW GRANTS FOR 'appuser'@'%';
SHOW GRANTS FOR 'appuser'@'localhost';
```

Workbench가 `appuser@localhost`로 연결되고 NestJS가 원격 주소에서 `appuser@'%'`로 연결되면 서로 다른 권한이 적용될 수 있습니다.

## 6. 재현 및 점검 순서

### 6.1 기본 코드 검증

```powershell
npm test -- --runInBand
npm run build
```

### 6.2 일반 서버 검증

`.env`에 실제 개발 설정을 넣은 뒤 실행합니다.

```powershell
npm run start
```

별도 터미널에서 확인합니다.

```powershell
Invoke-WebRequest http://localhost:3000/health -UseBasicParsing
```

정상 결과 예시:

```json
{"status":"ok","database":"up"}
```

### 6.3 E2E 검증

`.env.test.local`에 테스트 설정을 넣은 뒤 실행합니다.

```powershell
npm run test:e2e
```

E2E는 `test/e2e-env.ts`에서 `.env.test.local`을 먼저 읽고 `NODE_ENV=test`를 설정합니다.

## 7. 학습 포인트

1. 환경 파일은 파일 개수보다 실행 모드와 로딩 우선순위를 먼저 확인해야 합니다.
2. Workbench 연결 성공은 NestJS가 같은 계정, host, schema, SSL로 연결된다는 뜻이 아닙니다.
3. `DB_SYNCHRONIZE=false`는 오류를 만드는 설정이 아니라, 자동 스키마 변경을 막고 숨겨진 엔티티 설정 오류를 드러내는 안전한 설정입니다.
4. TypeORM 관계를 추가하면 관계 대상 엔티티가 DataSource의 `entities` 목록에도 포함되어야 합니다.
5. `string | null`처럼 union 타입을 사용하는 ORM 컬럼은 DB 타입을 decorator에 명시하는 편이 안전합니다.
6. 테스트 DB 권한이 준비되지 않은 임시 운영은 반드시 문서화하고, 전용 DB로 복구할 작업을 체크리스트에 남겨야 합니다.
7. 외부 OAuth Client ID가 없더라도 audience 검증을 제거해서는 안 됩니다. 기능 준비 전에는 placeholder로 명시적으로 차단하는 편이 안전합니다.

## 8. 후속 작업 체크리스트

- [ ] Google OAuth Client ID 발급 후 `.env`와 `.env.test.local`의 audience placeholder 교체
- [ ] `app_db_test` 생성
- [ ] `appuser`에 `app_db_test` 권한 부여
- [ ] `.env.test.local`을 `DB_DATABASE=app_db_test`로 변경
- [ ] `src/config/app-env.ts`의 임시 `app_db` 허용 조건 제거
- [ ] 전용 테스트 DB migration 실행
- [ ] `npm run test:e2e` 재실행
- [ ] Workbench와 애플리케이션의 접속 정보 및 권한 일치 여부 재확인
- [ ] 변경 후 `npm test -- --runInBand`, `npm run build`, `npm run start`, `npm run test:e2e` 재검증
