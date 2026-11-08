# Music API 결정 및 보류 항목

> 최신화 기준: 2026-11-08 · develop `9b731ef` + `chore/project-audit-2026-11`

## 확정

- 운영 DB 기준은 MariaDB입니다.
- 애플리케이션은 MariaDB만 지원합니다(`DB_TYPE=mariadb`). DB 오류는 MariaDB 코드(`ER_DUP_ENTRY`, `ER_ROW_IS_REFERENCED_2`)로 판별합니다(`src/database/mariadb-errors.ts`).
- 카탈로그와 legacy 음악 데이터는 운영자가 관리하는 전역 카탈로그입니다. 쓰기는 `users.role = 'admin'`만 할 수 있습니다(2026-11-08, 최소 RBAC).
- 운영 환경에서는 `DB_SYNCHRONIZE=false`를 유지합니다.
- DB 생성과 migration은 애플리케이션 startup과 분리합니다.
- AudioAsset은 이번 단계에서 메타데이터와 저장소 port 경계까지만 구현합니다.
- 실제 S3 upload/delete와 orphan 파일 보상 처리는 후속 작업입니다.
- Active catalog는 `Track 1:N AudioAsset` 관계를 사용합니다. `audio_asset.trackId`가 Track을 참조하며, Track 생성 시 AudioAsset은 없어도 됩니다.
- `Track.bpm`은 음원이 없어도 입력할 수 있는 카탈로그 BPM이고, `AudioAsset.bpm`은 파일 또는 분석 BPM입니다. 두 값은 자동으로 동기화하지 않습니다.
- 기존 Artist/Track/Playlist/PlaylistTrack 기능과 데이터는 `legacy_*` 테이블 및 `/music/legacy` route에 보관합니다. 새 기능은 `/music` route와 새 `track`, `audio_asset` 테이블을 사용합니다.
- Catalog Playlist는 `draft`, `published`, `archived` 상태를 사용합니다. 익명 공개 목록과 상세 조회는 `published`만 대상으로 합니다.
- Catalog Playlist item의 재생 순서는 `position`이며 `(playlistId, position)` unique index로 DB에서도 중복을 방지합니다.
- 공개 Playlist 응답은 presenter를 통해 제목, 설명, Track 요약과 순서만 반환하고 AudioAsset URL/object key를 포함하지 않습니다.
- `anonymousPlayable`은 향후 익명 playback 정책을 위한 값입니다. 현재 실제 playback URL 발급 API는 구현하지 않았습니다.
- 2026-09-13 기준 개발 DB에는 `ArchiveLegacyMusicSchema`, `CreateCatalogMusicSchema`, `CreateCatalogPlaylistSchema`가 적용되었습니다. 환경별 상태는 `npm run migration:show`로 재확인합니다.

## 보류

### Playlist 날짜 정책

현재 `GET /music/legacy/playlists/by-date`는 단건을 반환하지만(`date=YYYY-MM-DD` 필수) DB에는 `playDate` unique 제약이 없습니다. 날짜당 하나인지 여러 개인지 확정되기 전에는 unique migration을 추가하지 않습니다.

### Playlist 내 Track 중복 정책

현재 `playlist_track`에는 `(playlistId, trackId)` unique 제약이 없습니다. 동일 Track 중복을 허용할지 결정되기 전에는 자동으로 제약을 추가하거나 기존 데이터를 삭제하지 않습니다.

### Playlist 소유권 및 역할

- **완료(2026-11-08):** `users.role`(user|admin)과 `@AdminOnly()`로 카탈로그 쓰기를 admin으로 제한했습니다.
- **보류**
  - 사용자 개인 플레이리스트(`ownerId`)가 제품에 필요한지
  - editor처럼 세분화된 역할이 필요한지
- 필요해지더라도 별도 ACL 시스템 대신 현재 사용자 모델과 role을 확장합니다.

### Playlist 공개 상태 전이

현재는 `archived`도 다시 `published`로 바꿀 수 있고, 다시 공개하면 `publishedAt`이 새로 기록됩니다. 허용할 전이(예: `draft→published→archived`만 허용)와 `publishedAt` 유지 여부를 결정해야 합니다.

### Soft delete

Track/Artist soft delete는 기존 Playlist 참조와 운영 데이터 보존 요구를 확인한 뒤 결정합니다.

### AudioAsset 파일 버전 선택

하나의 Track에 여러 AudioAsset을 연결할 수 있지만, quality, format, bitrate, 기본 재생 파일 선택 정책은 아직 정하지 않았습니다. 이번 단계에서는 해당 필드를 추가하지 않습니다.

### Playback URL 발급

현재 1차 운영 계획은 S3 URL을 AudioAsset 메타데이터로 관리하는 것입니다. 다만 public URL은 URL을 획득한 사용자가 직접 접근할 수 있으므로 공개 Catalog 응답에 넣지 않습니다. 로그인 기반 playback API, private bucket, 짧은 TTL presigned URL은 후속 설계로 남겨 둡니다.

### 삭제된 Copilot 프롬프트에서 옮긴 미해결 요구사항

다음 항목은 2026-11-08에 삭제한 `docs/music/roadmap/github-copilot-nestjs-mariadb-improvement-prompt.md`에 남아 있던 요구사항입니다. 우선순위는 [감사 로드맵](../audit/2026-11-08-project-audit.kr.md#6-로드맵)을 따릅니다.

- Track 검색 기준 객체, LIKE 이스케이프, 인덱스 설계, 공개 목록 count 쿼리 최적화
- Playlist 변경 트랜잭션 보강, 재정렬 항목 상한, deadlock/lock timeout 재시도 정책
- Response DTO로 entity 직접 반환 제거, `MusicService` facade와 `CatalogMusicService` 분해
- AudioAsset 업로드 안전성(MIME/크기 검증), S3/CloudFront와 presigned URL
- 문자셋(utf8mb4)과 timezone(UTC) 점검, 백업 자동화, migration 실패 정책, 기존 데이터 이전, 기존 클라이언트 호환성
- MariaDB integration test와 e2e
