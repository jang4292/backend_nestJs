# Music API 결정 및 보류 항목

## 확정

- 운영 DB 기준은 MariaDB입니다.
- PostgreSQL 전용 migration을 운영 MariaDB에서 재사용하지 않습니다.
- 운영 환경에서는 `DB_SYNCHRONIZE=false`를 유지합니다.
- DB 생성과 migration은 애플리케이션 startup과 분리합니다.
- AudioAsset은 이번 단계에서 메타데이터와 저장소 port 경계까지만 구현합니다.
- 실제 S3 upload/delete와 orphan 파일 보상 처리는 후속 작업입니다.

## 보류

### Playlist 날짜 정책

현재 `GET /music/playlists/by-date`는 단건을 반환하지만 DB에는 `playDate` unique 제약이 없습니다. 날짜당 하나인지 여러 개인지 확정되기 전에는 unique migration을 추가하지 않습니다.

### Playlist 내 Track 중복 정책

현재 `playlist_track`에는 `(playlistId, trackId)` unique 제약이 없습니다. 동일 Track 중복을 허용할지 결정되기 전에는 자동으로 제약을 추가하거나 기존 데이터를 삭제하지 않습니다.

### Playlist 소유권 및 역할

`ownerId`와 catalog write role의 도입은 현재 JWT의 사용자 모델을 재사용하는 방향으로 진행하되, 공유 Playlist와 관리자/editor 역할은 별도 ACL 시스템으로 확장하지 않습니다.

### Soft delete

Track/Artist soft delete는 기존 Playlist 참조와 운영 데이터 보존 요구를 확인한 뒤 결정합니다.
