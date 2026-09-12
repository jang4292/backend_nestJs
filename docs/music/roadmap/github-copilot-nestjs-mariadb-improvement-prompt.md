# GitHub Copilot 작업 프롬프트
## NestJS Music API + AWS EC2 MariaDB 운영 구조 점검 및 수정·보완

> 대상 프로젝트: NestJS Music Backend API  
> DB 운영 계획: AWS EC2 내부 MariaDB  
> 목적: 현재 `src/music` 중심 구현을 유지하면서 DB 운영 안정성, 예외처리, 초기화/마이그레이션, 권한, 트랜잭션, 조회 구조, 음원 관리, 테스트를 단계적으로 보완한다.

---

# 0. Copilot에게 전달할 최상위 작업 지침

현재 프로젝트 전체 코드를 먼저 분석한 뒤 수정 작업을 진행하라.

이 작업의 목적은 단순 리팩터링이 아니라 다음 항목을 실제 운영 가능한 수준으로 보완하는 것이다.

1. AWS EC2 내부 MariaDB를 기준으로 DB 연결 및 운영 구조 점검
2. DB 관련 설정/구현이 없거나 불완전하면 생성 및 보완
3. DB connection 실패, constraint violation, transaction 실패 등 DB 예외처리 보강
4. TypeORM migration 기반 스키마 관리
5. Artist / Track / Playlist / PlaylistItem(기존 PlaylistTrack) 무결성 강화
6. 실제 음원 파일 관리를 위한 AudioAsset 도메인 추가 검토 및 구현
7. Track 검색/필터/정렬/pagination 조회 구조 정리
8. Playlist owner/권한 및 트랜잭션 처리 보강
9. Entity 직접 반환 제거 및 Response DTO 적용
10. integration / E2E 테스트 보강
11. 기존 기능/테스트/클라이언트 호환성을 가능한 한 유지
12. 운영 환경에서 위험한 자동 스키마 변경을 금지

작업 전 반드시 현재 구현 상태를 분석하고, 기존 코드가 이미 담당하고 있는 기능을 중복 구현하지 마라.

---

# 1. 현재 구조 전제

현재 Music 모듈은 대략 다음 구조를 사용한다고 가정한다.

```text
HTTP Controller
  -> MusicService facade
    -> Use case
      -> Repository port
        -> TypeORM repository adapter
          -> Database
```

주요 도메인:

```text
Artist
Track
Playlist
PlaylistTrack
```

현재 또는 기존 구현에서 확인해야 할 기능:

```text
Artist
- 목록
- 단건
- 생성
- 수정
- 삭제

Track
- 생성
- 단건
- 수정
- 삭제
- 전체 목록
- 검색
- artist 필터
- BPM 필터
- 정렬
- pagination

Playlist
- 생성
- 단건
- 수정
- 삭제
- 목록
- 날짜 기반 조회

PlaylistTrack
- 플레이리스트 트랙 목록
- 추가
- 순서 변경
- 메모 수정
- 삭제
```

현재 구조를 전부 폐기하거나 새로운 아키텍처로 전면 재작성하지 마라.

기존 port / adapter / use-case 방향을 최대한 유지하면서 필요한 부분만 개선한다.

---

# 2. 가장 먼저 수행할 분석

수정 전에 아래 내용을 프로젝트 코드 기준으로 분석해서 정리하라.

## 2.1 NestJS / TypeORM / DB 설정 분석

다음 파일과 설정을 찾아라.

```text
package.json
src/main.ts
src/app.module.ts
src/**/database*
src/**/typeorm*
src/config/**
.env*
ormconfig*
data-source*
docker-compose*
migration*
```

다음 내용을 확인한다.

- TypeORM 사용 여부
- MariaDB/MySQL driver 사용 여부
- `mysql2` 패키지 사용 여부
- `TypeOrmModule.forRoot` 또는 `forRootAsync`
- DataSource 존재 여부
- migration 설정
- synchronize 설정
- logging 설정
- connection pool 설정
- timezone
- charset / collation
- SSL 사용 여부
- 환경 변수 구조
- health check 존재 여부

분석 결과를 먼저 제시하고 수정 작업을 진행하라.

---

# 3. AWS EC2 내부 MariaDB 운영 전제

DB는 AWS RDS가 아니라 EC2 내부 MariaDB를 운영한다고 가정한다.

대표 구조:

```text
Client
  |
  v
NestJS API
  |
  v
MariaDB
```

NestJS와 MariaDB가 동일 EC2일 수도 있고 별도 EC2일 수도 있으므로 설정을 코드에 하드코딩하지 않는다.

환경 변수 예시:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=music_app
DB_PASSWORD=change-me
DB_DATABASE=music_db

DB_POOL_SIZE=10
DB_CONNECT_TIMEOUT=10000

DB_LOGGING=false
DB_SYNCHRONIZE=false
```

주의:

```text
운영 환경에서 synchronize=true 사용 금지
```

반드시 migration으로 관리한다.

---

# 4. MariaDB 연결 설정 보완

현재 DB 설정이 없거나 불완전하면 ConfigModule + TypeORM 기준으로 보완한다.

예시 방향:

```ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],

  useFactory: (config: ConfigService) => ({
    type: 'mariadb',

    host: config.getOrThrow<string>('DB_HOST'),
    port: config.get<number>('DB_PORT', 3306),

    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_DATABASE'),

    autoLoadEntities: true,

    synchronize: false,

    logging: config.get<boolean>('DB_LOGGING', false),

    extra: {
      connectionLimit: config.get<number>('DB_POOL_SIZE', 10),
      connectTimeout: config.get<number>('DB_CONNECT_TIMEOUT', 10000),
    },
  }),
});
```

단, 현재 프로젝트 설정 방식이 이미 있다면 그것을 우선 유지하고 필요한 값만 보완한다.

---

# 5. 환경 변수 Validation 추가

DB 설정값 누락으로 서버가 애매한 상태에서 실행되지 않도록 한다.

다음 중 프로젝트와 잘 맞는 방식을 사용한다.

```text
Joi
class-validator
Zod
Custom validation
```

필수 확인 대상:

```text
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_DATABASE
```

잘못된 설정이면 애플리케이션 시작 시점에 즉시 명확한 오류를 발생시킨다.

비밀번호나 secret을 로그에 출력하지 않는다.

---

# 6. DB 자체가 없는 경우에 대한 정책

여기서 가장 중요한 원칙:

```text
운영 서버 실행 시마다 CREATE DATABASE를 자동 실행하지 않는다.
```

DB 생성과 애플리케이션 테이블 migration은 분리한다.

권장 구조:

```text
Infrastructure provisioning
    ↓
Database 생성
    ↓
DB 사용자 생성 및 권한 설정
    ↓
NestJS migration 실행
    ↓
NestJS API 시작
```

필요하다면 개발/초기 배포용 bootstrap 스크립트를 별도로 만든다.

예:

```text
scripts/db/bootstrap.ts
scripts/db/check.ts
scripts/db/migrate.ts
```

---

# 7. MariaDB Database 초기화 로직

현재 DB 생성 절차가 전혀 없다면 아래 방법 중 프로젝트에 맞는 방식을 추가한다.

## 방법 A - SQL 문서 제공

예:

```sql
CREATE DATABASE IF NOT EXISTS music_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

운영 사용자:

```sql
CREATE USER IF NOT EXISTS 'music_app'@'localhost'
IDENTIFIED BY 'CHANGE_ME';

GRANT SELECT, INSERT, UPDATE, DELETE
ON music_db.*
TO 'music_app'@'localhost';
```

Migration 실행 계정에 별도 DDL 권한이 필요하다면 앱 런타임 계정과 분리하는 방안도 검토한다.

절대 소스코드에 실제 운영 비밀번호를 작성하지 않는다.

---

# 8. 운영 DB 생성 스크립트가 필요하면 안전장치 추가

자동화 스크립트를 추가한다면:

```text
npm run db:check
npm run db:create
npm run db:migrate
npm run db:revert
npm run db:status
```

등으로 역할을 분리한다.

`db:create`는 명시적인 명령으로만 실행한다.

NestJS `npm run start` 과정에서 자동으로 DB를 생성하지 않는다.

---

# 9. TypeORM Migration 점검

현재 migration 구조를 조사한다.

migration이 없다면 생성한다.

기본 원칙:

```text
기존 migration 파일 수정 금지
새로운 변경은 새로운 migration 추가
```

예:

```text
src/database/migrations/
  001-create-artist.ts
  002-create-track.ts
  003-create-playlist.ts
  004-create-playlist-track.ts
  005-add-track-indexes.ts
  006-add-playlist-owner.ts
  007-add-audio-asset.ts
```

실제 기존 번호/타임스탬프 규칙이 있다면 그대로 따른다.

---

# 10. DB Connection 예외처리

다음 예외 상황을 구분해서 처리한다.

```text
ECONNREFUSED
ETIMEDOUT
ER_ACCESS_DENIED_ERROR
ER_BAD_DB_ERROR
ER_CON_COUNT_ERROR
PROTOCOL_CONNECTION_LOST
Connection pool exhaustion
Query timeout
Deadlock
Lock wait timeout
```

DB 장애를 모든 경우 HTTP 500 하나로만 처리하지 않는다.

다만 내부 DB 오류 메시지/SQL/비밀번호/host 정보를 API 응답으로 그대로 노출하지 않는다.

---

# 11. MariaDB / TypeORM DB Error Mapper 추가 검토

공통 변환 계층을 고려한다.

예:

```text
Database Error
      ↓
DB Error Translator
      ↓
Application Error
      ↓
HTTP Exception
```

예:

```ts
enum DatabaseErrorCode {
  DUPLICATE = 'DUPLICATE',
  FOREIGN_KEY = 'FOREIGN_KEY',
  NOT_NULL = 'NOT_NULL',
  DEADLOCK = 'DEADLOCK',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  CONNECTION = 'CONNECTION',
}
```

MariaDB/MySQL 대표 error code:

```text
1062 Duplicate entry
1451 FK parent delete/update violation
1452 FK child insert/update violation
1048 Column cannot be null
1213 Deadlock
1205 Lock wait timeout
1045 Access denied
1049 Unknown database
```

실제 driver error 객체 구조를 확인하고 구현한다.

---

# 12. API Error Contract 통일

예:

```json
{
  "statusCode": 409,
  "code": "DUPLICATE_PLAYLIST_SEQUENCE",
  "message": "Playlist sequence already exists",
  "path": "/music/playlists/10/items"
}
```

대표 code:

```text
ARTIST_NOT_FOUND
TRACK_NOT_FOUND

PLAYLIST_NOT_FOUND
PLAYLIST_FORBIDDEN

DUPLICATE_PLAYLIST_TRACK
DUPLICATE_PLAYLIST_SEQUENCE

PLAYLIST_DATE_CONFLICT

DATABASE_UNAVAILABLE
DATABASE_CONFLICT

AUDIO_ASSET_NOT_FOUND
```

NestJS Exception Filter 또는 application error mapper가 이미 있다면 그것을 확장한다.

---

# 13. Health Check 보강

DB 상태를 확인할 수 있는 health endpoint를 점검한다.

예:

```text
GET /health
GET /readyz
GET /health/database
```

적어도 readiness에서는 실제 DB 연결을 확인하도록 한다.

예:

```sql
SELECT 1;
```

DB 장애 시 readiness가 성공으로 나오지 않게 한다.

민감한 연결 정보는 반환하지 않는다.

응답 예:

```json
{
  "status": "error",
  "database": "down"
}
```

---

# 14. Artist 구조 검토

Artist는 음악 카탈로그 데이터다.

예상 필드:

```text
id
name
normalizedName
createdAt
updatedAt
deletedAt(optional)
```

검토 사항:

```text
name NOT NULL
normalizedName 검색 사용 여부
중복 artist 정책
soft delete 필요 여부
Track FK 관계
```

Track이 참조하고 있는 Artist 삭제는 DB FK `RESTRICT`를 유지하는 방향을 우선 검토한다.

Application에서는 해당 DB 오류를:

```text
409 Conflict
```

로 변환한다.

---

# 15. Track 구조 보완

Track은 실제 음원 파일 자체가 아니라 음악 메타데이터로 관리한다.

기본 필드 후보:

```text
id
artistId
title
bpm
durationMs

createdAt
updatedAt
deletedAt
```

추가 데이터는 실제 요구사항이 생긴 뒤 도입한다.

초기부터 다음 데이터를 전부 Track에 넣지 않는다.

```text
genre
mood
energy
drive
role
tone
rating
```

필요하면 향후 별도 analysis/tag 구조를 고려한다.

---

# 16. Track 조회 API 개선

다음 요구를 하나의 Query API에서 처리할 수 있도록 한다.

```text
전체 곡
특정 검색어
특정 Artist
BPM 범위
정렬
pagination
```

권장:

```http
GET /tracks
GET /tracks/:id
```

Query:

```text
q
artistId
minBpm
maxBpm
page
limit
sort
order
```

예:

```http
GET /tracks?q=swing&artistId=100&minBpm=140&maxBpm=190&page=1&limit=30
```

---

# 17. Track Search Criteria 도입

Repository method가 다음처럼 증가하지 않도록 한다.

잘못된 방향:

```ts
findByArtist()
findByBpm()
findByTitle()
findByArtistAndBpm()
findByArtistAndTitle()
```

권장:

```ts
interface TrackSearchCriteria {
  q?: string;

  artistId?: number;

  minBpm?: number;
  maxBpm?: number;

  page: number;
  limit: number;

  sort?: 'title' | 'bpm' | 'createdAt';
  order?: 'ASC' | 'DESC';
}
```

Repository:

```ts
search(criteria: TrackSearchCriteria)
```

TypeORM QueryBuilder를 사용해 필요한 조건만 동적으로 추가한다.

---

# 18. Pagination 표준화

목록 API 응답:

```json
{
  "items": [],
  "page": 1,
  "limit": 30,
  "total": 150,
  "totalPages": 5
}
```

검증:

```text
page >= 1
limit >= 1
limit <= 100
```

sort field는 whitelist 방식으로 제한한다.

사용자 입력값을 직접 SQL ORDER BY 문자열로 연결하지 않는다.

---

# 19. Search Query 보안

다음 SQL Injection 위험을 점검한다.

잘못된 예:

```ts
.orderBy(query.sort)
```

직접 사용자 값 전달 금지.

대신:

```ts
const SORT_COLUMNS = {
  title: 'track.title',
  bpm: 'track.bpm',
  createdAt: 'track.createdAt',
};
```

처럼 whitelist mapping을 사용한다.

모든 search 값은 parameter binding을 사용한다.

---

# 20. MariaDB Index 설계

실제 Query를 기준으로 Index를 점검한다.

우선 후보:

```text
track.artist_id
track.bpm

playlist.owner_id
playlist.play_date

playlist_track.playlist_id
playlist_track.track_id
```

필요한 경우 composite index:

```text
(track.artist_id, track.bpm)
```

단, 무조건 인덱스를 추가하지 않는다.

실제 QueryBuilder와 SQL 실행 계획을 기준으로 판단한다.

---

# 21. AudioAsset 도메인 추가

Track과 실제 음원 파일을 분리한다.

관계:

```text
Track
  1
  |
  N
AudioAsset
```

후보 필드:

```text
id
trackId

storageProvider
storageKey

mimeType
fileSize
bitrate
durationMs

checksum

status

createdAt
updatedAt
```

status 예:

```text
UPLOADING
READY
FAILED
DELETED
```

---

# 22. S3/CloudFront 연동을 고려한 구조

DB에는 가능하면 전체 public URL보다 storage key를 저장한다.

예:

```text
music/2026/09/track-123.mp3
```

피해야 할 구조:

```text
https://xxxxxxxx.cloudfront.net/music/2026/09/track-123.mp3
```

URL 생성 책임은 application/service 또는 dedicated storage service로 분리한다.

예:

```text
AudioStorageService
```

향후:

```text
S3
CloudFront
Local
Other provider
```

교체 가능하도록 한다.

단, 현재 S3 연동이 없다면 실제 업로드 전체 구현보다 도메인/port 경계를 우선 만들고 TODO를 명확하게 남길 수 있다.

---

# 23. Audio Upload 안전성

업로드 기능이 이미 있다면 다음을 확인한다.

```text
파일 크기 제한
허용 MIME type
확장자 검증
중복 파일
checksum
업로드 실패 rollback
DB 저장 실패 시 orphan file 처리
파일 삭제 실패 처리
```

DB transaction과 S3 transaction은 하나의 transaction이 아니므로 보상 처리 전략을 작성한다.

예:

```text
S3 upload 성공
DB insert 실패
    ↓
S3 object 삭제 시도
```

---

# 24. Playlist 소유권 추가

Playlist가 사용자별 데이터라면 다음을 추가한다.

```text
ownerId
```

예:

```text
Playlist
----------------
id
ownerId
title
playDate
description
visibility
createdAt
updatedAt
```

visibility:

```text
PRIVATE
PUBLIC
```

공유 기능이 실제 필요한 시점에:

```text
playlist_member
```

테이블을 별도 추가한다.

처음부터 과도한 ACL 시스템을 만들지 않는다.

---

# 25. Artist / Track 권한

Artist와 Track이 전역 음악 카탈로그라면 일반 사용자가 변경하지 못하게 한다.

권장 정책:

```text
READ
- authenticated user 또는 정책상 public

WRITE
- admin
- editor
```

현재 Role/Permission 시스템이 있다면 재사용한다.

없다면 최소한:

```text
Role enum
@Roles()
RolesGuard
```

구조를 검토한다.

Auth 모듈 전체 재작성은 하지 않는다.

---

# 26. Playlist 권한

Playlist 변경 시 반드시 현재 사용자를 검사한다.

예:

```text
currentUser.id === playlist.ownerId
```

대상:

```text
update
delete

add item
remove item
move item
replace items
```

Repository에 다음과 같은 의미 기반 method도 고려한다.

```ts
findOwnedById(
  playlistId: number,
  userId: number,
)
```

---

# 27. PlaylistTrack → PlaylistItem 개념 정리

코드/테이블 호환성이 중요하므로 즉시 rename migration부터 하지 않는다.

도메인 개념상:

```text
PlaylistItem
```

으로 취급할 수 있도록 정리한다.

현재 DB table:

```text
playlist_track
```

은 유지 가능하다.

필드 예:

```text
id

playlistId
trackId

seq
memo

createdAt
updatedAt
```

---

# 28. Playlist Sequence 정책 확정

다음 정책을 코드에 명확하게 구현한다.

권장:

```text
seq는 playlist 내부에서 유일
1부터 시작
중간 삽입 허용
삭제 후 재정렬
move 시 transaction
```

DB:

```text
UNIQUE (playlist_id, seq)
```

동일 Track 중복을 허용하지 않는 제품 정책이면:

```text
UNIQUE (playlist_id, track_id)
```

도 추가한다.

중복 허용 여부는 기존 요구사항/코드/데이터를 분석한 뒤 결정한다.

불명확하면 코드 변경 전에 분석 결과에서 명시한다.

---

# 29. Playlist 변경 Transaction

다음 작업은 하나의 transaction에서 처리한다.

```text
중간 삽입
삭제
순서 이동
전체 교체
일괄 재정렬
```

예:

```text
Controller
  ↓
PlaylistApplicationService
  ↓
Transaction
  ├─ validate owner
  ├─ validate track
  ├─ shift sequence
  ├─ insert/update/delete
  └─ commit
```

오류 발생 시 rollback한다.

---

# 30. MariaDB Deadlock / Lock Timeout 처리

Playlist 순서 변경처럼 여러 row를 update하면 deadlock 가능성이 있다.

다음 오류를 처리한다.

```text
1213 Deadlock
1205 Lock wait timeout
```

검토할 내용:

```text
transaction 범위를 최소화
항상 동일한 순서로 row update
불필요한 SELECT 제거
필요한 index 확보
```

재시도가 필요하다면 무제한 retry 금지.

최대 1~3회 bounded retry 정도만 검토하고, 프로젝트 정책에 맞게 구현한다.

---

# 31. 날짜 기반 Playlist API 정리

현재 다음과 같은 중복 의미 API가 있다면 정리한다.

```text
GET /playlists/by-date
GET /playlists?date=...
```

하루에 Playlist 여러 개를 허용한다면 권장:

```http
GET /playlists?playDate=2026-09-12
```

목록 반환.

이 경우:

```text
playDate UNIQUE
```

를 사용하지 않는다.

반대로 하루 하나가 명확한 비즈니스 규칙이면 DB UNIQUE로 강제한다.

현재 서비스 목적과 기존 클라이언트 사용처를 먼저 분석하고 결정한다.

---

# 32. Entity 직접 반환 제거

Controller가 TypeORM Entity를 그대로 반환하는 부분을 찾아라.

다음 DTO를 도입한다.

```text
ArtistResponseDto
TrackResponseDto
PlaylistResponseDto
PlaylistItemResponseDto
AudioAssetResponseDto
```

예:

```ts
export class TrackResponseDto {
  id: number;

  title: string;

  bpm: number | null;

  artist: {
    id: number;
    name: string;
  };

  durationMs: number | null;
}
```

Entity 내부 컬럼이 API JSON에 자동 노출되지 않게 한다.

---

# 33. Request DTO Validation 점검

다음 DTO를 점검한다.

```text
CreateArtistDto
UpdateArtistDto

CreateTrackDto
UpdateTrackDto
TrackQueryDto

CreatePlaylistDto
UpdatePlaylistDto

AddPlaylistItemDto
MovePlaylistItemDto

CreateAudioAssetDto
```

검증 예:

```text
title 길이
name 길이

bpm 범위
page
limit

seq >= 1

enum whitelist
URL / storageKey 형식
```

`ValidationPipe`:

```text
whitelist: true
forbidNonWhitelisted: true
transform: true
```

사용 여부를 확인한다.

---

# 34. Soft Delete 검토

Track이 Playlist에서 사용된 뒤 삭제되는 경우를 고려한다.

Track:

```text
deletedAt
```

도입을 검토한다.

기본 사용자 조회에서는 제외한다.

관리자는 필요 시 포함할 수 있도록 한다.

Artist는 Track이 존재하면 FK RESTRICT가 우선이다.

AudioAsset은 실제 파일 삭제와 DB 삭제를 분리해 처리한다.

---

# 35. MusicService Facade 분리

현재 하나의 `MusicService`가 Artist / Track / Playlist의 많은 use-case를 모두 주입한다면 단계적으로 분리한다.

권장:

```text
ArtistApplicationService

TrackApplicationService

PlaylistApplicationService

AudioAssetApplicationService
```

Controller:

```text
ArtistController
TrackController
PlaylistController
AudioAssetController
```

단, 구조 변경 자체가 목적이 아니다.

기존 기능이 안정적으로 유지되는 범위에서 진행한다.

---

# 36. Repository Port 개선

단순 Entity CRUD 복사 수준을 넘어서 실제 use-case 의미를 표현한다.

예:

```ts
TrackRepository {
  findById();
  search(criteria);
}

PlaylistRepository {
  findOwnedById();
  findPageByOwner();
}

PlaylistItemRepository {
  replaceItems();
  moveItem();
}
```

단, 너무 많은 추상화는 추가하지 않는다.

실제 application use-case에서 필요한 operation만 port에 추가한다.

---

# 37. DB Query Logging

운영에서는 SQL 전체 로그를 항상 켜지 않는다.

환경 변수로 분리한다.

```text
development
DB_LOGGING=true

production
DB_LOGGING=false
```

Slow Query 확인을 위한 별도 방식도 검토한다.

MariaDB slow query log는 애플리케이션 logging과 별개임을 문서화한다.

---

# 38. Structured Logging 보강

다음 중요한 변경 이벤트는 구조화 로그를 남긴다.

```text
track create/update/delete

playlist create/update/delete

playlist item add/remove/move

audio asset upload/delete

authorization denied

DB connection error

transaction rollback
```

민감 정보 금지:

```text
password
JWT
OAuth token
full signed URL
```

---

# 39. MariaDB Charset

음악 제목/Artist는 다국어 문자를 사용할 수 있다.

DB/table/column 문자셋을 점검한다.

권장:

```text
utf8mb4
```

collation은 현재 MariaDB 버전과 기존 DB 정책을 확인해서 결정한다.

기존 운영 DB collation을 무조건 바꾸지 않는다.

---

# 40. MariaDB Timestamp / Timezone

EC2 / NestJS / MariaDB timezone 차이를 점검한다.

원칙:

```text
DB 저장: UTC 권장
API 반환: ISO 8601
사용자 표시: Client timezone
```

현재 시스템이 이미 KST 기준으로 저장하고 있다면 즉시 migration하지 말고 영향도부터 분석한다.

---

# 41. DB Connection Pool

다음 값을 점검한다.

```text
connectionLimit
connectTimeout
queue behavior
idle connection
```

EC2 인스턴스 스펙 및 예상 동시 접속량을 모르므로 과도한 connection pool을 기본값으로 두지 않는다.

초기 예:

```text
5~10
```

정도로 구성하고 실제 부하테스트/모니터링 후 조정할 수 있도록 환경 변수화한다.

---

# 42. DB Backup 운영 문서 추가

애플리케이션 코드뿐 아니라 EC2 MariaDB 운영 문서도 추가한다.

최소 내용:

```text
DB dump
restore

migration
rollback

backup location
retention

deployment procedure
```

예:

```bash
mariadb-dump \
  -u <user> \
  -p \
  music_db \
  > music_db_$(date +%Y%m%d_%H%M%S).sql
```

실제 password를 command history에 노출하지 않는 운영 방법을 문서화한다.

---

# 43. EC2 MariaDB 보안 체크

MariaDB를 외부 인터넷에 직접 노출하지 않는 방향을 우선 검토한다.

확인:

```text
bind-address
AWS Security Group
3306 inbound rule
local/private IP only
MariaDB user host restriction
```

NestJS와 동일 EC2라면 가능하면:

```text
127.0.0.1:3306
```

만 사용한다.

별도 EC2라면 private network + Security Group 제한을 우선한다.

---

# 44. 테스트 전략

현재 unit test만 통과하는 상태에서 끝내지 않는다.

최소:

```text
Unit
Integration
E2E
```

3단계로 보완한다.

---

# 45. Unit Test

검증:

```text
Artist use-case

Track search criteria

Playlist ownership

Playlist item validation

AudioAsset state

DB error mapping
```

Repository는 mocking 가능하다.

---

# 46. MariaDB Integration Test

실제 MariaDB 기반 테스트 환경을 구성할 수 있다면 integration test를 추가한다.

검증 대상:

```text
FK

UNIQUE

transaction rollback

deadlock/lock error mapping 가능한 부분

soft delete

query filter

pagination
```

Docker가 프로젝트에 있다면 테스트용 MariaDB container 사용을 검토한다.

운영 EC2 MariaDB를 테스트 DB로 사용하지 않는다.

---

# 47. E2E Test

Supertest 등을 사용해 확인한다.

```text
401
403
404
409
400
500/503 정책

ValidationPipe

JWT Guard

Roles

Response DTO

Pagination response

Track filter

Playlist owner isolation
```

---

# 48. 반드시 추가할 테스트 케이스

```text
DB 연결 실패

없는 DB 설정

잘못된 DB credentials

Duplicate Artist 정책

없는 Artist로 Track 생성

Track 참조 Artist 삭제

Track pagination

잘못된 sort field

BPM 범위 오류

Playlist owner 아님

Playlist seq 중복

Playlist Track 중복

Playlist 중간 삽입

Playlist 이동

Playlist 삭제 후 seq 정렬

transaction 중간 실패 rollback

AudioAsset 없는 Track

AudioAsset upload 상태
```

---

# 49. npm scripts 점검

필요하다면 다음을 추가한다.

```json
{
  "scripts": {
    "db:check": "...",
    "db:create": "...",
    "migration:generate": "...",
    "migration:run": "...",
    "migration:revert": "...",
    "migration:show": "..."
  }
}
```

현재 TypeORM CLI 설정 방식에 맞게 작성한다.

복사만 가능한 잘못된 예제 command를 넣지 말고 실제 프로젝트 path와 DataSource 위치를 확인해서 작성한다.

---

# 50. Production 배포 순서 문서화

권장:

```text
1. DB backup

2. application build

3. migration status 확인

4. migration 실행

5. NestJS process restart/reload

6. health check

7. API smoke test

8. log 확인
```

PM2 사용 시 기존 프로젝트 방식이 있다면 그것에 맞춘다.

---

# 51. Migration 실패 정책

migration 실패 시 API 프로세스를 무조건 실행시키지 않는다.

배포 pipeline에서:

```text
migration failure
    ↓
deployment stop
```

하도록 한다.

API startup 과정에서 임의로 migration을 자동 실행하는 방식은 기존 운영 정책이 없다면 피한다.

---

# 52. 기존 데이터 Migration

새 UNIQUE constraint를 추가하기 전 반드시 기존 위반 데이터를 검사한다.

예:

```sql
SELECT playlist_id, seq, COUNT(*)
FROM playlist_track
GROUP BY playlist_id, seq
HAVING COUNT(*) > 1;
```

중복 Track 확인:

```sql
SELECT playlist_id, track_id, COUNT(*)
FROM playlist_track
GROUP BY playlist_id, track_id
HAVING COUNT(*) > 1;
```

constraint 추가 전에 정리 방법을 제안한다.

기존 데이터를 자동 삭제하지 않는다.

---

# 53. 기존 Client 호환성

Response DTO 도입 또는 API 변경 시 기존 Client 영향도를 분석한다.

특히:

```text
Web Player
Admin
Mobile
Cocos Creator
```

등에서 Entity JSON 구조를 직접 사용하는지 검색한다.

Client를 함께 확인할 수 없는 repository라면:

```text
breaking change 가능성
```

을 결과에 명시한다.

---

# 54. 현재 작업에서 하지 말아야 할 것

다음은 명확한 근거 없이 도입하지 않는다.

```text
Microservice 전환

Kafka

Redis

Elasticsearch

CQRS framework 전체 도입

Event Sourcing

GraphQL

Kubernetes

Repository 전체 재작성

ORM 교체

MariaDB → PostgreSQL 전환
```

현재 목적은 Music API + EC2 MariaDB 안정화다.

---

# 55. 우선순위

작업 순서를 반드시 지킨다.

## P0

```text
DB 설정 검증

MariaDB connection

Migration

DB error handling

FK / UNIQUE constraint

Playlist transaction

Playlist owner authorization

Production synchronize=false
```

## P1

```text
Track query 개선

Response DTO

AudioAsset 구조

Health check

Integration test

E2E test
```

## P2

```text
MusicService facade 분리

폴더 구조 이동

검색 최적화

Slow query 분석

추가 index
```

---

# 56. 작업 수행 절차

GitHub Copilot은 바로 코드를 수정하기 전에 아래 순서로 진행하라.

## STEP 1 - 코드 분석

다음을 출력한다.

```text
현재 구조
현재 DB 설정
현재 Entity
현재 Migration
현재 Repository
현재 API
현재 Test
```

그리고:

```text
이미 구현됨
부분 구현
미구현
위험 요소
```

로 나눈다.

---

## STEP 2 - 수정 계획

파일 단위 작업 계획을 작성한다.

예:

```text
[MODIFY]
src/app.module.ts

[ADD]
src/database/data-source.ts

[ADD]
src/database/database-error.mapper.ts

[ADD]
src/database/migrations/...

[MODIFY]
src/music/track/...

[MODIFY]
src/music/playlist/...

[ADD]
src/music/audio-asset/...
```

각 파일마다:

```text
목적
변경 내용
영향 범위
```

를 설명한다.

---

## STEP 3 - DB Migration 계획

DDL을 먼저 제시한다.

다음 항목:

```text
FK
UNIQUE
INDEX
NOT NULL
DEFAULT
soft delete
ownerId
AudioAsset
```

을 구분한다.

---

## STEP 4 - 코드 수정

기존 코딩 스타일을 따른다.

다음 원칙:

```text
불필요한 전체 재작성 금지

기존 DI token 유지

기존 port/adapter 재사용

기존 테스트 최대한 유지

breaking API 최소화
```

---

## STEP 5 - 테스트 추가

수정한 기능은 반드시 테스트를 추가한다.

최소:

```text
unit

integration

e2e
```

가능 범위를 작성한다.

---

## STEP 6 - 실행 검증

가능하다면 다음을 실행한다.

```bash
npm run build
```

```bash
npm test -- --runInBand
```

```bash
npm run test:e2e
```

그리고 migration 관련 command.

실행하지 못한 항목은 이유를 명확히 작성한다.

---

# 57. 최종 결과 보고 형식

작업 완료 후 다음 형식으로 보고한다.

```text
1. 분석 결과

2. 발견된 DB 문제

3. 적용한 DB 설정

4. 추가/수정 Migration

5. Entity 변경

6. API 변경

7. DB 예외처리

8. Transaction 적용

9. 권한 처리

10. AudioAsset 적용 여부

11. 테스트 결과

12. 아직 남아 있는 위험

13. 운영 배포 전 확인 항목
```

---

# 58. 반드시 확인할 최종 체크리스트

## MariaDB

```text
[ ] MariaDB driver 정상

[ ] DB 연결 환경 변수 validation

[ ] production synchronize=false

[ ] Migration 존재

[ ] utf8mb4

[ ] FK

[ ] UNIQUE

[ ] Index

[ ] Connection Pool

[ ] Health Check

[ ] DB backup/restore 문서
```

## Track

```text
[ ] Artist FK

[ ] Search

[ ] Artist filter

[ ] BPM filter

[ ] Pagination

[ ] Sort whitelist

[ ] Response DTO

[ ] Soft delete 검토
```

## Playlist

```text
[ ] ownerId

[ ] owner authorization

[ ] PlaylistItem seq UNIQUE

[ ] 동일 Track 중복 정책

[ ] Transaction

[ ] Move

[ ] Insert

[ ] Delete reorder

[ ] 날짜 API 정책
```

## AudioAsset

```text
[ ] Track과 음원 파일 분리

[ ] storageKey

[ ] mimeType

[ ] fileSize

[ ] status

[ ] checksum 검토

[ ] S3 연동 경계
```

## Error

```text
[ ] Duplicate

[ ] FK

[ ] Deadlock

[ ] Lock timeout

[ ] Connection error

[ ] Error code

[ ] 내부 SQL 정보 API 노출 금지
```

## Test

```text
[ ] Unit

[ ] MariaDB Integration

[ ] E2E

[ ] Transaction rollback

[ ] Authorization

[ ] Constraint
```

---

# 59. 가장 중요한 설계 원칙

이번 작업에서는 다음 방향을 유지한다.

```text
NestJS
  |
  v
Application / Use Case
  |
  v
Repository Port
  |
  v
TypeORM Adapter
  |
  v
MariaDB
```

그리고 음악 도메인은:

```text
Artist
   |
   v
Track
   |
   +---- AudioAsset

User
   |
   v
Playlist
   |
   v
PlaylistItem
   |
   v
Track
```

구조를 목표로 한다.

---

# 60. 최종 목표

이번 작업의 목표는 단순히 API endpoint를 늘리는 것이 아니다.

최종적으로 다음 요구를 안정적으로 지원해야 한다.

```text
전체 음악 조회

특정 Track 조회

검색

Artist별 Track 조회

BPM 기반 조회

Playlist 생성/조회/편집

Playlist 순서 관리

개인 Playlist 권한 관리

실제 음원 파일 관리

MariaDB 데이터 무결성

Transaction

DB 장애 대응

Migration

Integration/E2E Test
```

그리고 향후:

```text
Admin Web
Web Player
Mobile App
Cocos Creator Client
```

에서 공통으로 사용할 수 있는 Music Backend API로 확장 가능한 상태를 만든다.

---

# Copilot 실행 지시

이제 프로젝트 전체를 분석한 뒤 다음 순서로 진행하라.

```text
1. 현재 구현 분석

2. MariaDB / TypeORM 상태 분석

3. 누락된 DB 운영 요소 식별

4. 변경 계획 작성

5. Migration 설계

6. DB 예외처리 보완

7. Artist / Track / Playlist 구조 수정

8. AudioAsset 추가 검토 및 구현

9. 권한 / Transaction 적용

10. Response DTO 정리

11. Test 추가

12. Build / Test / Migration 검증

13. 변경 결과 보고
```

중요:

```text
분석 없이 바로 대규모 수정하지 마라.

기존 동작을 우선 보존하라.

실제 운영 DB 데이터를 삭제하거나 임의 변경하지 마라.

운영 환경에서 synchronize=true를 사용하지 마라.

DB 비밀번호/secret을 코드나 로그에 기록하지 마라.

불확실한 제품 정책은 임의 확정하지 말고 현재 코드와 기존 데이터에서 근거를 찾은 뒤,
확정할 수 없는 항목은 TODO/결정 필요 항목으로 결과 보고서에 남겨라.
```
