# 작업 내역과 배운 점 (2026-11 감사와 후속 작업)

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11` (PR #10)
> 2026-11-08 ~ 11-09에 한 모든 작업을 시간순으로 정리한 학습 기록입니다. 단계마다 **문제 → 원인 → 조치 → 배운 점 → 관련 자료** 순서로 적었습니다.
> 세부 근거는 [감사 리포트](../audit/2026-11-08-project-audit.kr.md)에 있습니다(ID로 찾을 수 있음).

## 한눈에 보기

| 단계 | 날짜 | 주제 | 커밋 |
| --- | --- | --- | --- |
| 1 | 11-08 | 감사, 저장소 정리, 품질 게이트, CI | `106022f`, `a796b4c` |
| 2 | 11-08 | 보안·데이터 결함 수정, 구조 개선, 문서화 | `117a3ef`, `5f79e4d`, `eb198c6`, `bba160e`, `959abf7`, `f4bacd8` |
| 3 | 11-08 | 환경별 env 파일, SNS 로그인 opt-in·전면 비활성 | `6964f5f`, `305e670` |
| 4 | 11-08 | DB 도구, 기동 시 pending 경고, CI MariaDB 검증, migration 결함 | `ae95565`, `7d3c4c2`, `1d2a21d`, `5b753f2` |
| 5 | 11-09 | env 파일 진단, migration 권한 사전 점검 | `d582af6`, `19b2834` |
| 6 | 11-09 | Local/Test/Prod 정리, 앱 전용 DB, 다른 DB 삭제 방지 | `da10717` 이후 |

## 1단계: 감사와 품질 게이트

**문제**

- lint 오류 17건, spec 타입 오류 4건이 있었습니다. 포맷 검사 스크립트와 CI가 없었습니다.
- `.gitignore`가 다른 프로젝트용이었고, 실행된 적 없는 고아 migration 파일이 있었습니다.
- production 의존성 취약점 11건(critical 1건 포함)이 있었습니다.

**원인**

"완료"의 기준이 코드에 고정되어 있지 않았습니다(검사를 사람이 기억해야 했음).

**조치**

- `lint:check`, `format:check`, `typecheck` 스크립트를 추가했습니다.
- GitHub Actions `verify` job을 추가했습니다(lint, format, typecheck, test, build, audit).
- Node 버전을 `.nvmrc`로 고정했습니다.
- `npm audit fix`로 취약점을 11건에서 5건으로 줄였습니다. 남은 5건은 메이저 업그레이드가 필요합니다.
- `.gitignore`를 NestJS 기준으로 다시 쓰고, 고아 migration을 삭제했습니다(DB-3).

**배운 점**

- 품질 기준은 **스크립트와 CI로 고정**해야 지켜집니다.
- 실행되지 않는 코드(고아 migration)는 문서보다 더 큰 오해를 만듭니다.

**자료:** [아키텍처 가이드 13장 품질 게이트](nestjs-operational-stability-guide.kr.md#13-품질-게이트), [보안 가이드](security-guide.kr.md)

## 2단계: 보안·데이터 결함 수정과 구조 개선

| 문제 | 원인 | 조치 | ID |
| --- | --- | --- | --- |
| 가입만 하면 누구나 음악 데이터를 생성·수정·삭제 | 인가(권한) 개념이 없음 | 최소 RBAC: `users.role`, `RolesGuard`, `@AdminOnly` | SEC-1 |
| Artist 삭제 시 409 대신 500 | PostgreSQL 오류 코드(`23503`)로 판별 | MariaDB 코드(`ER_ROW_IS_REFERENCED_2`)로 통일(`mariadb-errors.ts`) | DB-1 |
| PM2·Secrets Manager 경로에서 환경변수 23개 누락 | 키 목록이 두 곳에 따로 있음 | `runtime-env-keys.cjs` 한 곳 + drift spec | OPS-1 |
| 다른 앱의 Kakao 토큰으로 로그인 가능 | 토큰의 발급 앱을 확인하지 않음 | `access_token_info`의 `app_id` 검증 | SEC-3 |
| proxy 뒤에서 요청 제한을 모든 사용자가 공유 | `trust proxy` 미설정 | `TRUST_PROXY` 설정 | SEC-2 |
| 비밀번호 변경에 현재 비밀번호 확인 없음 | 계정 탈취 시 바로 변경 가능 | `currentPassword` 필수 | SEC-10 |
| application 계층이 HTTP 예외를 직접 던지고, SNS 오류 필터 5개가 같은 일을 반복 | 계층 경계와 공통화 부재 | `DomainError` + 중앙 필터, SNS 공통 커널 | CA-2, CA-7 |
| `users.password`가 기본 조회에 포함 | presenter에만 의존해 숨김 | `select: false` | DB-5 |

**배운 점**

- **인증(누구인가)과 인가(무엇을 할 수 있는가)는 다릅니다.** 로그인만 확인하면 권한 문제가 남습니다.
- 드라이버 오류 코드는 **실제로 쓰는 DB 기준**으로 판별합니다. DB를 바꾸면 이 부분이 조용히 깨집니다.
- 같은 목록이 두 곳에 있으면 반드시 어긋납니다. **한 곳에 두고 spec으로 어긋남을 막습니다.**

**자료:** [아키텍처 가이드](nestjs-operational-stability-guide.kr.md) 6~9장, [보안 가이드](security-guide.kr.md), [API 명세](../product/api-spec.kr.md)

## 3단계: 환경별 env 파일과 SNS 로그인 비활성화

**문제**

- 앱, migration CLI, e2e가 env 파일을 각자 다르게 골랐습니다. 운영 전용 파일이 없었습니다.
- Google은 플래그가 없으면 기본으로 켜졌습니다. 다른 provider는 키만 있으면 자동으로 켜졌습니다. 그래서 설정이 빠지면 운영 기동이 실패하거나, 의도치 않게 provider가 켜졌습니다.
- e2e가 개발 DB(`app_db`)를 쓸 수 있는 예외가 있었습니다.

**조치**

- `src/config/env-files.ts` 하나로 파일을 고르게 했습니다: `.env` / `.env.test.local` / `.env.production`, `ENV_FILE`로 재지정 가능
- `env:check[:test|:prod]`: DB에 접속하지 않고 설정만 검증합니다.
- `migration:*:prod`: `dist` 기반으로 실행해 운영 서버에 ts-node가 필요 없게 했습니다.
- SNS 5종을 **명시적 opt-in**으로 바꾸고 현재는 모두 껐습니다. Naver accessToken 로그인은 기본 차단합니다(SEC-3).
- test 환경은 `*_test` DB만 허용합니다.

**배운 점**

- "설정이 없으면 켜진다"는 기본값은 위험합니다. **위험한 기능은 명시적으로 켜게** 합니다.
- 같은 규칙(파일 선택, 검증)을 모든 진입점이 공유해야 "로컬에서는 되는데 migration은 안 되는" 일이 사라집니다.

**자료:** [환경별 DB·설정 가이드](../deployment/database-environments.kr.md), [SNS 재활성화 체크리스트](../auth/sns-reenable-checklist.kr.md), [SNS 운영 가이드](sns-login-operational-guide.kr.md)

## 4단계: DB 도구, CI MariaDB 검증, migration 결함

**문제**

- DB나 테이블을 언제, 어떻게 만드는지 정해져 있지 않았습니다.
- migration 전체 체인을 실제 MariaDB에서 실행해 본 적이 없었습니다.

**조치**

- `db:check`(읽기 전용)와 `db:setup`(DB가 없으면 생성 + migration)을 추가했습니다.
- 앱 기동 시 pending migration을 경고합니다(`MigrationStatusService`). 자동 실행은 하지 않습니다.
- CI `database` job(MariaDB 10.11): 빈 DB → 전체 체인 → pending 없음 → 최신 revert/재적용 → drift → e2e

**CI가 처음 실행되자 드러난 결함**

- **DB-13:** 1761·1762 migration이 MariaDB 드라이버가 지원하지 않는 `createUniqueConstraint`를 써서, **빈 DB에서는 체인이 실패**했습니다. 기존 DB에는 이력만 기록되어 있어 드러나지 않았습니다. 같은 이름의 unique index로 고쳤습니다.
- **DB-12:** entity와 migration 결과가 다릅니다(FK·인덱스 이름, `datetime` 정밀도). 해결 방향은 결정이 필요하며, 지금은 CI에서 보고만 합니다.

**배운 점**

- **빈 DB에서 처음부터 실행해 보는 검증**만이 "기존 DB에서는 우연히 되는" 결함을 잡습니다.
- migration은 명령으로 적용합니다. 기동 시 자동 실행은 실패하면 재시작을 반복하고, 공유 DB를 바꿉니다.

**자료:** [DB·스키마 관리 학습 가이드](database-schema-management.kr.md) 4~8.1장

## 5단계: 첫 실서버 연결, env 파일 진단과 권한 사전 점검

**문제 1:** `.env.test.local`에 비밀번호를 넣고 `npm run db:check`를 실행했더니 `DB_PASSWORD is required.`가 나왔습니다.

- **원인:** 이 명령은 `.env`를 읽습니다. 그런데 오류에 어느 파일을 읽었는지가 없었습니다.
- **조치**(`env-diagnostics.ts`)
  - 오류에 읽은 파일과 `NODE_ENV`를 붙입니다.
  - 다른 환경 파일에 그 키가 있으면 `Hint:`를 출력합니다(값은 출력하지 않음).

**문제 2:** 계정에 `DROP` 권한이 없어, migration이 6번째 `RENAME TABLE`에서 **중간 실패**할 상태였습니다.

- MariaDB DDL은 되돌릴 수 없어 DB가 반쯤 바뀐 상태로 남습니다.
- **조치:** `SHOW GRANTS`를 해석해 필요한 8개 권한을 미리 판정합니다(`evaluatePrivileges`).
  - 부족하면 `db:setup`이 **아무것도 바꾸지 않고 멈추고**, 빠진 권한만 담은 GRANT를 출력합니다.

**배운 점**

- **오류 메시지는 "무엇이"뿐 아니라 "어디서"를 말해야 합니다.**
- 되돌릴 수 없는 작업은 **사전 조건을 읽기 전용으로 확인한 뒤** 시작합니다(fail fast).

**자료:** [DB·스키마 관리 학습 가이드 8.2](database-schema-management.kr.md#82-사례-실제-개발-서버에-처음-연결할-때-2026-11-09)

## 6단계: Local / Test / Prod 정리와 다른 DB 삭제 방지

**요청:** local, dev, prod를 다시 정리하고, DB 서버에 있는 다른 DB는 절대 삭제하지 않습니다.

**점검 결과(삭제 위험 경로)**

- `DB_SYNCHRONIZE=true`는 Prod에서만 막았습니다. Local/Test에서 켜면 컬럼이 자동 삭제될 수 있었습니다.
- `db:setup`은 다른 앱 테이블이 있는 DB에서도 진행했습니다.
- `db:reset:test`는 이름(`*_test`)만 보고 DB 전체를 지웠습니다.

**조치**

| 항목 | 내용 |
| --- | --- |
| 환경 용어 | **Local**(개발 PC + 개발 서버 DB), **Test**(Local 안의 e2e), **Prod**(EC2)로 통일. 파일과 명령은 유지 |
| Local DB | 앱 전용 새 DB `app_db_dev`. 기존 DB는 사용하지 않음 |
| 소유 판정 | `APP_TABLES`와 `inspectOwnership`으로 대상 DB에 앱이 아닌 객체가 있는지 확인 |
| 거부 동작 | 다른 객체가 있으면 `db:setup`·`db:reset`이 아무것도 바꾸지 않고 거부. `db:check`는 `ownership: shared`로 경고 |
| `synchronize` | 모든 환경에서 기동 거부 |
| 보증 테스트 | 쓰기 SQL이 대상 DB 외에는 참조하지 않는지 spec으로 고정. `APP_TABLES`와 entity·migration을 대조 |

**실서버 확인**

- `app_db_test` 생성과 9개 migration 적용, `--strict` 통과, e2e 통과
- `db:reset:test`가 소유를 확인한 뒤 초기화하고 다시 적용
- 같은 서버의 다른 DB는 변경 없음(0 tables 유지)

**배운 점**

- **파괴적 명령은 이름이 아니라 내용으로 안전을 확인합니다.**
- 공유 서버에서는 **앱마다 DB와 권한을 분리**합니다. GRANT는 앱 DB 단위로만 줍니다.

**자료:** [환경별 가이드 2장 DB 삭제 안전 원칙](../deployment/database-environments.kr.md#2-db-삭제-안전-원칙), [DB·스키마 관리 학습 가이드 8.3](database-schema-management.kr.md#83-사례-같은-서버의-다른-db를-지키기-2026-11-09)

## 반복해서 쓰인 원칙

| 원칙 | 이번 작업에서의 예 |
| --- | --- |
| **같은 규칙은 한 곳에** | env 파일 선택(`env-files.ts`), 환경변수 키 목록(`runtime-env-keys.cjs`), `APP_TABLES` |
| **목록이 어긋나지 않게 spec으로 고정** | 런타임 키 drift spec, `APP_TABLES` 대조 spec, 쓰기 범위 spec |
| **fail fast: 시작 전에 막기** | 기동 시 설정 검증, `env:check`, 권한·소유 사전 점검 |
| **읽기 전용 점검이 먼저** | `db:check`, `migration:show`, 운영 배포 전 `db:check:prod` |
| **최소 권한** | 앱 DB 단위 GRANT, 운영 계정 `'<app>'@'localhost'`, 운영에서 DB 생성 금지 |
| **위험한 기능은 명시적으로 켜기** | SNS opt-in, Naver accessToken 기본 차단, `synchronize` 금지 |
| **빈 DB에서 처음부터 검증** | CI `database` job, `db:reset:test` |
| **비밀은 출력하지 않기** | 비밀번호·secret 미출력, `SHOW GRANTS` 해시 가림, Hint는 키 존재만 |
| **사람이 결정할 것은 기록하고 남기기** | DB-12 drift 방향, P0 배포 전 확인 항목(감사 리포트 6장) |

## 남은 과제

- **DB-12:** entity·migration drift 해소. 권장은 entity에 이름과 정밀도를 선언하는 것이며, 해소 후 CI drift 단계를 필수로 바꿉니다.
- **P0(main 배포 전):**
  - 운영 `.env.production` 작성
  - 클라이언트에 브레이킹 변경 공지
  - 브랜치 보호
- **P1:** e2e 시나리오 확장, refresh token, legacy use-case spec 등. [감사 리포트 6장](../audit/2026-11-08-project-audit.kr.md#6-로드맵)을 봅니다.
