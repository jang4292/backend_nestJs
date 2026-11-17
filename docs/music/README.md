# Music API 운영 개선 문서

> 검토 기준일: 2026-11-17 · 스테이징된 Music 구현 기준; DB 적용 및 통합 검증은 별도 확인

NestJS Music API와 EC2 내부 MariaDB 운영 개선 문서 모음입니다.

## 문서 구조

- [카탈로그·사용 기록·음원 재생 초안](catalog-usage-prototype.kr.md): 새 데이터 모델, API, 웹 초안과 미구현 범위
- [음악 구현 실습](implementation-workbook.kr.md): 트랙 등록부터 업로드·재생·통계·복구까지 단계별 안내
- [MariaDB 운영 가이드](database/mariadb-operations.md): DB 생성, migration, backup, 배포, 보안
- [Music REST API 레퍼런스](api.kr.md): Catalog/Legacy 전체 endpoint, 요청·응답 형식, 오류 계약
- [결정 및 후속 작업](decisions.md): 확정된 동작, 정책 결정, 구현·검증 잔여 항목
- [Music API 구조 검토](api-reorganization-review.kr.md): 구조 문제와 단계적 개선 방향(2026-09 검토, 이후 상태 표기)
- 남은 요구사항과 우선순위: [최신 감사 리포트 로드맵](../audit/2026-11-08-project-audit.kr.md#6-로드맵)
- [학습 가이드](learning-guide.kr.md): 도메인, 요청 흐름, TypeORM, 공개/보호 API를 따라가는 입문 문서
- [설계 및 아키텍처](architecture.kr.md): Legacy/Catalog 구조, 데이터 관계, API 경계와 향후 방향
- [원인 분석 및 트러블슈팅](troubleshooting.kr.md): route, migration, relation, 공개 URL 문제 분석
- [체크리스트](checklists.kr.md): 학습, 기능 개발, DB, 음원 보안, 배포, 장애 대응 점검표

## 현재 구현 원칙

- `synchronize=true`는 어떤 환경에서도 사용하지 않습니다(기동 거부). 스키마는 Migration으로만 바꿉니다.
- 애플리케이션 시작 시 DB 생성이나 migration을 자동 실행하지 않습니다.
- 기존 migration 파일은 수정하지 않고, 새로운 schema 변경은 새 migration으로 추가합니다.
- 확정 정책상 날짜당 Playlist 수와 Playlist 내 동일 Track 수에는 제한을 두지 않습니다. 이에 대한 unique 제약을 추가하지 않습니다.
- Catalog Track은 개별 녹음이고 `Track 1:N AudioAsset` 관계입니다. 작품·정규 아티스트·별칭 및 공동 참여자 연결은 별도 테이블로 관리합니다. 기존 Track의 표시용 `artist` 문자열도 유지합니다.
- `Track.bpm`은 카탈로그 BPM, `AudioAsset.bpm`은 파일/분석 BPM으로 분리하며 자동 동기화하지 않습니다.
- 기존 Artist/Track/Playlist API는 `/music/legacy`에 보관하고, 새 catalog API는 `/music`을 사용합니다.
- Catalog Playlist는 `draft`/`published`/`archived` 상태를 사용하며 공개 API는 `published`만 반환합니다.
- Catalog Playlist item은 재생 순서인 `position`으로 정렬하며 `(playlistId, position)` unique 제약을 사용합니다. `displayPosition` 저장 필드는 추가되었지만 독립 편집·정렬에는 아직 사용하지 않습니다.
- 관리자가 로컬 파일을 업로드하고 Playlist 항목의 파일을 선택할 수 있습니다. 공개 응답은 저장 경로를 제외하며, 공개 상태와 `anonymousPlayable` 또는 JWT에 따라 로컬 파일의 Range 재생을 제공합니다. S3와 서명 URL은 미구현입니다.
- Catalog와 Legacy의 모든 **쓰기 API는 admin 전용**(`@AdminOnly()`)입니다. 공개 조회(`/music/tracks`, `/music/public/*`, `/music/legacy/tracks`)는 인증이 필요 없고, 나머지 조회는 로그인이 필요합니다.
- 삭제하려는 리소스를 다른 데이터가 참조하면(FK) 409 `FOREIGN_KEY_CONSTRAINT`를 반환합니다.
- 2026-09-13 기준 개발 DB에는 Legacy archive, Catalog music, Catalog playlist Migration이 적용되어 있었습니다. `1765000000000-AddRoleToUsers`를 포함한 환경별 상태는 `migration:show`로 확인합니다.

## 확정된 목표 정책 (아직 미구현)

- Catalog를 유일한 Music 기준으로 사용하고 Legacy 데이터를 이관·검증한 뒤 Legacy API·코드와 테이블을 정리합니다. 백업·복구 검증과 이관 대조가 선행되어야 하며, 아직 이관·삭제는 구현되지 않았습니다.
- Playlist 관리/표시 순서와 실제 재생 순서를 독립적으로 관리합니다. `displayPosition` 필드가 추가되었으나 별도 변경 API와 정렬 규칙은 미구현입니다.
- 활성 Catalog 레코드는 Playlist 항목을 포함해 soft delete하고 완전 삭제는 별도 관리자 처리로 분리합니다. 현재 soft delete와 복구는 미구현입니다.
- Playlist는 `draft → published → archived`로 전이하고, archived는 draft로 복원할 수 있습니다. soft delete는 공개 상태와 독립적으로 관리합니다.
- 공개 Playlist 메타데이터와 음원 재생 권한을 분리합니다. 현재 서버에서 로컬 파일을 직접 전달하며 S3 전환 시 만료되는 서명 URL을 검토합니다.

세부 구현 기준과 미해결 migration/API 항목은 [결정 및 후속 작업](decisions.md)을 참고합니다.
