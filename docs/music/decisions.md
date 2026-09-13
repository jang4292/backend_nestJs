# Music API 결정 및 보류 항목

## 확정

- 운영 DB 기준은 MariaDB입니다.
- PostgreSQL 전용 migration을 운영 MariaDB에서 재사용하지 않습니다.
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

현재 `GET /music/playlists/by-date`는 단건을 반환하지만 DB에는 `playDate` unique 제약이 없습니다. 날짜당 하나인지 여러 개인지 확정되기 전에는 unique migration을 추가하지 않습니다.

### Playlist 내 Track 중복 정책

현재 `playlist_track`에는 `(playlistId, trackId)` unique 제약이 없습니다. 동일 Track 중복을 허용할지 결정되기 전에는 자동으로 제약을 추가하거나 기존 데이터를 삭제하지 않습니다.

### Playlist 소유권 및 역할

`ownerId`와 catalog write role의 도입은 현재 JWT의 사용자 모델을 재사용하는 방향으로 진행하되, 공유 Playlist와 관리자/editor 역할은 별도 ACL 시스템으로 확장하지 않습니다.

### Soft delete

Track/Artist soft delete는 기존 Playlist 참조와 운영 데이터 보존 요구를 확인한 뒤 결정합니다.

### AudioAsset 파일 버전 선택

하나의 Track에 여러 AudioAsset을 연결할 수 있지만, quality, format, bitrate, 기본 재생 파일 선택 정책은 아직 정하지 않았습니다. 이번 단계에서는 해당 필드를 추가하지 않습니다.

### Playback URL 발급

현재 1차 운영 계획은 S3 URL을 AudioAsset 메타데이터로 관리하는 것입니다. 다만 public URL은 URL을 획득한 사용자가 직접 접근할 수 있으므로 공개 Catalog 응답에 넣지 않습니다. 로그인 기반 playback API, private bucket, 짧은 TTL presigned URL은 후속 설계로 남겨 둡니다.
