# Music API 운영 개선 문서

NestJS Music API와 EC2 내부 MariaDB 운영 개선 문서 모음입니다.

## 문서 구조

- [개선 작업 프롬프트](roadmap/github-copilot-nestjs-mariadb-improvement-prompt.md): 전체 요구사항과 단계별 체크리스트
- [MariaDB 운영 가이드](database/mariadb-operations.md): DB 생성, migration, backup, 배포, 보안
- [결정 및 보류 항목](decisions.md): 현재 코드와 제품 정책에서 확정되지 않은 사항
- [Music API 구조 검토](../music-api-reorganization-review.kr.md): 현재 구조의 문제와 단계적 개선 방향
- [학습 가이드](learning-guide.kr.md): 도메인, 요청 흐름, TypeORM, 공개/보호 API를 따라가는 입문 문서
- [설계 및 아키텍처](architecture.kr.md): Legacy/Catalog 구조, 데이터 관계, API 경계와 향후 방향
- [원인 분석 및 트러블슈팅](troubleshooting.kr.md): route, migration, relation, 공개 URL 문제 분석
- [체크리스트](checklists.kr.md): 학습, 기능 개발, DB, 음원 보안, 배포, 장애 대응 점검표

## 현재 구현 원칙

- 운영 환경에서 `synchronize=true`를 사용하지 않습니다.
- 애플리케이션 시작 시 DB 생성이나 migration을 자동 실행하지 않습니다.
- 기존 migration 파일은 수정하지 않고, 새로운 schema 변경은 새 migration으로 추가합니다.
- Playlist 날짜 중복과 Playlist 내 Track 중복 정책은 확정 전까지 DB 제약으로 강제하지 않습니다.
- Active catalog는 `Track 1:N AudioAsset` 관계이며, 실제 S3 업로드 구현은 별도 작업입니다.
- `Track.bpm`은 카탈로그 BPM, `AudioAsset.bpm`은 파일/분석 BPM으로 분리하며 자동 동기화하지 않습니다.
- 기존 Artist/Track/Playlist API는 `/music/legacy`에 보관하고, 새 catalog API는 `/music`을 사용합니다.
- Catalog Playlist는 `draft`/`published`/`archived` 상태를 사용하며 공개 API는 `published`만 반환합니다.
- Catalog Playlist item은 `position`으로 정렬하고 `(playlistId, position)` unique 제약을 사용합니다.
- 공개 응답에는 음원 URL과 내부 storage 정보가 포함되지 않습니다. playback/presigned URL은 후속 작업입니다.
- 현재 개발 DB에는 Legacy archive, Catalog music, Catalog playlist Migration이 모두 적용되어 있습니다. 다른 환경은 `migration:show`로 확인합니다.
