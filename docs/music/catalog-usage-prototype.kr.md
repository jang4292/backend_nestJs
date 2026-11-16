# 음악 카탈로그와 플레이리스트 사용 기록 초안

이 문서는 2026-11-16 기준 저장소에 구현된 초안과 남은 작업을 구분합니다. 실제 청취 이력은 수집하지 않습니다. 통계는 관리자가 확정한 플레이리스트 사용 회차에 입력된 횟수입니다.

## 데이터와 집계

- 기존 `track`은 개별 녹음으로 취급합니다. `music_work`는 음악 작품, `music_artist`는 정규 아티스트, `music_artist_alias`는 다른 표기입니다. `music_track_artist`로 녹음에 여러 아티스트를 연결합니다.
- 기존 트랙의 `title`, `artist`는 호환성을 위해 남습니다. 아티스트 문자열을 정규 아티스트로 자동 변환하지 않으며, 같은 제목이라고 작품을 자동 통합하지 않습니다. 트랙의 작품과 참여자는 관리 API로 직접 연결합니다.
- 같은 작품의 커버와 다른 장소의 녹음은 각 트랙을 같은 작품에 연결합니다. 녹음 종류·장소·날짜는 선택 사항입니다. 파일은 `audio_asset`에 속하며 플레이리스트 항목에는 선택한 파일 ID를 저장합니다. 기존 URL만 있는 파일은 직접 재생 대상으로 선택할 수 없습니다.
- 사용 회차를 만들면 그 시점의 목록 항목, 트랙·작품 이름, 파일, 참여 아티스트를 별도 테이블에 복사합니다. 초안의 항목 횟수는 기본 1이고 0은 제외입니다. 확정 후에는 항목 수정을 거부합니다. 같은 녹음이 목록에 여러 번 있으면 항목별로 합산합니다.
- 통계는 확정 회차의 양수 횟수만 합산합니다. 기간은 `from` 이상 `to` 미만이며, 위치 필터는 정확히 일치하는 값입니다. 공동 참여자는 각각 횟수를 받으므로 아티스트별 합계와 전체 합계가 다를 수 있습니다. 파일 ID가 `null`인 집계는 파일 미확인입니다. 작품이나 정규 아티스트가 연결되지 않은 기존 트랙은 해당 작품·아티스트 통계에 포함되지 않습니다. 최대 100개 결과를 반환합니다.
- 날짜 시간 입력은 시간대가 포함된 ISO 8601 형식입니다. 관리자 화면은 사용자 브라우저의 시간대로 날짜를 UTC 범위로 변환합니다. DB 서버와 애플리케이션의 시간대 설정을 일관되게 유지해야 합니다.

## 관리자 API

모든 `/music/management/*` 경로에는 관리자 JWT가 필요합니다. 기존 `/music/tracks`, `/music/playlists` 경로는 유지됩니다.

| 메서드 | 경로 | 용도 |
| --- | --- | --- |
| POST / GET | `/music/management/artists` | 정규 아티스트 생성, 이름·별칭 검색(`q`) |
| GET / POST | `/music/management/artists/:id/aliases` | 별칭 목록·추가 |
| POST / GET | `/music/management/works` | 작품 생성·목록 |
| PATCH | `/music/management/recordings/:id` | `workId`, `artistIds`, 녹음 종류·장소·날짜 지정 |
| GET | `/music/management/playlists`, `/music/management/playlists/:id` | 관리자 목록과 항목 상세 |
| PATCH | `/music/management/playlist-items/:id/asset` | `{ "audioAssetId": 1 }`; `null`로 선택 해제 |
| POST | `/music/management/usages` | `{ "playlistId": 1, "usedAt": "2026-01-15T12:00:00Z", "location": "Seoul", "eventName": "Dance" }` |
| GET | `/music/management/usages`, `/music/management/usages/:id` | 사용 회차 목록·스냅샷 |
| PATCH | `/music/management/usages/:id/items/:itemId` | 초안의 `{ "playCount": 0 }` 변경 |
| POST | `/music/management/usages/:id/confirm` | 회차 확정 |
| GET | `/music/management/statistics?from=...&to=...&location=...` | 녹음·작품·파일·아티스트별 집계 |

입력 검증과 일부 OpenAPI 데코레이터가 제공되지만 모든 응답의 상세 OpenAPI 스키마는 아직 완성되지 않았습니다. 목록 API의 100개 상한은 페이지네이션이 아닙니다.

## 로컬 음원과 재생

`POST /music/tracks/:id/upload`는 관리자 전용 `multipart/form-data`의 `file` 필드를 받습니다. 최대 50 MiB이며 MP3, WAV, Ogg, FLAC, MP4의 파일 서명을 확인합니다. 업로드된 파일은 `MUSIC_STORAGE_DIR` 또는 기본 `data/music`에 임의 이름으로 저장됩니다. 웹 서버의 정적 파일 경로로 노출하면 안 됩니다. DB와 파일 저장 디렉터리를 함께 백업해야 합니다. 여러 서버를 사용하는 경우 공유 스토리지가 필요합니다.

- 관리자는 `GET /music/management/audio-assets/:id/content`로 재생합니다.
- 익명 사용자는 `GET /music/public/playlists/:playlistId/items/:itemId/content`를 사용합니다. 공개 상태와 `anonymousPlayable=true`를 모두 확인합니다.
- 로그인 사용자는 `GET /music/playlists/:playlistId/items/:itemId/content`에 Bearer 토큰을 보냅니다. 공개된 목록의 선택된 파일만 재생할 수 있습니다.
- 서버는 단일 HTTP Range 요청을 지원합니다. 공개 메타데이터에는 실제 파일 경로를 넣지 않습니다. 기존 외부 URL을 대신 가져오거나 프록시하지 않습니다.
- 업로드한 파일을 참조하는 트랙·파일의 기존 삭제 API는 파일 정리 절차가 구현되기 전까지 409로 거부합니다. 수동으로 파일만 삭제하지 마세요.

로컬 저장소는 추후 S3 전환을 위한 첫 단계이며, S3 어댑터·서명 URL과 실제 파일 삭제/복구는 아직 구현되지 않았습니다. 업로드 파일의 재생 허용 권한과 저장소 운영 정책은 운영자가 관리해야 합니다.

## 웹 초안 실행

1. 백업을 확인하고 새 migration을 테스트 환경에 적용한 뒤 NestJS 서버를 실행합니다. 운영 DB에는 검증 없이 적용하지 않습니다.
2. `CORS_ORIGIN`에 웹 초안의 정확한 origin을 설정합니다. 예를 들어 `admin-prototype` 디렉터리에서 `python3 -m http.server 3001`을 실행하면 `http://localhost:3001`입니다.
3. 브라우저에서 해당 주소를 열고 API 주소와 계정으로 로그인합니다. JWT는 페이지 메모리에만 보관합니다. 관리 기능은 관리자 계정이 필요합니다.
4. 아티스트와 작품을 등록하고 트랙에 연결합니다. 파일을 업로드한 다음 플레이리스트 항목에 해당 파일 ID를 지정합니다. 사용 회차를 만들고 횟수를 조정·확정하면 통계에서 조회할 수 있습니다.

화면은 다른 프로젝트에서 참고하기 위한 초안입니다. 공개 재생 탭에서는 익명 재생 가능 목록을 직접 재생하며, 로그인 재생은 인증 헤더를 사용해 파일을 내려받은 뒤 재생합니다.

## 아직 남은 작업과 이관 주의

- Legacy → Catalog 이관 도구, ID 대응표, 이관 검증 및 Legacy API·테이블 제거는 **아직 구현되지 않았습니다**. 이번 migration은 기존 레코드를 삭제하거나 이관하지 않습니다. 기존 데이터의 불명확한 아티스트, 작품, 파일, 과거 사용 일시·장소를 추정해 채우지 않습니다.
- 사용자가 요청한 soft delete·복구·감사 기록, 관리 순서의 독립 편집, 중복 후보 검토·병합, 아티스트/작품 수정·삭제, 사용 회차 수정·취소, 완전한 OpenAPI 응답 정의는 후속 구현이 필요합니다. 저장된 `displayPosition`은 아직 편집하거나 정렬에 사용하지 않습니다.
- 새 migration과 업로드·재생 흐름은 격리된 MariaDB에서 실제 적용 및 통합 검증을 마친 뒤 배포해야 합니다. Legacy 정리는 DB 백업·복구 검증과 이관 전후 관계 검증 후 수행합니다. 이 문서나 새 migration만으로 Legacy 테이블을 삭제하지 마세요.
