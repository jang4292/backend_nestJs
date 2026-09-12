# Music API 서버 로직 재점검 및 구조 재정리 보고서

작성일: 2026-09-12

## 1. 목적과 검토 범위

이 문서는 `src/music` 모듈의 현재 구현을 재점검하고, 다음 개발자 또는 AI가 안전하게 설계 보완과 구현을 이어갈 수 있도록 현재 상태, 확인된 리스크, 목표 구조, 작업 순서를 정리한 인수인계 문서다.

검토 대상은 Artist, Track, Playlist, PlaylistTrack API와 이들이 사용하는 DTO, 유스케이스, repository port, TypeORM adapter, 엔티티, 마이그레이션, 테스트다. 인증 모듈과 사용자 도메인은 연동 지점만 검토했으며 변경하지 않았다.

## 2. 검증 결과

2026-09-12 기준 아래 명령을 실행했다.

```bash
npm test -- --runInBand src/music --passWithNoTests
```

결과는 8개 테스트 스위트, 44개 테스트 통과다. 현재 단위 테스트 범위에서는 Artist/Track CRUD, 트랙 목록 필터와 페이지네이션, Playlist CRUD의 주요 성공 및 일부 Not Found 경로가 정상 동작한다.

다만 이 결과는 HTTP 계약, 인증된 사용자의 권한, 실제 PostgreSQL 제약, 동시 요청, 트랜잭션을 검증하지 않는다. 따라서 "테스트 통과"는 기본 로직의 회귀가 없다는 근거이지, 운영 준비 완료 판정은 아니다.

## 3. 현재 구조와 요청 흐름

현재 모듈은 이미 다음과 같은 헥사고날 구조를 사용한다.

```text
HTTP Controller
  -> MusicService facade
    -> Use case
      -> Repository port
        -> TypeORM repository adapter
          -> PostgreSQL entities/tables
```

| 계층              | 현재 위치                         | 역할                                              |
| ----------------- | --------------------------------- | ------------------------------------------------- |
| Interface         | `src/music/interface`             | `MusicController`, request DTO                    |
| Facade            | `src/music/music.service.ts`      | 20개 유스케이스 호출을 controller에 노출          |
| Application       | `src/music/application/use-cases` | Artist, Track, Playlist, PlaylistTrack 유스케이스 |
| Port              | `src/music/application/ports`     | 영속성 추상화와 DI token                          |
| Infrastructure    | `src/music/infrastructure`        | TypeORM repository adapter                        |
| Persistence model | `src/music/entities`              | Artist, Track, Playlist, PlaylistTrack 엔티티     |
| Composition root  | `src/music/music.module.ts`       | TypeORM entity, adapter, port, use case DI 등록   |

현재 공개 API는 모두 `JwtAuthGuard` 보호 아래에 있다. 제공 기능은 아래와 같다.

| 리소스        | 제공 기능                                                      |
| ------------- | -------------------------------------------------------------- |
| Artist        | 목록, 단건, 생성, 수정, 삭제                                   |
| Track         | 생성, 단건, 수정, 삭제, 검색/artist/BPM/정렬/페이지네이션 목록 |
| Playlist      | 생성, 단건, 수정, 삭제, 목록, 날짜별 단건 조회                 |
| PlaylistTrack | 플레이리스트 트랙 목록, 추가, 순서/메모 수정, 제거             |

Artist 정규화는 `1760000001000-NormalizeArtists.ts`에서 수행되었고, Track은 이제 Artist를 필수 `ManyToOne`으로 참조한다. Artist 삭제는 Track 참조가 있을 때 DB의 `RESTRICT`를 `409 Conflict`로 변환하도록 구현되어 있다.

## 4. 확인된 리스크와 개선 우선순위

### P0: 변경 권한과 소유권 모델 부재

모든 Music API가 JWT 인증은 요구하지만, 생성/수정/삭제 시 요청 사용자가 해당 리소스의 소유자인지 또는 관리자/편집자인지를 판정하지 않는다. 현재 `Playlist`와 `Track`에는 `ownerId`, `createdBy`, `visibility`, 역할 정보가 없다. 로그인한 모든 사용자가 모든 음악 데이터를 변경할 수 있는 계약이다.

권장 결정:

1. 데이터가 전역 카탈로그라면 Track/Artist의 쓰기를 `admin` 또는 `editor` role로 제한한다.
2. 사용자별 플레이리스트라면 Playlist에 `ownerId` FK를 추가하고, 조회 범위와 수정/삭제 권한을 `ownerId`로 강제한다.
3. 공유 플레이리스트가 필요하면 별도 `playlist_member` 테이블과 `owner/editor/viewer` 역할을 추가한다.

### P0: PlaylistTrack 무결성과 동시성 보장 부재

`playlist_track`에는 `(playlistId, seq)` 인덱스만 있고 유니크 제약이 없다. 따라서 동일한 재생 순서가 여러 건 저장될 수 있다. 또한 `(playlistId, trackId)` 제약도 없어 같은 트랙의 중복 삽입을 금지할 수 없다. `AddTrackToPlaylistUseCase`는 사전 존재 확인 후 저장하지만 두 요청이 동시에 실행될 때 중복을 막지 못한다.

권장 결정:

1. 제품 규칙을 먼저 확정한다: 한 플레이리스트에서 동일 Track을 여러 번 허용하는지, `seq`가 연속 정수여야 하는지.
2. 중복 Track을 허용하지 않는다면 `UNIQUE (playlistId, trackId)`를 추가한다.
3. 각 순서가 하나여야 한다면 `UNIQUE (playlistId, seq)`를 추가한다.
4. 순서 변경, 삽입, 삭제, 일괄 재정렬은 하나의 transaction 안에서 수행한다.
5. DB unique violation은 application 계층에서 일관된 `409 Conflict` API 오류로 매핑한다.

### P1: `MusicService` facade와 `MusicModule`의 높은 집결도

`MusicService`는 20개 유스케이스를 생성자 주입하고 동일한 수의 단순 위임 메서드를 제공한다. `MusicModule`도 네 도메인의 adapter, port, use case를 모두 한 배열에 등록한다. 실제 도메인 로직은 유스케이스로 잘 분리되어 있지만, 새로운 기능을 추가할 때 두 개의 대형 파일을 항상 수정하게 된다.

이는 즉시 장애를 일으키는 문제는 아니다. 그러나 Artist/Track/Playlist 기능이 더 늘어날수록 의존성 그래프와 테스트 fixture가 커지고, controller가 어떤 유스케이스에 실제 의존하는지 흐려진다.

### P1: HTTP 응답 및 오류 계약의 불균일 위험

성공 응답은 TypeORM entity를 직접 반환한다. 도메인 변경이나 relation/eager 설정 변경이 API JSON을 바꿀 수 있다. 예를 들어 Track의 `artist`는 eager relation이고 PlaylistTrack 조회는 `track.artist` relation을 명시적으로 적재한다.

`NotFoundException`, `ConflictException`은 사용하지만 리소스별 오류 코드, 응답 DTO, 목록 메타데이터 표준은 문서화되어 있지 않다. 다른 AI가 기능을 추가할 때 데이터베이스 모델을 HTTP API에 직접 노출할 가능성이 높다.

### P1: 날짜 기반 Playlist 계약의 모호성

`GET /music/playlists/by-date?date=...`는 한 건을 반환하고, `GET /music/playlists?date=...`는 목록을 반환한다. 하지만 `playlist.playDate`에 유니크 제약이 없으므로 같은 날짜의 Playlist가 여러 개면 `findByPlayDate`가 어떤 한 건을 선택하는지 repository 구현과 DB 정렬에 의존한다.

"하루 한 플레이리스트"가 규칙이면 DB `UNIQUE (playDate)`와 생성/수정 충돌 처리가 필요하다. 여러 개를 허용하는 규칙이면 단건 날짜 API는 제거하거나 명시적 식별자/정렬 기준을 추가해야 한다.

### P2: 테스트 공백

유스케이스 테스트는 Artist에 집중되어 있으며, PlaylistTrack 유스케이스는 전용 spec이 없다. `MusicService` 테스트는 adapter와 use case를 실제로 조립하는 방식이라 facade 위임 이상의 여러 구현을 한 테스트에서 함께 검증한다. HTTP controller/E2E 테스트는 없어서 guard, `ValidationPipe`, path parameter 변환, Swagger/응답 계약을 확인하지 못한다.

## 5. 목표 구조

기존 port/adapter 방향은 유지한다. 대규모 재작성보다 도메인 경계를 드러내고, 정책과 데이터 무결성을 application 계층과 DB 제약에 함께 배치한다.

```text
src/music/
  artist/
    interface/                 # artist.controller.ts, DTO, response DTO
    application/               # artist command/query use case
    domain/                    # Artist 정책 및 domain error
    infrastructure/            # TypeORM adapter
  track/
    interface/
    application/
    domain/
    infrastructure/
  playlist/
    interface/                 # playlist + playlist-item API
    application/               # 편집 transaction orchestration
    domain/                    # 순서/중복/공유 규칙
    infrastructure/
  shared/
    application/ports/
    interface/auth/            # current user, role guard/decorator
  music.module.ts              # 하위 provider 배열을 조합만 수행
```

작은 단계로 진행한다면 물리적 폴더 이동은 마지막에 한다. 먼저 controller가 facade 대신 각 도메인 application service 또는 개별 use case를 직접 주입하도록 바꾸고, `MusicService`를 제거한다. controller가 너무 많은 use case를 직접 의존하게 되면 `ArtistApplicationService`, `TrackApplicationService`, `PlaylistApplicationService`처럼 도메인별 facade만 유지한다. 단일 전역 facade는 유지하지 않는다.

`PlaylistApplicationService` 또는 command use case는 다음처럼 transaction boundary를 소유해야 한다.

```text
Controller -> Playlist command use case
  -> authorize(currentUser, playlist)
  -> transaction
       -> validate tracks and sequence
       -> persist playlist items
       -> reorder items when needed
  -> response mapper
```

Repository port는 entity CRUD의 단순 복사보다 유스케이스가 필요한 원자 연산을 표현해야 한다. 예: `replaceItems(playlistId, items)`, `moveItem(playlistId, itemId, targetSeq)`, `findOwnedById(playlistId, userId)`.

## 6. 권장 API 계약

### 리소스 경계

1. Artist: 운영 카탈로그 메타데이터. 일반 사용자는 읽기만, 운영 역할만 쓰기.
2. Track: Artist에 속하는 전역 카탈로그. Artist와 같은 쓰기 정책 적용.
3. Playlist: `ownerId`를 가진 사용자 리소스 또는 명시적 공유 리소스.
4. Playlist item: 독립 CRUD보다 Playlist aggregate 내부의 순서 있는 항목으로 취급.

### 응답과 오류

1. entity 대신 `ArtistResponseDto`, `TrackResponseDto`, `PlaylistResponseDto`, `PlaylistItemResponseDto`를 반환한다.
2. 목록 응답은 `{ items, page, limit, total }` 형식으로 통일한다. Playlist 목록도 pagination 도입 여부를 명시한다.
3. 오류 본문에 안정적인 machine-readable code를 둔다. 예: `PLAYLIST_NOT_FOUND`, `PLAYLIST_FORBIDDEN`, `DUPLICATE_PLAYLIST_SEQUENCE`, `PLAYLIST_DATE_CONFLICT`.
4. `POST /playlists/:playlistId/tracks`의 `seq` 충돌 정책을 API 문서에 명시한다. 권장안은 지정 위치 삽입 후 기존 항목의 `seq`를 뒤로 이동시키는 방식이다.

### 날짜 API 결정 사항

아래 중 하나를 확정해야 한다.

| 선택지               | DB/API 조치                                                                            |
| -------------------- | -------------------------------------------------------------------------------------- |
| 날짜당 한 Playlist   | `playlist.playDate` unique migration, 중복 생성/수정 시 `409`, `by-date` 단건 API 유지 |
| 날짜당 여러 Playlist | `by-date`를 목록 API로 통합하거나 정렬/페이지네이션 추가, 단건 API 제거                |
| 날짜는 단순 태그     | `by-date` 단건 API 제거, 목록 필터만 유지                                              |

## 7. 구현 순서

### 1단계: 정책과 DB 제약 확정

1. Playlist의 소유/공유 모델과 Track/Artist의 쓰기 role을 결정한다.
2. 중복 Track 및 `seq` 규칙, 날짜당 Playlist 개수 규칙을 결정한다.
3. 결정된 규칙에 맞춰 TypeORM migration을 추가한다. 기존 migration은 수정하지 않는다.
4. 운영 데이터에 제약 위반 행이 있는지 사전 쿼리로 확인하고 정리 계획을 만든다.

### 2단계: application 경계 정리

1. `CurrentUser`를 유스케이스 입력으로 전달한다.
2. Playlist 생성/수정/삭제/item 편집에 authorization policy를 추가한다.
3. 여러 item을 변경하는 작업에 transaction-capable port 또는 unit of work를 도입한다.
4. `MusicService` facade를 도메인별 application service로 대체한 뒤 제거한다.
5. module provider 등록을 `artistProviders`, `trackProviders`, `playlistProviders` 같은 도메인별 배열로 분리한다.

### 3단계: interface 계약 정리

1. controller를 Artist/Track/Playlist controller로 분리한다.
2. request DTO에 Swagger decorator와 값 제약을 일관되게 추가한다.
3. response DTO와 mapper를 도입하고 entity 직접 반환을 중단한다.
4. API examples와 Swagger 설명을 새로운 오류 코드 및 순서 정책에 맞춘다.

### 4단계: 테스트와 관측성 보강

1. 각 PlaylistTrack 유스케이스의 성공, 부모/트랙 없음, 소속 불일치, 중복, 순서 충돌 테스트를 추가한다.
2. 권한 거부와 owner isolation 테스트를 추가한다.
3. PostgreSQL 기반 integration test로 FK/unique constraint와 transaction rollback을 검증한다.
4. Supertest E2E로 guard, validation, status code, response schema를 검증한다.
5. 변경/삭제, 재정렬, 권한 거부에 구조화된 audit log를 추가한다.

## 8. 최소 테스트 매트릭스

| 시나리오                        | 계층                   | 기대 결과                                         |
| ------------------------------- | ---------------------- | ------------------------------------------------- |
| 유효하지 않은 DTO               | E2E                    | `400`, 허용되지 않은 필드는 거부                  |
| 미인증 요청                     | E2E                    | `401`                                             |
| 타 사용자의 Playlist 수정/삭제  | E2E                    | `403` 또는 정보 은닉 정책에 따른 `404`            |
| 없는 Artist로 Track 생성/변경   | Use case + E2E         | `404`                                             |
| Track이 있는 Artist 삭제        | Integration            | `409`                                             |
| 같은 Playlist의 중복 `seq`      | Integration            | DB 제약 및 `409`                                  |
| 같은 Playlist에 동일 Track 추가 | Integration            | 제품 규칙에 따른 성공 또는 `409`                  |
| item 중간 삽입/이동/삭제        | Use case + Integration | 순서가 유일하고 연속적                            |
| 날짜 기반 Playlist 조회         | E2E                    | 확정한 단건/목록 계약과 일치                      |
| 트랙 목록 경계값                | E2E                    | `limit` 1~100, 정렬 whitelist, page metadata 일치 |

## 9. 다음 AI 또는 개발자에게 전달할 결정 질문

구현을 시작하기 전에 아래 질문에 답해야 한다.

1. Music 데이터는 전역 카탈로그인가, 사용자별 개인 데이터인가?
2. Artist와 Track을 수정할 수 있는 역할은 무엇인가?
3. Playlist는 개인 소유, 완전 공개, 멤버 기반 공유 중 어느 모델인가?
4. 동일 Track을 하나의 Playlist에 반복 삽입할 수 있는가?
5. `seq`는 단순 표시 값인가, 유일하고 연속적인 재생 순서인가?
6. 하나의 `playDate`에 Playlist를 몇 개까지 허용하는가?
7. 기존 클라이언트가 entity 그대로의 응답 JSON에 의존하는가? 응답 DTO 전환의 호환성 기간이 필요한가?
8. PostgreSQL만 운영 대상으로 고정할 수 있는가? 고정할 수 있다면 unique violation 변환과 transaction 테스트를 PostgreSQL 기준으로 작성한다.

## 10. 현재 결론

기본적인 도메인 분리와 CRUD 유스케이스는 이미 갖춰져 있고, 집중 단위 테스트도 통과한다. 다음 투자 우선순위는 새 CRUD를 더 추가하는 것이 아니라 권한, Playlist 항목의 DB 무결성, transaction, HTTP 응답 계약을 확정하는 일이다. 이 네 가지를 먼저 고정한 뒤 facade/module을 도메인 단위로 정리하면 기능 확장과 AI 협업 모두에서 변경 충돌과 운영 리스크를 크게 줄일 수 있다.
