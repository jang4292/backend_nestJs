# Music API 운영 개선 문서

NestJS Music API와 EC2 내부 MariaDB 운영 개선 문서 모음입니다.

## 문서 구조

- [개선 작업 프롬프트](roadmap/github-copilot-nestjs-mariadb-improvement-prompt.md): 전체 요구사항과 단계별 체크리스트
- [MariaDB 운영 가이드](database/mariadb-operations.md): DB 생성, migration, backup, 배포, 보안
- [결정 및 보류 항목](decisions.md): 현재 코드와 제품 정책에서 확정되지 않은 사항
- [Music API 구조 검토](../music-api-reorganization-review.kr.md): 현재 구조의 문제와 단계적 개선 방향

## 현재 구현 원칙

- 운영 환경에서 `synchronize=true`를 사용하지 않습니다.
- 애플리케이션 시작 시 DB 생성이나 migration을 자동 실행하지 않습니다.
- 기존 migration 파일은 수정하지 않고, 새로운 schema 변경은 새 migration으로 추가합니다.
- Playlist 날짜 중복과 Playlist 내 Track 중복 정책은 확정 전까지 DB 제약으로 강제하지 않습니다.
- AudioAsset은 현재 파일 메타데이터와 저장소 경계만 준비하며, S3 업로드 구현은 별도 작업입니다.
- API는 기존 경로와 port/use-case 방향을 우선 유지합니다.
