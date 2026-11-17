# 음악 카탈로그·파일·사용 통계 실무 실습

> 최신화 기준: 2026-11-17 · develop `82bb4f1` + 주석·문서 작업 트리
> 이 문서는 저장소 구현을 설명하며, 실제 음원 권리·운영 저장소·DB 적용 상태는 확인하지 않았습니다.

관리자가 트랙을 등록하고 음원을 선택해 공개한 뒤, 사용 회차를 확정하고 통계를 확인하는 전체 흐름입니다. 실습은 일회성 DB와 직접 만든 또는 사용 권한이 확인된 음원에서만 진행하세요.

## 1. 모델과 코드 위치

| 이름 | 의미 | 확인할 코드 |
| --- | --- | --- |
| Legacy | 기존 Artist/Track/Playlist. `/music/legacy/*`로 유지 | [`music.module.ts`](../../src/music/music.module.ts), [Legacy API](api.kr.md) |
| Catalog Track | 개별 녹음. 표시용 `artist` 문자열도 유지 | [`catalog-track.entity.ts`](../../src/music/catalog/entities/catalog-track.entity.ts) |
| MusicWork / MusicArtist | 작품과 정규 아티스트·별칭. 여러 녹음·참여자를 연결 | [`music-management.entities.ts`](../../src/music/catalog/management/music-management.entities.ts) |
| AudioAsset | 트랙의 URL 메타데이터 또는 서버에 업로드한 파일 | [`audio-asset.entity.ts`](../../src/music/catalog/entities/audio-asset.entity.ts) |
| Playlist / item | 전역 카탈로그의 목록과 순서별 항목 | [`catalog-music.service.ts`](../../src/music/catalog/catalog-music.service.ts) |
| Usage / usage item | 관리자가 입력한 한 사용 회차와 당시 항목의 스냅샷 | [`music-management.service.ts`](../../src/music/catalog/management/music-management.service.ts) |
| 로컬 파일 | 비공개 디렉터리에 저장한 파일과 Range 재생 | [`local-audio.service.ts`](../../src/music/catalog/management/local-audio.service.ts), [`local-audio.controller.ts`](../../src/music/catalog/management/local-audio.controller.ts) |

```text
MusicWork 1 ──< CatalogTrack >──< MusicArtist ──< alias
                       │
                       └──< AudioAsset
CatalogPlaylist 1 ──< PlaylistItem >── CatalogTrack
                           └── 선택 AudioAsset
CatalogPlaylist 1 ──< Usage 1 ──< UsageItem ──< 당시 아티스트 이름
```

Track의 `artist` 문자열은 정규 아티스트 연결과 자동 동기화되지 않습니다. 같은 제목이거나 같은 이름이라고 작품·사람을 자동 병합하지 않습니다. Legacy 레코드는 자동으로 Catalog에 이관되지 않습니다.

## 2. 안전한 준비와 저장 경로

1. [개발자 안내서](../learning/developer-handbook.kr.md)의 격리 DB를 준비하고 서버를 기동합니다.
2. 테스트용 `admin` 계정과 짧은 수명의 토큰을 준비합니다. [가입·로그인 예제](../../API_EXAMPLES.md#2-register-public)와 [관리자 지정 절차](../deployment/mariadb-systemd.kr.md#5-배포-후-작업)를 참고합니다. 관리 API와 업로드는 `@AdminOnly()`로 보호됩니다.
3. 저장 경로는 웹 서버 정적 파일 경로 밖에 두고, 앱 실행 계정만 읽고 쓸 수 있게 제한합니다. 업로드 권리와 용량을 사전에 확인합니다.

### `MUSIC_STORAGE_DIR`의 현재 설정 주의

[`LocalAudioService`](../../src/music/catalog/management/local-audio.service.ts)는 `MUSIC_STORAGE_DIR`을 읽고, 없으면 **프로세스 작업 디렉터리의 `data/music`**을 사용합니다. 하지만 현재 [`validateAppEnv`](../../src/config/app-env.ts)의 반환값과 [`RUNTIME_ENV_KEYS`](../../scripts/runtime-env-keys.cjs)에 이 키가 없습니다. 따라서 `.env`나 `.env.production`에만 기입한 값이 앱에 전달된다고 보장되지 않습니다. Secrets Manager export의 허용 목록에도 포함되지 않으며 PM2 설정이 명시적으로 전달하는 목록에도 없습니다.

직접 개발 프로세스를 시작할 때는 해당 프로세스 환경에 값을 전달할 수 있습니다. 아래 경로는 **미리 승인한 전용 경로로 바꿔야 하는 예시**입니다.

```bash
MUSIC_STORAGE_DIR=/absolute/path/to/private-music npm run start:dev
```

PM2/systemd 등에서는 서비스 프로세스에 실제 값이 전달되는지 별도로 확인하고, 임시 파일을 업로드해 의도한 디렉터리에 저장되는지 검증합니다. `.env`의 설정만 보고 백업 경로를 결정하지 마세요. 설정을 정식 지원하려면 `AppEnv` 파싱·검증, env 예제, runtime allowlist, 테스트와 배포 문서를 함께 변경해야 합니다. 현재 코드는 그 변경을 포함하지 않습니다.

## 3. 등록부터 재생까지

아래 예는 로컬 실습 전용입니다. `BASE`를 설정하고 `ADMIN_TOKEN`을 별도 안전한 방법으로 제공하세요. 각 응답의 ID를 기록해 다음 요청에 대입합니다. 예시의 `1`은 새 DB에서도 보장되지 않습니다. 실제 운영 토큰을 공유 호스트의 curl 인자에 넣지 않습니다.

```bash
BASE=http://127.0.0.1:3000

# 정규 아티스트와 작품
curl -sS -X POST "$BASE/music/management/artists" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"실습 아티스트"}'
curl -sS -X POST "$BASE/music/management/works" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"실습 작품"}'

# 개별 녹음(Track) 생성
curl -sS -X POST "$BASE/music/tracks" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"실습 녹음","artist":"실습 표시 이름","bpm":120}'

# 위에서 받은 track/work/artist ID로 교체
curl -sS -X PATCH "$BASE/music/management/recordings/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"workId":1,"artistIds":[1],"recordingType":"live","recordingDate":"2026-01-15"}'
```

녹음 수정은 트랜잭션에서 트랙을 잠그고 작품·아티스트가 존재하는지 확인합니다. `artistIds`를 보낸 경우 기존 연결 전체를 요청 목록으로 교체합니다. `[]`는 모든 연결을 제거하며 필드를 생략하면 유지합니다.

### 3.1 음원 업로드와 항목 선택

```bash
# 로컬의 허가된 파일 경로와 track ID로 교체
curl -sS -X POST "$BASE/music/tracks/1/upload" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F 'file=@/absolute/path/to/your-audio.mp3'

curl -sS -X POST "$BASE/music/playlists" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"실습 목록","anonymousPlayable":true}'

# 생성된 playlist ID와 track ID로 교체
curl -sS -X POST "$BASE/music/playlists/1/tracks" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"trackId":1,"position":1}'

# 위에서 받은 playlist item ID와 upload 응답의 audio asset ID로 교체
curl -sS -X PATCH "$BASE/music/management/playlist-items/1/asset" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"audioAssetId":1}'
```

- 업로드 form 필드는 `file`이고 상한은 **50 MiB**입니다. MP3, WAV, Ogg, FLAC, MP4의 알려진 파일 서명을 확인합니다. 이는 파일 전체의 안전성·저작권·재생 가능성을 보증하는 검사는 아닙니다.
- 파일명 대신 임의 UUID를 저장 키로 사용합니다. 새 디렉터리는 `0700`, 파일은 `0600` 권한을 요청하지만, 이미 있는 디렉터리의 권한은 바꾸지 않습니다. 실제 디렉터리 권한과 소유자를 확인하세요. DB에는 저장 키·콘텐츠 타입·크기가 저장됩니다.
- 선택한 파일은 **같은 트랙의 업로드된 AudioAsset**이어야 합니다. URL만 있는 기존 자산은 선택할 수 없습니다. `{"audioAssetId":null}`은 선택을 해제합니다.
- 파일 쓰기와 DB 저장은 하나의 트랜잭션이 아닙니다. DB 저장 실패 시 파일 삭제를 시도하지만 삭제까지 실패하면 고아 파일이 남을 수 있습니다. 파일만 임의 삭제하지 말고 DB 참조와 백업을 먼저 확인하세요.

### 3.2 공개와 Range 확인

```bash
curl -sS -X PATCH "$BASE/music/playlists/1/publish" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
curl -sS "$BASE/music/public/playlists/1"

# 익명 재생 허용 + published + 선택 파일이 있을 때
curl -sS -D - -o /dev/null -H 'Range: bytes=0-127' \
  "$BASE/music/public/playlists/1/items/1/content"
```

공개 상세의 `tracks`는 `position` 순서이며 `hasSelectedAudio`를 표시합니다. 파일 경로, 저장 키, URL은 공개 메타데이터에 포함하지 않습니다. 정상 Range는 206과 `Content-Range`, Range 없는 정상 요청은 200, 유효하지 않은 단일 범위나 다중 범위는 416입니다.

| 경로 | 요구 조건 |
| --- | --- |
| `/music/management/audio-assets/:id/content` | admin |
| `/music/public/playlists/:playlistId/items/:itemId/content` | published, 선택된 로컬 파일, `anonymousPlayable=true` |
| `/music/playlists/:playlistId/items/:itemId/content` | 유효한 JWT, published, 선택된 로컬 파일 |

접근 불가·파일 없음은 404일 수 있습니다. URL만 있는 파일을 대신 내려받거나 프록시하지 않습니다. S3와 서명 URL은 구현되지 않았습니다.

### 3.3 순서 변경과 동시성

같은 트랙을 한 목록에 여러 번 넣을 수 있지만 `(playlistId, position)`은 고유해야 합니다. 재정렬은 **현재 항목 ID 전체를 한 번씩** 포함하고, 서로 다른 양의 position을 보내야 합니다.

```json
{
  "items": [
    { "id": 11, "position": 2 },
    { "id": 12, "position": 1 }
  ]
}
```

위 body를 `PATCH /music/playlists/:playlistId/tracks/reorder`에 보냅니다. 서버는 부모 playlist 행을 잠근 뒤 요청과 현재 항목을 비교하고, unique 충돌 없이 교환하도록 임시 음수 위치를 거쳐 양수 위치를 저장합니다. 추가와 재정렬이 경합해 항목 목록이 달라지면 400이므로 목록을 다시 읽고 사용자가 재정렬해야 합니다. `displayPosition`은 저장되지만 별도 편집이나 정렬에 아직 사용하지 않습니다.

## 4. 사용 회차와 통계 실습

```bash
# 항목이 있는 playlist ID를 사용하고 시간대가 포함된 ISO 8601을 입력
curl -sS -X POST "$BASE/music/management/usages" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"playlistId":1,"usedAt":"2026-01-15T12:00:00Z","location":"실습 장소","eventName":"실습 행사"}'

# 생성된 usage ID로 상세를 읽고 items[].id 확인
curl -sS "$BASE/music/management/usages/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 실제 usage/item ID로 교체: 0은 통계에서 제외, 1 이상은 입력 횟수
curl -sS -X PATCH "$BASE/music/management/usages/1/items/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"playCount":2}'
curl -sS -X POST "$BASE/music/management/usages/1/confirm" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -sS -G "$BASE/music/management/statistics" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data-urlencode 'from=2026-01-01T00:00:00Z' \
  --data-urlencode 'to=2026-02-01T00:00:00Z' \
  --data-urlencode 'location=실습 장소'
```

생성 시 현재 목록 제목과 항목의 트랙·작품 제목, 선택 파일, 참여 아티스트 이름을 복사합니다. 이후 카탈로그 이름을 바꿔도 저장된 당시 이름은 바뀌지 않습니다. 최초 `playCount`는 1입니다. `draft`일 때만 항목 횟수를 0~10000으로 수정할 수 있으며, `confirmed` 이후 수정이나 재확정은 400입니다. 확정 취소 API는 없습니다.

통계는 **확정된 회차의 양수 횟수**를 `from` 이상 `to` 미만으로 합산합니다. 장소 필터는 SQL `=`로 비교하며 대소문자·악센트 등의 일치 기준은 DB 컬레이션에 따릅니다. 같은 녹음이 여러 항목에 있으면 각각 더하고, 공동 참여 아티스트는 각자 해당 횟수를 받습니다. 따라서 아티스트 통계 합계와 전체 재생 횟수가 같을 필요는 없습니다. 파일 ID가 null인 그룹은 파일이 선택되지 않은 기록입니다. 녹음·작품·파일·아티스트별 결과는 각각 최대 100개이며 추가 페이지는 없습니다. 이는 청취 이력이 아니라 관리자가 입력한 사용 횟수입니다.

## 5. 변경·테스트·복구 체크리스트

### 기능을 바꿀 때

1. [음악 API 명세](api.kr.md)와 [관리 초안](catalog-usage-prototype.kr.md)에서 공개 필드와 미구현 범위를 확인합니다.
2. Controller의 guard·DTO·응답과 service의 트랜잭션·FK를 함께 봅니다. 특히 새 관리/업로드 컨트롤러는 기존 `music-authorization.spec.ts`의 자동 권한 검사 범위에 포함되지 않으므로 별도 권한 테스트가 필요합니다.
3. 공개 presenter에 내부 URL·저장 키·불필요한 개인정보가 추가되지 않았는지 검증합니다. 파일 접근과 메타데이터 공개는 별개 권한입니다.
4. 데이터 변경이 있으면 새 migration과 entity, 새 테이블의 `APP_TABLES`, 기존 데이터의 이관·백업·복구 방안을 검토합니다.
5. 단위 테스트는 [`local-audio.service.spec.ts`](../../src/music/catalog/management/local-audio.service.spec.ts), [`music-management.service.spec.ts`](../../src/music/catalog/management/music-management.service.spec.ts), [`catalog-music.service.spec.ts`](../../src/music/catalog/catalog-music.service.spec.ts)를 참고합니다.
6. 격리 MariaDB에서 [`music-management.e2e-spec.ts`](../../test/music-management.e2e-spec.ts)와 [`catalog-concurrency.e2e-spec.ts`](../../test/catalog-concurrency.e2e-spec.ts)를 실행합니다. 이 테스트는 실제 데이터를 만들며 `ISOLATED_DATABASE_E2E=true`가 없으면 skip됩니다. 업로드·스트리밍의 전체 경로도 별도의 격리 환경에서 직접 검증합니다.

### 백업과 장애

- DB와 파일 디렉터리를 **같은 복구 시점**으로 보호합니다. 쓰기를 중지하거나 일관된 스냅샷을 확보하고, 격리 환경에서 복원한 뒤 공개·인증 재생과 Range를 확인합니다.
- 업로드된 파일을 포함한 트랙이나 파일의 기존 삭제 API는 저장소 정리 기능이 없어 409로 거부합니다. 수동으로 DB나 파일을 지워 우회하지 않습니다.
- [`AddMusicManagement1768000000000`](../../src/database/migrations/1768000000000-AddMusicManagement.ts)의 `down()`은 항상 실패합니다. 이 migration을 되돌려야 할 때는 승인된 DB·파일 백업 복원 절차가 필요합니다.
- 파일 404가 발생하면 playlist 공개 상태, 익명 허용/JWT, 항목의 선택 파일, 해당 파일의 존재와 실행 계정 권한을 순서대로 확인합니다. 내부 경로를 API 응답이나 공개 로그에 노출하지 않습니다.
- 업로드한 파일이 예상 경로에 없으면 `MUSIC_STORAGE_DIR`이 실제 프로세스에 전달되었는지와 기본 `data/music` 사용 여부를 확인합니다.

## 6. 스스로 점검

1. 같은 작품의 두 녹음을 왜 두 Track으로 만들 수 있나요?
2. `audioAssetId`가 같은 트랙의 업로드 파일인지 검증하는 이유는 무엇인가요?
3. 항목 위치를 바로 1↔2로 바꾸면 어떤 unique 충돌이 생길 수 있나요?
4. 원본 아티스트 이름을 수정해도 확정된 사용 회차의 이름이 보존되는 이유는 무엇인가요?
5. DB만 백업하고 로컬 파일을 백업하지 않으면 어떤 데이터가 복구되지 않나요?
