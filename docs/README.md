# 문서 인덱스

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 모든 문서 상단에 `최신화 기준`(마지막으로 코드와 대조한 날짜·커밋)이 표기되어 있습니다.
> `이력 문서`는 작성 시점에 고정된 기록이며, 이후 변경은 반영하지 않습니다.

## 처음 읽는 순서

1. [서비스 개요](product/overview.kr.md): 무엇을 하는 서버인지
2. [기능 명세](product/features.kr.md) → [API 명세](product/api-spec.kr.md): 규칙, 정책, 라우트, 권한
3. [아키텍처 학습 가이드](learning/nestjs-operational-stability-guide.kr.md): 코드 구조와 계층
4. [DB·스키마 관리 학습 가이드](learning/database-schema-management.kr.md): DB·테이블을 누가 언제 만들고, migration을 어떻게 적용하고 검증하는지
5. [환경별 DB·설정 가이드](deployment/database-environments.kr.md): Dev/Test/Prod 연결과 명령(처음 연결: `db:check` → `db:setup`)
6. [최신 감사 리포트](audit/2026-11-08-project-audit.kr.md): 현재 위험, 로드맵, 릴리스 체크리스트

## 디렉터리 구성

| 경로 | 목적 | 문서 |
| --- | --- | --- |
| `product/` | 기획: 제품 범위, 기능 규칙, API 계약 | [overview](product/overview.kr.md), [features](product/features.kr.md), [api-spec](product/api-spec.kr.md) |
| `audit/` | 프로젝트 감사 기록(날짜별) | [2026-11-08](audit/2026-11-08-project-audit.kr.md) (최신), [2026-09-02](audit/2026-09-02-project-audit.kr.md) (이력) |
| `auth/` | 로컬·SNS 로그인 설계와 provider 설정 | [SNS 로그인 개요](auth/sns-login-overview.kr.md), [SNS 재활성화 체크리스트](auth/sns-reenable-checklist.kr.md), [Google 로그인](auth/google-login.kr.md), [로그인 API 재평가](auth/login-api-reassessment.kr.md) (이력) |
| `music/` | 음악 카탈로그 설계, 결정, 운영 | [music/README](music/README.md) |
| `deployment/` | 환경별 DB·env 설정과 명령, EC2 배포 절차 | [환경별 DB·설정 가이드](deployment/database-environments.kr.md), [EC2 MariaDB 배포](deployment/mariadb-systemd.kr.md) |
| `learning/` | 학습 가이드, 운영 체크리스트, 장애 이력 | [아키텍처 학습 가이드](learning/nestjs-operational-stability-guide.kr.md), [DB·스키마 관리](learning/database-schema-management.kr.md), [보안 가이드](learning/security-guide.kr.md), [배포 시크릿 체크리스트](learning/deployment-secrets-checklist.kr.md), [SNS 운영 가이드](learning/sns-login-operational-guide.kr.md), [실행 오류 이력](learning/runtime-troubleshooting-history.kr.md) (이력) |

저장소 루트 문서:

- [README.md](../README.md): 설치, 설정, 실행, 검증
- [API_EXAMPLES.md](../API_EXAMPLES.md): curl 예시

## 문서 작성 규칙

- 새 문서나 갱신한 문서 상단에 `> 최신화 기준: YYYY-MM-DD · <branch> <commit>`을 적습니다.
- 코드 경로는 실제 존재하는 경로만 링크합니다. 파일을 이동하거나 삭제하면 관련 문서도 같은 PR에서 고칩니다.
- 결정이 필요한 정책은 [music/decisions.md](music/decisions.md) 또는 최신 감사 리포트 로드맵에 적습니다. AI 작업 프롬프트는 docs에 두지 않습니다.
- 감사 리포트는 날짜별 새 파일로 추가하고, 이전 리포트는 이력으로 남깁니다. 같은 감사의 후속 조치는 리포트 끝에 장을 추가해 기록합니다.
- `learning/`은 개념과 이유, `deployment/`는 실행 절차를 담습니다. 같은 주제는 두 문서가 서로 링크합니다.
