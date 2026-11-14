# 문서 인덱스

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 모든 문서 상단에 `최신화 기준`(마지막으로 코드와 대조한 날짜·커밋)이 표기되어 있습니다.
> `이력 문서`는 작성 시점에 고정된 기록이며, 이후 변경은 반영하지 않습니다.

## 처음 읽는 순서

1. [서비스 개요](product/overview.kr.md): 무엇을 하는 서버인지
2. [기능 명세](product/features.kr.md) → [API 명세](product/api-spec.kr.md): 규칙, 정책, 라우트, 권한
3. [아키텍처 학습 가이드](learning/nestjs-operational-stability-guide.kr.md): 코드 구조와 계층
4. [DB·스키마 관리 학습 가이드](learning/database-schema-management.kr.md): DB·테이블을 누가 언제 만들고, migration을 어떻게 적용하고 검증하는지
5. [환경별 DB·설정 가이드](deployment/database-environments.kr.md): Local / Test / Prod 연결과 명령(처음 연결: `db:check` → `db:setup`), DB 삭제 안전 원칙
6. [API 보안 학습 가이드](learning/api-security-guide.kr.md): 위협 모델, 인증·인가, 외부 IdP 검증, 직접 점검하는 방법
7. [작업 내역과 배운 점](learning/work-history-2026-11.kr.md): 2026-11 감사와 후속 작업 전체
8. 최신 감사: [보안 전수 감사(2026-11-09)](audit/2026-11-09-security-audit.kr.md)와 [프로젝트 감사(2026-11-08)](audit/2026-11-08-project-audit.kr.md): 현재 위험, 로드맵, 릴리스 체크리스트
9. [DB 개선 가이드](learning/database-improvement-guide.kr.md): 남은 DB 과제의 우선순위와 단계
10. [다국어 플랫폼 아키텍처 감사](architecture/AS_IS.md): 현재 음악 API와 목표 사전·학습 플랫폼의 차이, 미확인 운영 환경 및 제안 문서 묶음

학습 자료 전체의 순서와 자가 점검·실습 모음은 [학습 로드맵](learning/README.md)에 있습니다.

## 학습 사이트 (HTML)

이 문서들을 학습 순서대로 묶은 웹사이트 스냅샷이 [`docs/html/`](html/README.md)에 있습니다. 브라우저로 `docs/html/index.html`을 열면 서버 없이 동작합니다(검색, 목차, 다크 테마, 읽음 표시).

- **md가 원본입니다.** 평소에는 md만 고치고, 필요한 시점에 `npm run docs:html`로 스냅샷을 다시 만듭니다.
- 마지막 스냅샷 이후 바뀐 문서는 `npm run docs:html:status`로 확인합니다.
- 구조, 갱신 절차, 문제 해결: [사이트 관리 가이드](html/README.md)

## 디렉터리 구성

| 경로 | 목적 | 문서 |
| --- | --- | --- |
| `product/` | 기획: 제품 범위, 기능 규칙, API 계약 | [overview](product/overview.kr.md), [features](product/features.kr.md), [api-spec](product/api-spec.kr.md) |
| `architecture/` | 다국어 플랫폼 AS-IS/TO-BE, 환경·인프라, Admin/Live 경계 | [AS-IS](architecture/AS_IS.md), [TO-BE](architecture/TO_BE.md), [환경](architecture/ENVIRONMENTS.md), [인프라](architecture/INFRASTRUCTURE.md), [Admin/Live](architecture/ADMIN_LIVE_API.md) |
| `database/` | 신규 다국어 도메인의 제안 ERD | [ERD](database/ERD.md) |
| `api/` | 신규 다국어 도메인의 REST 계약 초안 | [API_SPEC](api/API_SPEC.md) |
| `operations/` | 신규 서비스 배포·보안·복구 설계 | [배포](operations/DEPLOYMENT.md), [보안](operations/SECURITY.md), [백업·복구](operations/BACKUP_RECOVERY.md) |
| `plans/` | 단계별 구현 로드맵과 작업 목록 | [구현 로드맵](plans/IMPLEMENTATION_PLAN.md), [체크리스트](plans/TASK_CHECKLIST.md) |
| `prompts/` | 사용자 요청에 포함된 단계별 실행 프롬프트 예외 산출물 | [Phase Prompts](prompts/PHASE_PROMPTS.md) |
| `audit/` | 프로젝트 감사 기록(날짜별) | [2026-11-09 보안](audit/2026-11-09-security-audit.kr.md) (최신), [2026-11-08](audit/2026-11-08-project-audit.kr.md), [2026-09-02](audit/2026-09-02-project-audit.kr.md) (이력) |
| `auth/` | 로컬·SNS 로그인 설계와 provider 설정 | [SNS 로그인 개요](auth/sns-login-overview.kr.md), [SNS 재활성화 체크리스트](auth/sns-reenable-checklist.kr.md), [Google 로그인](auth/google-login.kr.md), [로그인 API 재평가](auth/login-api-reassessment.kr.md) (이력) |
| `music/` | 음악 카탈로그 설계, 결정, 운영 | [music/README](music/README.md) |
| `deployment/` | 환경별 DB·env 설정과 명령, EC2 배포 절차 | [환경별 DB·설정 가이드](deployment/database-environments.kr.md), [EC2 MariaDB 배포](deployment/mariadb-systemd.kr.md) |
| `html/` | 학습 사이트: 생성기(`_tools/`)와 HTML 스냅샷. **생성물은 직접 수정하지 않음** | [사이트 관리 가이드](html/README.md) |
| `learning/` | 학습 가이드, 운영 체크리스트, 장애 이력 | [학습 로드맵](learning/README.md), [작업 내역과 배운 점](learning/work-history-2026-11.kr.md), [아키텍처 학습 가이드](learning/nestjs-operational-stability-guide.kr.md), [DB·스키마 관리](learning/database-schema-management.kr.md), [DB 개선 가이드](learning/database-improvement-guide.kr.md), [API 보안 학습 가이드](learning/api-security-guide.kr.md), [시크릿 관리 가이드](learning/security-guide.kr.md), [배포 시크릿 체크리스트](learning/deployment-secrets-checklist.kr.md), [SNS 운영 가이드](learning/sns-login-operational-guide.kr.md), [용어집](learning/glossary.kr.md), [실행 오류 이력](learning/runtime-troubleshooting-history.kr.md) (이력) |

저장소 루트 문서:

- [README.md](../README.md): 설치, 설정, 실행, 검증
- [API_EXAMPLES.md](../API_EXAMPLES.md): curl 예시

## 문서 작성 규칙

- 새 문서나 갱신한 문서 상단에 `> 최신화 기준: YYYY-MM-DD · <branch> <commit>`을 적습니다.
- 코드 경로는 실제 존재하는 경로만 링크합니다. 파일을 이동하거나 삭제하면 관련 문서도 같은 PR에서 고칩니다.
- 결정이 필요한 정책은 [music/decisions.md](music/decisions.md) 또는 최신 감사 리포트 로드맵에 적습니다. AI 작업 프롬프트는 원칙적으로 docs에 두지 않으며, 명시적으로 요청된 Phase 프롬프트만 `prompts/`의 예외 산출물로 둡니다.
- 감사 리포트는 날짜별 새 파일로 추가하고, 이전 리포트는 이력으로 남깁니다. 같은 감사의 후속 조치는 리포트 끝에 장을 추가해 기록합니다.
- `learning/`은 개념과 이유, `deployment/`는 실행 절차를 담습니다. 같은 주제는 두 문서가 서로 링크합니다.
- **HTML 사이트는 md에서 생성합니다.** `docs/html/`의 `.html`은 고치지 않습니다. 새 문서는 `docs/html/_tools/site.config.json`에 넣어 학습 순서를 정합니다.
- 링크와 앵커는 CI(`npm run docs:html:verify`)가 매 PR 검사합니다. 깨지면 CI가 실패합니다.
