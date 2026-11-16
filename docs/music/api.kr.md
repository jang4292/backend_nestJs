# Music REST API 레퍼런스

> 검토 기준일: 2026-11-17 · 스테이징된 `src/music` 구현 기준; 실제 DB migration 적용 여부는 환경별 확인
>
> 전체 서비스 API 요약은 [제품 API 명세](../product/api-spec.kr.md), curl 예제는 [API_EXAMPLES.md](../../API_EXAMPLES.md)를 참고합니다.
> Legacy API(`/music/legacy/*`)는 데이터 이관·검증 후 종료 예정입니다([결정 문서 2.1](decisions.md#21-catalog-단일-기준-legacy-종료)). 신규 클라이언트는 Catalog API만 사용합니다.

## 1. 공통 사항

### 인증과 권한

| 권한 표기 | 의미 |
| --- | --- |
| public | 인증 불필요 |
| jwt | `Authorization: Bearer <accessToken>` 필요 (`@Authenticated()`) |
| admin | JWT + `users.role = 'admin'` 필요 (`@AdminOnly()`). 일반 사용자 토큰이면 403 |

모든 쓰기(POST/PATCH/DELETE)는 admin 전용입니다. [music-authorization.spec.ts](../../src/music/music-authorization.spec.ts)는 기존 Catalog·Legacy 컨트롤러의 쓰기 권한을 검사하며 새 관리·업로드 컨트롤러는 이 검사에 아직 포함되지 않습니다.

### 공통 오류 envelope

모든 오류는 `GlobalExceptionFilter`를 거쳐 아래 형식으로 반환됩니다.

```json
{ "ok": false, "requestId": "…", "errorCode": "NOT_FOUND", "message": "Track not found" }
```

| HTTP | errorCode | Music에서의 대표 상황 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | DTO 검증 실패, 날짜 형식 오류, position 중복, reorder 항목 불일치 |
| 401 | `UNAUTHORIZED` | 토큰 없음·만료·변조 |
| 403 | `FORBIDDEN` | admin이 아닌 사용자의 쓰기 요청 |
| 404 | `NOT_FOUND` | Track/Playlist/Artist/AudioAsset 없음, 미공개 Playlist 공개 조회 |
| 409 | `FOREIGN_KEY_CONSTRAINT` | 참조 중인 Artist/Track 삭제 시도 |

### 공통 검증 규칙

- 경로 파라미터 ID는 정수입니다(`ParseIntPipe`). 정수가 아니면 400.
- 목록 `limit`은 최대 100입니다.
- `playDate`·`date`는 `YYYY-MM-DD` 형식입니다.
- BPM은 0~400, 문자열 필드는 선언된 최대 길이를 따릅니다.

---

## 2. Catalog API (`/music`) — 현재 기준 모델

구현: [catalog-music.controller.ts](../../src/music/catalog/interface/catalog-music.controller.ts)

### 2.1 Track

#### `GET /music/tracks` — 공개 Track 목록 (public)

| Query | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `page` | int ≥ 1 | 1 | 페이지 번호 |
| `limit` | int 1~100 | 100 | 페이지 크기 |

응답은 최신순(`id DESC`) **배열**입니다. 현재는 `total` 등 페이지 메타데이터가 없습니다(개선 예정, [결정 문서 4장](decisions.md#4-남은-구현-및-검증-항목)).

```json
[{ "id": 1, "title": "Song A", "artist": "Artist X", "bpm": 120 }]
```

#### `GET /music/tracks/:id` — 공개 Track 상세 (public)

위와 같은 필드 구성의 단건. 없으면 404. 음원 URL은 포함하지 않습니다.

#### `POST /music/tracks` — Track 등록 (admin)

| Body 필드 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| `title` | string | ✅ | 1~200자, 앞뒤 공백 제거 |
| `artist` | string | ✅ | 1~200자, 앞뒤 공백 제거 |
| `bpm` | int | — | 0~400 |

Catalog Track의 `artist`는 호환성을 위한 표시 문자열입니다. 정규 아티스트·별칭과 공동 참여자는 관리 API에서 별도로 연결하며, 자동 동기화하지 않습니다.

#### `PATCH /music/tracks/:id` — Track 수정 (admin)

Body는 `POST`와 같은 필드의 부분 수정입니다.

#### `DELETE /music/tracks/:id` — Track 삭제 (admin)

Playlist 또는 사용 기록에 참조되는 Track은 FK `RESTRICT`로 409입니다. 로컬 업로드 파일이 있는 Track도 저장소 정리 기능이 없어 409로 거부됩니다.

```json
{ "deleted": true, "id": 1 }
```

### 2.2 AudioAsset (음원 파일 메타데이터)

기존 URL 메타데이터 등록과 별도로 로컬 파일 업로드·Range 재생을 지원합니다. AudioAsset 관리 조회에는 URL이나 내부 저장소 필드가 포함될 수 있어 admin 전용입니다. 기존 외부 URL만 있는 Asset은 재생 파일로 선택할 수 없습니다. S3 및 서명 URL은 미구현입니다.

#### `POST /music/tracks/:trackId/audio-assets` — 등록 (admin)

| Body 필드 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| `url` | string | — | http(s) 절대 URL, 2000자 이하 |
| `duration` | int | — | ≥ 0 (초) |
| `bpm` | int | — | 0~400. `Track.bpm`과 독립(자동 동기화 없음) |

Track이 없으면 404.

#### `GET /music/tracks/:trackId/audio-assets` — 목록 (admin)

> **알려진 이슈:** 현재 없는 Track ID에도 빈 배열 `[]`을 반환합니다. 404 처리로 정리 예정입니다.

#### `PATCH /music/audio-assets/:id` — 수정 (admin)

등록과 같은 필드의 부분 수정. 없으면 404.

#### `DELETE /music/audio-assets/:id` — 삭제 (admin)

로컬 업로드 파일은 저장소 정리 기능이 없어 409로 거부합니다. Playlist 항목 또는 사용 기록에서 참조하는 Asset도 FK에 의해 삭제할 수 없습니다.

```json
{ "deleted": true, "id": 2 }
```

### 2.3 공개 Playlist 조회 (public)

공개 응답은 [presenter](../../src/music/catalog/interface/presenters/catalog-playlist.presenter.ts)를 통과하며 **음원 URL, object key, 내부 timestamp를 절대 포함하지 않습니다**. `published` 상태만 노출됩니다.

#### `GET /music/public/playlists` — 공개 목록

| Query | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1~100 | 20 | |

정렬: `publishedAt DESC, id DESC`. 목록 항목에는 Track 상세 없이 `trackCount`만 포함됩니다.

```json
{
  "items": [
    {
      "id": 7, "title": "Morning set", "description": null,
      "playDate": null, "anonymousPlayable": false, "trackCount": 12
    }
  ],
  "total": 1, "page": 1, "limit": 20
}
```

#### `GET /music/public/playlists/:id` — 공개 상세

`published`가 아니거나 없으면 404. `tracks`는 `position` 오름차순입니다.

```json
{
  "id": 7, "title": "Morning set", "description": null,
  "playDate": null, "anonymousPlayable": false, "trackCount": 2,
  "tracks": [
    { "id": 1, "hasSelectedAudio": false, "position": 1, "track": { "id": 10, "title": "First", "artist": "Artist A", "bpm": 100 } },
    { "id": 2, "hasSelectedAudio": true, "position": 2, "track": { "id": 20, "title": "Second", "artist": "Artist B", "bpm": 120 } }
  ]
}
```

`hasSelectedAudio`는 해당 항목의 파일 ID 선택 여부입니다. 공개 콘텐츠 경로는 `published` 및 `anonymousPlayable=true`를 요구하고, 인증 콘텐츠 경로는 `published`와 JWT를 요구합니다. 실제 파일이 없거나 파일이 트랙과 일치하지 않으면 404입니다.

### 2.4 Playlist 관리 (admin)

관리 응답은 현재 entity를 그대로 반환합니다(응답 DTO 전환 예정).

#### `POST /music/playlists` — 생성

| Body 필드 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| `title` | string | ✅ | 1~200자 |
| `description` | string | — | 500자 이하 |
| `playDate` | string | — | `YYYY-MM-DD`. 날짜당 개수 제한 없음 |
| `anonymousPlayable` | boolean | — | 기본 false |

항상 `status: "draft"`, `publishedAt: null`로 생성됩니다.

#### `PATCH /music/playlists/:id/publish` — 공개 전환

`status`를 `published`로 바꾸고 `publishedAt`을 현재 시각으로 기록합니다.

> **현재 동작:** 상태 전이 제한이 없어 `archived`도 다시 publish할 수 있고, 재공개 시 `publishedAt`이 갱신됩니다. 목표 정책(`draft → published → archived`, archived→draft 복원)은 [결정 문서 2.5](decisions.md#25-playlist-상태-전이) 참고.

#### `POST /music/playlists/:playlistId/tracks` — Track 추가

| Body 필드 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| `trackId` | int | ✅ | ≥ 1 |
| `position` | int | ✅ | ≥ 1. 같은 Playlist 내 중복 불가(DB unique) |
| `note` | string | — | 255자 이하 |

- Playlist 또는 Track이 없으면 404.
- 이미 사용 중인 `position`이면 400 (`Playlist position is already occupied`). 동시 요청으로 발생한 DB unique 위반도 같은 400으로 변환됩니다.
- 동일 Track을 다른 position으로 여러 번 추가하는 것은 허용됩니다(확정 정책).

#### `PATCH /music/playlists/:playlistId/tracks/reorder` — 전체 순서 변경

```json
{ "items": [ { "id": 2, "position": 1 }, { "id": 1, "position": 2 } ] }
```

규칙:

1. Playlist의 **모든 항목을 정확히 한 번씩** 포함해야 합니다. 누락·중복·타 Playlist 항목이면 400.
2. `position` 중복이 있으면 400.
3. Playlist 행을 `pessimistic_write` 잠금으로 보호하고 항목을 transaction 안에서 읽고 씁니다. 같은 Playlist의 추가와 재정렬은 직렬화되므로, 잠금 대기 중 새 항목이 추가되면 오래된 재정렬 요청은 400으로 거부됩니다.
4. 임시 음수 position을 거쳐 최종 position을 저장하며 transaction으로 묶입니다.
5. 성공 시 `position ASC`로 정렬된 전체 항목(Track 포함)을 반환합니다.

> **남은 최적화:** 항목 수 상한은 없고, 재정렬 시 항목마다 임시·최종 위치를 저장해 2N회 UPDATE합니다. 동시 수정 정합성은 잠금과 격리된 MariaDB E2E로 검증합니다.

### 2.5 음악 관리, 파일 업로드 및 재생

상세 모델·요청 예시·통계 기준과 제한은 [카탈로그·사용 기록 초안](catalog-usage-prototype.kr.md)을 참고합니다. `/music/management/*`는 모두 admin 전용입니다.

| Method | Path | 권한 | 용도 |
| --- | --- | --- | --- |
| GET / POST | `/music/management/artists`, `/music/management/artists/:id/aliases` | admin | 정규 아티스트 및 별칭 등록·조회 |
| GET / POST | `/music/management/works` | admin | 작품 목록·등록 |
| PATCH | `/music/management/recordings/:id` | admin | 작품·참여 아티스트·녹음 메타데이터 지정 |
| GET | `/music/management/playlists`, `/music/management/playlists/:id` | admin | Playlist 및 항목 조회 |
| PATCH | `/music/management/playlist-items/:id/asset` | admin | 해당 트랙의 업로드 파일 선택·해제 |
| GET / POST | `/music/management/usages`, `/music/management/usages/:id` | admin | 사용 회차 생성·목록·상세. POST는 `/usages`만 지원 |
| PATCH / POST | `/music/management/usages/:id/items/:itemId`, `/music/management/usages/:id/confirm` | admin | 초안 사용 횟수 변경·회차 확정 |
| GET | `/music/management/statistics` | admin | 확정 회차의 녹음·작품·파일·아티스트 사용 횟수 집계 |
| POST | `/music/tracks/:id/upload` | admin | `multipart/form-data`의 `file`로 최대 50 MiB 로컬 음원 업로드 |
| GET | `/music/management/audio-assets/:id/content` | admin | 업로드된 파일 직접 재생 |
| GET | `/music/public/playlists/:playlistId/items/:itemId/content` | public | 공개 및 익명 재생 허용 Playlist의 선택 파일 |
| GET | `/music/playlists/:playlistId/items/:itemId/content` | jwt | 공개 Playlist의 선택 파일 |

재생 경로는 단일 HTTP Range를 지원합니다. 기존 파일 URL을 프록시하지 않습니다. 오류 JSON envelope은 일반 API 기준이며 바이너리 응답의 Range 오류는 `416`과 `Content-Range`를 반환합니다.

---

## 3. Legacy API (`/music/legacy`) — 종료 예정

구현: [music.controller.ts](../../src/music/interface/music.controller.ts) · 테이블: `legacy_artist`, `legacy_track`, `legacy_playlist`, `legacy_playlist_track`

> 데이터 이관·검증 후 비활성화 예정입니다. 신규 기능을 추가하지 않습니다.

### 3.1 Artist

| Method | Path | 권한 | 비고 |
| --- | --- | --- | --- |
| GET | `/music/legacy/artists` | jwt | 전체 목록 |
| GET | `/music/legacy/artists/:id` | jwt | 없으면 404 |
| POST | `/music/legacy/artists` | admin | `{name(1~200자, unique), description?(≤500자)}` |
| PATCH | `/music/legacy/artists/:id` | admin | 부분 수정 |
| DELETE | `/music/legacy/artists/:id` | admin | 연결된 Track이 있으면 409 `FOREIGN_KEY_CONSTRAINT` |

### 3.2 Track

Legacy Track은 Artist를 **필수 참조**합니다(`artistId`).

| Method | Path | 권한 | 비고 |
| --- | --- | --- | --- |
| GET | `/music/legacy/tracks` | public | 검색·필터·페이지네이션(아래) |
| GET | `/music/legacy/tracks/full` | jwt | 위와 동일 + `createdAt`/`updatedAt` |
| GET | `/music/legacy/tracks/:id` | public | 공개 필드 단건 |
| GET | `/music/legacy/tracks/:id/full` | jwt | 전체 필드 단건 |
| POST | `/music/legacy/tracks` | admin | `{title(1~200자), artistId(≥1), bpm?(0~400), lengthSec?(≥0)}` |
| PATCH | `/music/legacy/tracks/:id` | admin | 부분 수정. 없는 `artistId`면 404 |
| DELETE | `/music/legacy/tracks/:id` | admin | `{deleted: true, id}` |

**목록 Query 파라미터** ([list-tracks-query.dto.ts](../../src/music/interface/dto/list-tracks-query.dto.ts)):

| Query | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `search` | string ≤100자 | — | title/artist 통합 부분 검색 |
| `artistId` | int ≥ 1 | — | Artist ID 필터 |
| `artistName` | string ≤100자 | — | Artist명 부분 검색 |
| `title` | string ≤100자 | — | 제목 부분 검색 |
| `minBpm` / `maxBpm` | int ≥ 0 | — | BPM 범위 |
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1~100 | 20 | |
| `sortBy` | `id`·`title`·`artistName`·`bpm`·`createdAt` | `id` | |
| `sortOrder` | `ASC`·`DESC` | `DESC` | |

검색어의 `%`, `_`, `\`는 문자 그대로 매칭합니다(이스케이프 처리됨).

**응답** (`items` + 페이지 메타데이터 — Catalog와 다른 형식):

```json
{
  "items": [
    { "id": 1, "title": "Song A", "artist": { "id": 3, "name": "Artist X" }, "bpm": 120, "lengthSec": 210 }
  ],
  "total": 1, "page": 1, "limit": 20
}
```

`full` 변형은 각 항목에 `createdAt`, `updatedAt`이 추가됩니다.

### 3.3 Playlist

| Method | Path | 권한 | 비고 |
| --- | --- | --- | --- |
| GET | `/music/legacy/playlists` | jwt | `?date=YYYY-MM-DD` 선택 필터 |
| GET | `/music/legacy/playlists/by-date` | jwt | `?date=YYYY-MM-DD` **필수**. 없거나 형식 오류면 400 |
| GET | `/music/legacy/playlists/:id` | jwt | 포함된 Track과 함께 반환 |
| POST | `/music/legacy/playlists` | admin | `{name(1~200자), playDate?(YYYY-MM-DD), description?(≤500자)}` |
| PATCH | `/music/legacy/playlists/:id` | admin | 부분 수정 |
| DELETE | `/music/legacy/playlists/:id` | admin | 관계 행 cascade 삭제 |

> `by-date`는 단건을 반환하지만 `playDate`에 unique 제약이 없습니다. 확정 정책상 날짜당 개수 제한이 없으므로, 같은 날짜가 여럿이면 어떤 한 건이 반환되는지는 보장되지 않습니다.

### 3.4 PlaylistTrack (관계 관리)

| Method | Path | 권한 | 비고 |
| --- | --- | --- | --- |
| GET | `/music/legacy/playlists/:playlistId/tracks` | jwt | 아래 요약 형식 |
| POST | `/music/legacy/playlists/:playlistId/tracks` | admin | `{trackId(≥1), seq(≥1), note?(≤255자)}` |
| PATCH | `/music/legacy/playlists/:playlistId/tracks/:playlistTrackId` | admin | `{seq?, note?}` |
| DELETE | `/music/legacy/playlists/:playlistId/tracks/:playlistTrackId` | admin | `{deleted: true, playlistTrackId}` |

**목록 응답 형식:**

```json
[
  {
    "playlistTrackId": 5, "seq": 1, "note": "Opening track",
    "track": { "id": 1, "title": "Song A", "artist": "Artist X", "bpm": 120, "lengthSec": 210 }
  }
]
```

> Legacy `seq`에는 DB unique 제약이 없어 중복 순서가 저장될 수 있습니다. Catalog의 `position`(unique)과 다른 동작입니다.

---

## 4. Catalog와 Legacy 차이 요약

| 항목 | Catalog (`/music`) | Legacy (`/music/legacy`) |
| --- | --- | --- |
| Artist 표현 | Track의 표시 문자열 + 선택적 정규 아티스트·별칭·공동 참여자 | 별도 Artist entity + FK |
| 순서 필드 | `position` (DB unique), `displayPosition` 저장만 | `seq` (제약 없음) |
| Track 목록 응답 | 배열(메타데이터 없음) | `{items, total, page, limit}` |
| Track 검색 | 미지원(페이지만) | search/filter/sort 지원 |
| Playlist 공개 | `draft/published/archived` 상태 + 공개 presenter | 상태 없음, jwt 조회 |
| Track 삭제 시 Playlist 관계 | `RESTRICT` → 409 | `CASCADE` 삭제 |
| 상태 | 기준 모델(확장 대상) | 종료 예정(이관 후 비활성화) |

## 5. 관련 문서

- [결정 및 후속 작업](decisions.md) — 확정 정책, 미구현 항목, 알려진 이슈의 원본 기록
- [설계 및 아키텍처](architecture.kr.md) — 계층 구조, 데이터 모델, 요청 흐름
- [제품 API 명세](../product/api-spec.kr.md) — 서비스 전체 API 요약표
- [API_EXAMPLES.md](../../API_EXAMPLES.md) — curl 실행 예제
- Swagger: `SWAGGER_ENABLED=true`인 개발·테스트 환경에서 `/api-docs` (기본 비활성, production 활성화 거부)
