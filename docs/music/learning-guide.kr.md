# Music 학습 가이드

이 문서는 현재 Music 기능을 처음 읽는 개발자가 도메인 개념부터 API 호출과 DB Migration까지 따라갈 수 있도록 구성한 학습용 문서입니다.

## 1. 먼저 알아둘 구조

현재 Music에는 두 세대의 API가 함께 있습니다.

| 구분 | HTTP 경로 | 테이블 | 목적 |
| --- | --- | --- | --- |
| Legacy | `/music/legacy/*` | `legacy_artist`, `legacy_track`, `legacy_playlist`, `legacy_playlist_track` | 기존 클라이언트 호환 |
| Catalog | `/music/*`, `/music/public/*` | `track`, `audio_asset`, `playlist`, `playlist_track` | 현재 확장 대상 카탈로그 |

두 모델은 이름이 비슷하지만 같은 Entity가 아닙니다. Legacy `Track`은 `legacy_track`을 보고, Catalog `CatalogTrack`은 `track`을 봅니다. 신규 기능을 읽을 때는 먼저 어느 route와 어느 테이블을 사용하는지 확인해야 합니다.

관련 코드:

- Legacy controller: [`src/music/interface/music.controller.ts`](../../src/music/interface/music.controller.ts)
- Catalog controller: [`src/music/catalog/interface/catalog-music.controller.ts`](../../src/music/catalog/interface/catalog-music.controller.ts)
- DB Entity 등록: [`src/database/database-options.ts`](../../src/database/database-options.ts)

## 2. 도메인 개념

### Artist

Legacy 카탈로그에서 Track이 속한 아티스트입니다. 현재 Catalog Track은 artist 문자열을 직접 저장합니다. 따라서 Legacy Artist와 Catalog Track의 artist 표현 방식은 다릅니다.

### Track

음악 작품의 카탈로그 정보입니다. 제목, 아티스트, BPM 같은 메타데이터를 가집니다. Track이 생성될 때 AudioAsset이 반드시 존재할 필요는 없습니다.

### AudioAsset

실제 음원 파일을 가리키는 저장소 메타데이터입니다.

현재는 `url`, duration, BPM을 저장합니다. 중요한 구분은 Track의 BPM과 AudioAsset의 BPM이 서로 다른 값이라는 점입니다.

- `Track.bpm`: 카탈로그 또는 작품 기준 BPM
- `AudioAsset.bpm`: 특정 파일 또는 분석 결과의 BPM

현재 공개 Catalog Track 응답은 audio URL을 그대로 반환하지 않는 방향으로 관리해야 합니다. S3 public URL은 URL을 아는 누구나 접근할 수 있기 때문입니다.

### Playlist

여러 Track을 화면과 재생 순서로 묶은 목록입니다. Catalog Playlist는 다음 상태를 가집니다.

- `draft`: 작성 중이며 공개하지 않음
- `published`: 익명 공개 목록에 노출
- `archived`: 보관 상태이며 공개하지 않음

### PlaylistTrack

Playlist와 Track 사이의 관계 행입니다. Catalog에서는 `position`이 재생 순서입니다. 관계 테이블을 별도로 두는 이유는 같은 Track이 여러 Playlist에 들어갈 수 있고, Playlist마다 순서와 메모가 다르기 때문입니다.

## 3. 요청 흐름 읽기

Legacy 요청은 다음 흐름입니다.

```text
HTTP Controller
  -> MusicService facade
    -> Application use case
      -> Repository port
        -> TypeORM repository adapter
          -> MariaDB
```

Catalog 요청은 현재 다음 흐름입니다.

```text
HTTP Controller
  -> CatalogMusicService
    -> Repository port 또는 TypeORM Repository
      -> Catalog Entity
        -> MariaDB
```

Legacy는 use case와 port가 세분화되어 있고, Catalog Playlist는 초기 구현 단계라 `CatalogMusicService`가 Track repository와 Playlist TypeORM repository를 함께 사용합니다. 이 차이는 현재 상태이며, 같은 구조라고 가정하면 안 됩니다.

## 4. 익명 공개와 인증 관리의 차이

공개 조회:

```http
GET /music/public/playlists
GET /music/public/playlists/:id
GET /music/tracks
GET /music/tracks/:id
```

관리 작업:

```http
POST  /music/playlists
PATCH /music/playlists/:id/publish
POST  /music/playlists/:playlistId/tracks
PATCH /music/playlists/:playlistId/tracks/reorder
POST  /music/tracks
PATCH /music/tracks/:id
DELETE /music/tracks/:id
```

관리 작업은 JWT가 필요합니다. 공개 Playlist 상세 응답에는 제목, Track 요약, 순서만 포함하고 `audio_asset.url` 같은 내부 또는 민감한 저장소 정보는 포함하지 않습니다.

## 5. Presenter가 필요한 이유

TypeORM Entity를 controller에서 직접 반환하면 relation 설정, 컬럼 추가, eager loading 변경이 곧 API 응답 변경으로 이어집니다. Catalog Playlist는 [`catalog-playlist.presenter.ts`](../../src/music/catalog/interface/presenters/catalog-playlist.presenter.ts)에서 공개 필드를 선택합니다.

```text
Database Entity -> Presenter -> Public Response
```

이 경계를 사용하면 DB에는 존재하지만 외부에 공개하면 안 되는 URL, 내부 timestamp, 저장소 식별자를 응답에서 제외할 수 있습니다.

## 6. Playlist 순서와 Transaction

Playlist item은 `position`을 가집니다. DB에는 `(playlistId, position)` unique index가 있으므로 하나의 Playlist에서 같은 position을 두 번 사용할 수 없습니다.

두 item의 위치를 서로 바꾸는 작업은 바로 `1 -> 2`, `2 -> 1`로 업데이트하면 첫 번째 UPDATE 시 unique 충돌이 날 수 있습니다. 현재 reorder 구현은 다음 순서로 처리합니다.

1. 모든 item을 임시 음수 position으로 이동
2. 요청된 최종 position 저장
3. transaction 성공 시 전체 결과 반환

이 패턴은 중간 상태가 외부에 노출되지 않도록 합니다.

## 7. Migration 학습 순서

Migration은 애플리케이션 startup과 분리합니다.

```bash
npm run migration:show
npm run migration:run
npm run build
```

현재 음악 관련 Migration 순서는 다음과 같습니다.

1. Legacy schema 생성 및 정규화
2. Legacy 테이블 archive
3. Catalog `track`, `audio_asset` 생성
4. Catalog `playlist`, `playlist_track` 생성

운영 DB에서는 `DB_SYNCHRONIZE=false`를 유지하고 기존 Migration 파일을 수정하지 않습니다. 변경이 필요하면 새 Migration을 추가합니다.

## 8. 직접 해보는 학습 실습

1. `npm run migration:show`로 적용 상태를 확인합니다.
2. `GET /music/tracks`로 Catalog Track 공개 응답을 확인합니다.
3. 인증 토큰으로 Track을 생성합니다.
4. 인증 토큰으로 Playlist를 생성합니다. 처음에는 `draft`입니다.
5. Track을 Playlist에 position과 함께 추가합니다.
6. reorder API로 순서를 바꿉니다.
7. Playlist를 publish합니다.
8. `GET /music/public/playlists`에서 공개되는지 확인합니다.
9. 응답 JSON에 S3 URL 또는 `objectKey`가 없는지 확인합니다.

## 9. 학습자가 스스로 답해야 하는 질문

- Legacy와 Catalog Track은 왜 같은 테이블을 사용하지 않는가?
- Playlist와 Track을 직접 Many-to-Many로 연결하지 않고 관계 Entity를 두는 이유는 무엇인가?
- `published` 필터는 controller, service, repository 중 어디에 있어야 하는가?
- Entity를 그대로 반환할 때 URL 노출 위험이 생기는 이유는 무엇인가?
- position 교환에 임시 값과 transaction이 필요한 이유는 무엇인가?
- Migration과 `synchronize`를 운영에서 분리해야 하는 이유는 무엇인가?
