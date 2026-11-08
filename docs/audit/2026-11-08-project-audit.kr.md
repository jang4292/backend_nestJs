# 프로젝트 전수 감사 리포트 (2026-11-08)

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 이전 감사: [2026-09-02 감사](2026-09-02-project-audit.kr.md) (이력 문서)
> 후속 조치(같은 날): 환경별 DB·env 파일 정리와 SNS 로그인 전면 비활성화 — [9장](#9-후속-조치-환경별-db-설정과-sns-비활성화)
> 후속 조치(2026-11-09): 새 개발 DB 연결, DB 생성·점검 도구, MariaDB CI 검증, migration 결함 수정 — [10장](#10-후속-조치-개발-db-연결과-스키마-관리-체계)

## 0. 요약

- **감사 기준:** Clean Architecture, DDD, API 백엔드 운영 기준(보안, 인증·인가, 데이터 무결성, 운영성, 테스트)
- **감사 대상:** develop 전체와 develop → main 릴리스 범위

### 결론

이번 브랜치(`chore/project-audit-2026-11`)를 develop에 병합하면 develop → main 릴리스를 진행할 수 있는 상태가 됩니다. 다만 다음 두 가지는 배포 전에 반드시 수행해야 합니다.

- [5.3 배포 체크리스트](#53-배포-체크리스트)
- [6. 로드맵](#6-로드맵)의 **P0** 항목 확인

| 지표 | 감사 시작 (`9b731ef`) | 감사 후 |
| --- | --- | --- |
| 유닛 테스트 | 31 suites / 163 tests 통과 | **46 suites / 310 tests 통과** |
| 빌드 타입체크 | 통과 | 통과 |
| 전체 타입체크(spec 포함) | 오류 4건 | **0건** |
| ESLint | 오류 17건(파일 10개) | **0건** |
| Prettier | 확인 스크립트 없음 | `format:check` 통과 |
| `npm audit --omit=dev` | 11건 (critical 1, high 4, moderate 6) | **5건 (high 2, moderate 3)** — 남은 건은 모두 메이저 업그레이드가 필요함 |
| CI | 없음 | GitHub Actions: `verify`(lint, format, typecheck, test, build, audit) + `database`(MariaDB 10.11에서 migration 전체 체인, revert/재적용, e2e) |

### 이번에 수정한 주요 결함

| 결함 | 수정 전 동작 | 수정 후 |
| --- | --- | --- |
| 음악 쓰기 API 권한 없음 | 가입만 하면 누구나 카탈로그·플레이리스트를 생성, 수정, 삭제, 공개 가능 | admin 전용 |
| PM2·Secrets Manager 경로의 환경변수 누락 | 23개 키가 전달되지 않아 Apple/Kakao/Naver/Facebook 로그인이 꺼진 채(503) 기동됨 | 모든 키 전달 |
| Artist 삭제 시 FK 판별 오류 | PostgreSQL 코드로 판별해 409 대신 500 | 409 |
| SNS 로그인 중 DB 오류 노출 | 오류 메시지가 클라이언트에 그대로 전달되고 서버 로그에는 남지 않음 | 마스킹 후 로그 기록 |
| 다른 앱에서 발급된 Kakao 토큰 | 이 서비스 로그인에 그대로 사용 가능 | 발급 앱 검증 후 거부 |
| reverse proxy 뒤의 요청 제한 | 모든 사용자가 proxy IP 하나의 제한을 공유 | `TRUST_PROXY` 설정으로 실제 클라이언트 IP 기준 집계 |
| 로컬 계정과 같은 email의 SNS 첫 로그인 | `users.email` UNIQUE 위반으로 500 | 정상 로그인 |
| 빈 MariaDB에 migration 적용(10장) | `AddUniqueEmailToUsers`에서 `MySql does not support unique constraints`로 실패. 새 DB를 만들 수 없음 | 전체 체인 통과(CI가 매 PR 검증) |

## 1. 범위와 방법

| 영역 | 방법 |
| --- | --- |
| 아키텍처 | 계층 의존 방향(domain ← application ← infrastructure/interface), 포트·어댑터 일관성, 모듈 경계, 중복 코드 비교(provider 이름 정규화 후 diff) |
| API 보안 | 인증·인가 범위, 입력 검증, 오류 정보 노출, OAuth/OIDC 검증 단계, rate limit, CORS, 프록시 |
| 데이터 | TypeORM entity와 migration 정합성, FK/UNIQUE 오류 처리, 트랜잭션 격리, 비밀번호 컬럼 노출 |
| 운영 | 환경변수 검증, 배포 스크립트(PM2/systemd/Secrets Manager), health, graceful shutdown, 외부 호출 타임아웃, 의존성 취약점 |
| 품질 | 타입체크, ESLint, Prettier, 유닛 테스트, 빌드, CI |
| 저장소 | `.gitignore`, 추적 파일, Git 이력의 비밀값 검색(값은 출력하지 않음) |
| 문서 | docs/ 전체의 현행성(삭제된 경로, PostgreSQL 서술, 실제 라우트와의 차이) |
| 릴리스 | `main...develop` diff, 브레이킹 변경, 배포 순서 |

실행 검증은 아래 세 가지로 했습니다.

1. **품질 게이트:** `npm run lint:check`, `npm run format:check`, `npm run typecheck`, `npx jest`, `npm run build`, `npm audit --omit=dev`
2. **DI·HTTP 스모크:** 빌드된 `AppModule` 전체에서 `DataSource`만 가짜로 바꿔 띄우고 실제 HTTP 요청을 보냈습니다(결과는 [7장](#7-검증과-한계)).
3. **라우트 추출:** 빌드된 컨트롤러 메타데이터에서 전체 라우트와 권한을 뽑았습니다([API 명세](../product/api-spec.kr.md)의 근거).

## 2. 심각도 기준

| 등급 | 의미 |
| --- | --- |
| High | 권한 우회, 비밀 정보 노출, 데이터 무결성 손상, 운영 기능 중단으로 이어질 수 있음 |
| Medium | 특정 조건에서 오동작하거나 보안 수준을 낮추고, 유지보수 비용을 크게 높임 |
| Low | 일관성, 가독성, 관측성 개선 |

조치 상태 표기:

- ✅: 이번 브랜치에서 수정
- 📌: [로드맵](#6-로드맵)에 기록
- 📝: 문서화 또는 운영 절차로 대응

## 3. 발견 사항과 조치

### 3.1 Clean Architecture / DDD

| ID | 등급 | 발견 사항 | 근거 | 조치 |
| --- | --- | --- | --- | --- |
| CA-1 | High | Users use-case가 `Repository<User>`, `bcrypt`, interface DTO에 직접 의존함 | `src/users/application/use-cases/*` (수정 전) | ✅ `USER_REPOSITORY_PORT`·`PASSWORD_HASHER_PORT`와 TypeORM/bcrypt 어댑터 도입, command 타입 사용 |
| CA-2 | Medium | application 계층이 `@nestjs/common` HTTP 예외를 직접 던짐(17개 파일) | 예: `delete-artist.use-case.ts` | ✅ `DomainError` 계층 도입, `GlobalExceptionFilter`에서 중앙 매핑. users, local login, artist 삭제는 전환함 / 📌 legacy·catalog의 나머지 use-case |
| CA-3 | Medium | legacy music use-case 9개가 interface DTO를 import하고 entity를 그대로 반환함 | `src/music/application/use-cases/**` | 📌 P2 |
| CA-4 | Medium | 모든 repository port 시그니처가 TypeORM entity를 사용함(도메인 모델과 ORM 미분리) | `src/music/application/ports/*`, `user-repository.port.ts` | 📌 P2. 이번에는 의존 방향만 정리 |
| CA-5 | Medium | `CatalogMusicService`가 port와 Repository를 섞어 쓰는 god service이며 use-case가 없음 | `src/music/catalog/catalog-music.service.ts` | 📌 P2 |
| CA-6 | Medium | `MusicService`가 use-case 20개를 그대로 전달하는 facade라 계층만 늘림 | `src/music/music.service.ts` | 📌 P2 |
| CA-7 | Medium | SNS 5개 모듈이 사실상 복사본: 예외 필터 5개 동일, kakao/naver/facebook use-case·controller는 provider 이름을 지우면 0줄 차이 | `src/auth/{provider}/**` | ✅ 공통 `SocialAuthError`·`SocialAuthExceptionFilter`·`toSocialAuthError`로 통합 / 📌 use-case 통합 P2 |
| CA-8 | Medium | 도메인 모델이 빈약함: Playlist 공개 상태 전이에 규칙이 없음(archived를 published로 바꿀 수 있고, 재공개하면 `publishedAt`이 초기화됨) | `catalog-music.service.ts` publish | 📌 P1 |
| CA-9 | Low | `common`과 `session`이 users 모듈 타입에 의존함(공유 커널 경계 역전) | `common/auth/authenticated-request.ts`, `session-issuer.port.ts` | 📌 P2 |
| CA-10 | Low | `JwtAuthGuard`가 passport 전역 등록이라는 부수효과에 기대어 동작하고, users ↔ session 모듈이 순환 참조함 | `session.module.ts` | 📌 P2 |
| CA-11 | Low | 전역과 중복된 `RequestIdInterceptor`·`@Body(ValidationPipe)` 적용 | SNS·users·local 컨트롤러 | ✅ 제거 |
| CA-12 | Low | 죽은 코드 | `common/filters/http-exception.filter.ts`, `google/interface/response.helper.ts`, `validate-password.use-case.ts` | ✅ 삭제 |

### 3.2 API 보안 (인가·입력·노출)

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| SEC-1 | **High** | 역할·소유자 개념이 없어, 가입한 누구나 카탈로그 트랙·음원·플레이리스트를 생성, 수정, 삭제, 공개할 수 있음 | ✅ 최소 RBAC 도입: `users.role`(user/admin) 마이그레이션, `@AdminOnly()`. catalog 쓰기 11개, legacy 쓰기 12개 라우트를 admin 전용으로 전환. 쓰기 라우트에 `@AdminOnly`가 빠지면 실패하는 메타데이터 spec 추가 |
| SEC-2 | **High** | `trust proxy` 미설정. proxy 뒤에서는 Throttler가 proxy IP 하나로 집계해, 전역 10회/60초와 로그인 5회/분 제한을 전체 사용자가 공유함 | ✅ `TRUST_PROXY` 환경변수 추가 / 📝 배포 시 설정 필요 |
| SEC-3 | **High** | Kakao·Naver는 클라이언트가 보낸 access token으로 프로필만 조회하고, 그 토큰이 이 앱에서 발급됐는지 확인하지 않음(토큰 치환 공격) | ✅ Kakao: `/v1/user/access_token_info`의 `app_id`를 `KAKAO_APP_ID`와 비교 / ✅ Naver: accessToken 로그인 기본 차단(`AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED=false`, code flow만). SNS 전체도 현재 비활성 |
| SEC-4 | **High** | SNS 컨트롤러가 알 수 없는 오류(TypeORM "Duplicate entry 'x@y'…" 등)의 원문을 `*_INTERNAL_ERROR`로 클라이언트에 그대로 내려보내고 서버에는 로그를 남기지 않음 | ✅ 메시지를 마스킹하고 requestId·원인(`Error.cause`)을 redaction 후 로그에 기록 |
| SEC-5 | Medium | OAuth `state`와 `expectedState`가 모두 클라이언트 body에서 들어와, 서버 측 비교는 CSRF 방어 효과가 없음 | 📝 state 검증은 redirect를 받는 클라이언트의 책임임을 문서화 / 📌 P1 서버 저장형 state/PKCE |
| SEC-6 | Medium | `exchange-code`가 provider의 access/refresh token을 호출자에게 반환하고, `verify-id-token`은 공개 검증기로 동작함 | 📌 P1 필요성 재검토 후 제한 |
| SEC-7 | Medium | Apple 최초 로그인 시 클라이언트가 보낸(서명되지 않은) email이 ID Token의 email을 덮어씀 | ✅ token claim 우선. 클라이언트 email은 token에 없을 때만 미검증으로 사용하고 `@IsEmail`로 검증 |
| SEC-8 | Medium | SNS 로그인이 `users.email`을 검증 여부와 상관없이 덮어씀. 다른 계정이 쓰는 email이면 UNIQUE 위반으로 500 | ✅ 기존 email은 덮어쓰지 않음. 미검증이거나 이미 사용 중인 email은 `users`에 기록하지 않고 `social_accounts`에만 저장. 자동 계정 병합은 하지 않음 |
| SEC-9 | Medium | 계정이 없거나 비밀번호가 없으면 bcrypt를 건너뛰어 응답 시간으로 계정 존재 여부가 드러남 | ✅ 모든 경로에서 bcrypt 비교를 1회 수행 |
| SEC-10 | Medium | `PATCH /users/profile`이 현재 비밀번호 확인 없이 비밀번호를 변경함(탈취된 토큰으로 계정 영구 장악 가능) | ✅ `currentPassword` 필수(SNS 전용 계정의 최초 설정은 허용), 불일치 시 403 |
| SEC-11 | Medium | Apple 비운영 환경에서 aud 미검증(다른 앱용 Apple 토큰도 통과) | ✅ Apple이 활성화되면 환경과 무관하게 `APPLE_ALLOWED_AUDIENCES` 필수 |
| SEC-12 | Low | 로컬 가입으로 `google_<sub>` 같은 SNS username을 선점하면 해당 SNS 사용자의 최초 로그인이 막힘 | ✅ `<provider>_` 접두사 예약 |
| SEC-13 | Low | CORS가 origin 1개만 받고 `*`를 거부하지 않음, `x-request-id` 미노출 | ✅ 쉼표 목록 지원, `*` 거부, `exposedHeaders` 설정 |
| SEC-14 | Low | 클라이언트가 보낸 `x-request-id`를 형식·길이 검사 없이 사용함(로그 주입) | 📌 P2 |
| SEC-15 | Low | Facebook Graph 호출에 `appsecret_proof` 없음 | 📌 P2 |
| SEC-16 | Low | redirect URI 허용 목록이 비어 있으면 검사를 생략함(Google/Apple/Naver는 운영에서도 필수가 아님) | 📌 P1 |

### 3.3 인증·세션

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| AUTH-1 | Medium | JWT 검증 알고리즘 미고정, placeholder 탐지가 `change-this`/`your-`만 확인해 `replace-with-…`가 운영에서 통과, 길이 기준 없음 | ✅ HS256 고정(서명·검증), 운영에서 32자 이상과 `replace-with` 탐지 |
| AUTH-2 | Medium | `JWT_EXPIRES_IN` 해석 불일치. `'3600'`을 서명할 때는 3.6초(ms)로, 응답에는 3600초로 보고. `'7 days'`는 서명은 7일인데 응답에는 3600 | ✅ 기간 파서를 하나로 통일하고 기동 시 형식 검증 |
| AUTH-3 | Medium | refresh token과 폐기 기능이 없음. 비밀번호를 바꿔도 기존 토큰이 만료 전까지 유효 | 📌 P1 |
| AUTH-4 | Medium | `PublicUser.providers`가 항상 `[]`(`byId`가 `socialAccounts`를 로드하지 않음) | ✅ |
| AUTH-5 | Medium | 응답 형식 불일치: local은 `{access_token, user}`, SNS는 `{ok, requestId, data:{accessToken,…}}` | 📌 P1 클라이언트 계약 결정 필요 |
| AUTH-6 | Low | JWT에 iss/aud claim 없음 | 📌 P2 |

### 3.4 DB·마이그레이션

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| DB-1 | **High** | Artist 삭제의 FK 판별이 PostgreSQL `'23503'` 기준이라, MariaDB에서 연결된 track이 있으면 409 대신 500 | ✅ `src/database/mariadb-errors.ts`(`ER_ROW_IS_REFERENCED_2`/1451, `ER_DUP_ENTRY`/1062)로 통일 |
| DB-2 | Medium | 플레이리스트에 포함된 catalog track을 삭제하면 `RESTRICT` FK 때문에 500 | ✅ 409 |
| DB-3 | Medium | `migrations/mariadb/1763000000000-CreateMariaDbSchema.ts`가 비재귀 glob에 걸리지 않아 실행된 적이 없는 고아 파일(전체 스키마를 재생성하는 내용) | ✅ 삭제(Git 이력에는 보존) |
| DB-4 | Medium | SNS 동시 최초 로그인 복구 시, 실패한 REPEATABLE READ 트랜잭션 스냅샷 안에서 다시 조회해 경쟁 행이 보이지 않음 | ✅ 트랜잭션 밖에서 재조회 |
| DB-5 | Medium | `users.password`가 기본 조회에 포함됨(presenter에만 의존해 비밀번호를 숨김) | ✅ `select: false`, 로그인·비밀번호 변경 경로만 명시적으로 조회 |
| DB-6 | Medium | 운영 서버의 migration이 ts-node와 `src`, devDependencies에 의존함 | ✅ `migration:*:prod`가 `dist/database/data-source.js`를 node로 실행 |
| DB-7 | Medium | `RepairLegacyMariaDbSchema.down()`은 비어 있고 `ArchiveLegacyMusicSchema.down()`은 예외를 던짐. MariaDB DDL은 암묵적으로 커밋됨 | 📝 배포 전 백업 필수, 롤백은 백업 복원으로 처리([5.4](#54-롤백)) |
| DB-8 | Low | 플레이리스트 재정렬이 트랜잭션 밖에서 항목을 읽고, 2N회 UPDATE하며, 항목 수 상한이 없음 | 📌 P1 |
| DB-9 | Low | 검색이 `LOWER(...) LIKE '%…%'`라 인덱스를 못 쓰고 `%`/`_`를 이스케이프하지 않음 | 📌 P2 |
| DB-10 | Low | 공개 플레이리스트 목록이 개수를 세려고 모든 항목을 로드함 | 📌 P2 |
| DB-11 | Low | `DB_POOL_MIN`을 검증만 하고 사용하지 않음(mysql2는 min 개념이 없음) | 📌 P2 정리 |
| DB-12 | Medium | entity 메타데이터와 migration 결과가 다름(drift): FK·인덱스 이름, `datetime` vs `datetime(6)`, entity에 없는 인덱스, collation. `migration:generate` 초안에 의도하지 않은 변경이 섞임 | 📌 P1 entity에 이름·정밀도 선언(DB 변경 없음) 권장. 그때까지 CI drift 단계는 보고만 함 |
| DB-13 | **High** | `1761-AddUniqueEmailToUsers`, `1762-CreateSocialAccounts`가 TypeORM MySQL 드라이버가 지원하지 않는 `create/dropUniqueConstraint`를 사용. 빈 MariaDB에서 체인이 실패(기존 DB는 이력만 기록되어 드러나지 않았음) | ✅ 같은 이름의 unique index로 수정. 이미 기록된 DB는 영향 없음 |

### 3.5 운영 (설정·배포·관측)

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| OPS-1 | **High** | `ecosystem.config.cjs`와 `export-secrets-env.cjs`의 키 목록에서 23개가 빠짐(`DB_TYPE`, `DATABASE_URL`, `AUTH_*_ENABLED`, `APPLE_*`, `KAKAO_*`, `NAVER_*`, `FACEBOOK_*`) | ✅ 단일 목록 `scripts/runtime-env-keys.cjs`로 통합하고, `AppEnv`와 어긋나면 실패하는 spec 추가 |
| OPS-2 | Medium | graceful shutdown이 없어 SIGTERM 시 요청 처리 중단, DB 풀 미정리 | ✅ `enableShutdownHooks()`, PM2 `kill_timeout` |
| OPS-3 | Medium | `/health`가 DB 장애에도 항상 200이고 rate limit 대상임 | ✅ DB 장애 시 503 `degraded`, `@SkipThrottle()` |
| OPS-4 | Medium | SNS 외부 호출에 타임아웃이 없고, JSON이 아닌 응답이면 예외 발생 | ✅ `fetchWithTimeout`(5초), `readJsonSafely` |
| OPS-5 | Medium | CI가 없고, `lint` 스크립트가 `--fix`만 있으며, Node 버전 고정이 없음 | ✅ GitHub Actions, `lint:check`·`typecheck`·`format:check`, `.nvmrc`(24)·`engines` |
| OPS-6 | Medium | 구조화 로그와 액세스 로그가 없고, requestId는 오류일 때만 로그에 남음 | 📌 P1 |
| OPS-7 | Medium | 의존성 취약점 11건 | ✅ `npm audit fix`로 5건까지 감소 / 📌 P1 NestJS 12·TypeORM 1.x 업그레이드(남은 high는 multer인데, 파일 업로드 미사용으로 실제 경로 없음) |
| OPS-8 | Low | 배포 경로가 systemd와 PM2 두 가지로 문서화되어 있음 | ✅ PM2 + `.env.production`을 기본으로 통일, systemd는 같은 env 파일을 쓰는 대안으로만 유지 |
| OPS-9 | Low | 의도된 503(provider 비활성)이 ERROR 등급으로 stack과 함께 로그에 남음 | 📌 P2 |
| OPS-10 | Low | `main.ts`에서 `console.*` 사용 | ✅ Nest `Logger` |
| OPS-11 | Low | `NODE_ENV`가 비어 있으면 development로 간주되어 Swagger가 노출됨 | 📝 배포 체크리스트에 `NODE_ENV=production` 명시 |

### 3.6 테스트

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| T-1 | Medium | users use-case, social linker, 비밀번호 해셔 spec 0개 | ✅ 추가 |
| T-2 | Medium | legacy use-case 15개 spec 없음, catalog publish/reorder 미검증 | 📌 P1 |
| T-3 | Medium | e2e가 `/`와 `/health`만 검사하고, DB가 필요하며 CI에 없음 | 🟡 CI `database` job에서 MariaDB 10.11로 e2e 실행(10장). 시나리오 확장은 📌 P1 |
| T-4 | Medium | SNS 인프라 어댑터 spec 없음(이번에 Kakao 토큰 검증 spec만 추가) | 📌 P1 |
| T-5 | Low | spec 타입 오류 4건, lint 오류 17건 | ✅ |

### 3.7 저장소 위생 (.gitignore 등)

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| R-1 | Low | `.gitignore` 중복(키·인증서 블록 2회, `dist`/`dist/`, `.cache` 3회)과 무관한 프레임워크 섹션(Next/Nuxt/Gatsby 등). `.DS_Store`, `.idea/`, `.vscode/`, `.claude/settings.local.json`, `tmp/`, `.pm2/` 누락 | ✅ NestJS 기준으로 재작성 |
| R-2 | Low | 추적 중인 `.claude/settings.json`에 일회성 `xargs sed` 리팩터링 명령, 광범위한 `git rm *`·`git mv *` 허용, PostgreSQL `pg_isready` 잔재 | ✅ npm/jest/tsc 허용만 남김 |
| R-3 | Low | 예제 env와 README에 실제 호스트로 보이는 `DB_HOST` 값 | ✅ `127.0.0.1`로 교체 / 📝 Git 이력에는 남아 있음(비밀값 아님). 3306 외부 비공개 유지 |
| R-4 | Low | CA 번들 파일명 불일치(`config/global-bundle.pem` vs 문서의 `rds-ca-bundle.pem`) | ✅ `config/global-bundle.pem`으로 통일, 다운로드 방법 기재 |
| R-5 | Info | Git 이력 비밀값 검색: `.env`, `*.pem`, `*.key` 커밋 이력 없음. `JWT_SECRET=`·`CLIENT_SECRET=`·`PRIVATE KEY`·`AKIA` 검색 결과 없음. `DB_PASSWORD=` 1건은 redaction 테스트용 가짜 값 | 이상 없음 |
| R-6 | Low | 커밋·PR 제목 규칙 불일치. 4개 커밋이 PR 없이 develop에 직접 push됨 | 📝 [8장](#8-커밋pr-컨벤션-권고) / 📌 브랜치 보호 규칙 |

### 3.8 문서

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| D-1 | Medium | `API_EXAMPLES.md` 로그인 예시가 `{username, password}`라 현재 API에서 400 | ✅ `{identifierType, identifier, password}` |
| D-2 | Medium | 기획(제품 요구사항) 문서 없음 | ✅ [docs/product](../product/overview.kr.md) 신설(현재 코드 기준으로 역정리) |
| D-3 | Low | 삭제된 경로(`auth.service.ts`, `social-common/` 등)와 PostgreSQL 서술이 남은 문서 | ✅ 갱신 또는 삭제. 모든 유지 문서에 최신화 기준 표기 |
| D-4 | Low | 2천 줄 이상의 Copilot 프롬프트 2개가 "요구사항" 문서로 링크됨 | ✅ 미해결 요구사항을 [로드맵](#6-로드맵)·[결정 문서](../music/decisions.md)로 옮긴 뒤 삭제 |
| D-5 | Low | docs 인덱스 없음 | ✅ [docs/README.md](../README.md) |

## 4. 이번 브랜치의 변경 요약

| 커밋 | 내용 |
| --- | --- |
| `chore(repo)` | `.gitignore` 재작성, `.claude/settings.json` 정리, 예제 env placeholder화, 고아 migration 삭제 |
| `chore(ci)` | lint·타입 오류 수정, `lint:check`·`typecheck`·`format:check`, `.nvmrc`, 미사용 의존성 4개 제거, `npm audit fix`, GitHub Actions |
| `fix(config)` | 런타임 env 키 단일화, `TRUST_PROXY`, graceful shutdown, CORS 목록, JWT HS256·길이·만료 형식, Apple aud·Kakao app id 요구 |
| `fix(db)` | MariaDB 오류 판별 공용화(FK 409), `DomainError` 중앙 매핑 |
| `feat(users,auth)` | users 포트·어댑터, 비밀번호 `select:false`, 타이밍 균등화, `currentPassword`, providers 로드, 예약 username, social linker 수정, 최소 RBAC |
| `fix(api)` | `/health` 503, by-date 검증, 공개 트랙 목록 페이지네이션(최대 100) |
| `refactor(auth)` | SNS 공통 오류 처리, Kakao 토큰 앱 검증, Apple email 우선순위, 외부 호출 타임아웃 |
| `docs` | 이 리포트, docs 인덱스, 기획 문서, 기존 문서 최신화와 정리 |

신규 마이그레이션은 `1765000000000-AddRoleToUsers` 하나입니다. `users.role ENUM('user','admin') NOT NULL DEFAULT 'user'`를 추가하며 `down()`은 컬럼을 삭제합니다.

## 5. 릴리스 점검 (develop → main)

### 5.1 범위

- develop은 main보다 커밋 11개 앞서 있습니다(이번 브랜치 병합 후 +1 merge).
- main에만 있는 변경은 없습니다. main의 `ca1272a`는 merge base와 트리가 같으므로 충돌하지 않습니다.
- main은 users와 local auth만 있는 초기 앱입니다. 기능은 PostgreSQL, Nest 기본 오류 형식, Throttler 미적용 상태입니다.
- develop은 다음을 추가합니다.
  - MariaDB 전용 전환
  - SNS 로그인 5종
  - 음악 카탈로그와 legacy API
  - 공통 오류 envelope
  - migration 체계
  - 이번 감사 보완 전체

### 5.2 브레이킹 변경 (main 기준 클라이언트·운영)

| # | 변경 | 영향 | 대응 |
| --- | --- | --- | --- |
| 1 | DB: PostgreSQL → **MariaDB 전용**(`pg` 제거, `DB_TYPE=mariadb`만 허용) | main 운영 DB가 PostgreSQL이면 데이터 이전 필요 | 백업 → MariaDB에 migration 적용 → users 데이터 이전 스크립트(필요 시) |
| 2 | `POST /auth/login` body가 `{username, password}`에서 `{identifierType: 'username'\|'email', identifier, password}`로 바뀜 | 기존 클라이언트는 400 | 클라이언트 동시 배포 |
| 3 | 오류 응답 형식이 Nest 기본 `{statusCode, message, error}`에서 `{ok:false, requestId, errorCode, message}`로 바뀜 | 오류 파싱 로직 | 클라이언트 수정 |
| 4 | `PATCH /users/profile` 비밀번호 변경에 `currentPassword` 필수 | 비밀번호 변경 UI | 클라이언트 수정 |
| 5 | 음악 쓰기 API가 admin 전용 | 관리 도구 | 배포 후 admin 지정 |
| 6 | 운영 기동 조건 강화: `JWT_SECRET` 32자 이상·placeholder 금지, `JWT_EXPIRES_IN` 형식, `CORS_ORIGIN`에 `*` 금지, Apple 활성 시 `APPLE_ALLOWED_AUDIENCES`, 운영에서 Kakao 활성 시 `KAKAO_APP_ID` | 조건을 못 맞추면 서버가 뜨지 않음 | 배포 전 비밀값 점검 |
| 7 | `/health`가 DB 장애 시 503 | LB·모니터링 판정 | 의도된 동작 |
| 8 | 로컬 가입 시 `<provider>_` 접두사 username 거부 | 신규 가입만 해당 | — |
| 9 | 사용자 응답에 `role`, `providers` 필드 추가 | 추가만 있음 | — |

### 5.3 배포 체크리스트

1. MariaDB 전체 백업: `mysqldump --single-transaction --routines`. 자세한 내용은 [MariaDB 운영](../music/database/mariadb-operations.md)을 참고합니다.
2. 비밀값을 점검합니다.
   - `JWT_SECRET`이 32자 이상인지 확인하고, `NODE_ENV=production`과 `CORS_ORIGIN`을 설정합니다.
   - reverse proxy 뒤라면 `TRUST_PROXY=1`을 설정합니다.
   - Kakao를 사용하면 `KAKAO_APP_ID`, Apple을 사용하면 `APPLE_ALLOWED_AUDIENCES`를 설정합니다.
3. 빌드하고 마이그레이션을 적용합니다(`.env.production` 기준, [EC2 배포 가이드](../deployment/mariadb-systemd.kr.md)).
   ```bash
   git pull --ff-only && npm ci && npm run build
   npm run env:check:prod          # 설정 검증(DB 접속 없음)
   npm run db:check:prod           # 읽기 전용: 접속·권한·pending 목록
   npm run migration:show:prod     # 1765000000000-AddRoleToUsers가 pending인지 확인
   npm run migration:run:prod
   ```
4. admin을 지정합니다: `UPDATE users SET role = 'admin' WHERE username = '<admin-username>';`
5. `npm run pm2:reload`로 재기동한 뒤 `curl -fsS http://127.0.0.1:${PORT:-3000}/health`가 200인지 확인합니다.
6. 스모크 테스트를 합니다.
   - 일반 사용자 토큰으로 `POST /music/tracks`를 보내 403이 나오는지 확인합니다.
   - admin 토큰으로 같은 요청이 201인지 확인합니다.
   - 공개 목록 `GET /music/public/playlists`가 200인지 확인합니다.

### 5.4 롤백

- 애플리케이션은 이전 빌드로 `pm2:reload`합니다.
- `AddRoleToUsers`는 `npm run migration:revert:prod`로 되돌릴 수 있습니다(CI가 down/up을 매 PR 검증).
- 그 이전 migration 중 `ArchiveLegacyMusicSchema`와 `RepairLegacyMariaDbSchema`는 down이 없으므로, 문제가 생기면 **1번에서 만든 백업을 복원**합니다.

## 6. 로드맵

삭제한 Copilot 프롬프트 문서 2개의 미해결 요구사항도 이 목록으로 옮겼습니다.

### P0: main 배포 전 결정 또는 확인

- [x] **Naver 토큰 치환 방어(SEC-3):** accessToken 로그인을 기본 차단하고 code flow만 허용했습니다. SNS 전체도 현재 비활성입니다.
- [ ] 운영 서버에 `.env.production`을 작성하고 `npm run env:check:prod`가 OK인지 확인합니다([환경별 DB 가이드](../deployment/database-environments.kr.md)).
- [ ] 새 개발 서버 연결: `.env`·`.env.test.local`에 비밀번호를 입력하고 `npm run db:check` → `npm run db:setup` → `npm run db:setup:test` → `npm run test:e2e`를 실행합니다([10장](#10-후속-조치-개발-db-연결과-스키마-관리-체계)).
- [ ] main 운영 DB의 PostgreSQL 데이터 이전 필요 여부를 확인합니다(브레이킹 변경 1).
- [ ] 클라이언트에 로그인 body, 오류 envelope, `currentPassword` 변경을 공지하고 함께 배포합니다(브레이킹 변경 2–4).
- [ ] 운영 `JWT_SECRET` 길이를 점검하고, proxy 구성에 맞게 `TRUST_PROXY`를 설정합니다.
- [ ] GitHub 브랜치 보호: develop/main에 PR과 CI 통과를 필수로 합니다.

### P1: 다음 스프린트

- 인증·세션
  - refresh token(원문 미저장, rotation), logout/revoke
  - 비밀번호 변경 시 기존 토큰 무효화(AUTH-3)
- OAuth
  - 서버 저장형 state/nonce/PKCE 트랜잭션(SEC-5)
  - `exchange-code`·`verify-id-token` 공개 범위 재검토(SEC-6)
  - redirect URI 허용 목록을 운영 필수로 전환(SEC-16)
- 응답 계약: local과 SNS 로그인 응답 envelope 통일(AUTH-5)
- Playlist 정책
  - 공개 상태 전이 규칙(CA-8)
  - 재정렬 트랜잭션 보강과 항목 수 상한(DB-8)
  - 날짜 중복·Track 중복 정책 확정([결정 문서](../music/decisions.md))
- 운영
  - 구조화 로그·액세스 로그, requestId 전파(OPS-6)
  - 로그인 감사 로그
- 의존성: NestJS 12·TypeORM 1.x 업그레이드 검토로 남은 audit 5건 해소(OPS-7)
- 마이그레이션: migration 실패 정책과 백업 자동화
- 테스트
  - e2e 시나리오 확장(CI `database` job에서 실행): provider disabled, DB down, UNIQUE/FK, 트랜잭션 rollback, 오류 envelope(T-3)
  - entity·migration drift 해소 후 CI drift 단계를 필수로 전환(DB-12)
  - legacy use-case와 catalog publish/reorder spec(T-2)
  - SNS 어댑터 spec(T-4)

### P2: 구조 성숙화

- 도메인 모델과 ORM entity 분리, port 시그니처를 도메인 타입으로 전환(CA-4)
- `CatalogMusicService`를 use-case로 분해(CA-5), `MusicService` facade 제거(CA-6)
- kakao/naver/facebook 로그인 use-case를 공통 템플릿으로 통합(CA-7)
- 나머지 use-case의 `DomainError` 전환(CA-2), DTO import 제거(CA-3)
- 공유 커널 경계 정리(CA-9), session 모듈 의존 구조 정리(CA-10)
- legacy 음악 모듈 폐기 일정과 데이터 이전 결정
- Playlist 소유권(ownerId) 또는 editor 역할이 필요한지 제품 결정
- 검색: LIKE 이스케이프, FULLTEXT 또는 별도 검색 인덱스(DB-9). 공개 목록 count 쿼리 최적화(DB-10)
- `x-request-id` 형식 검증(SEC-14), Facebook `appsecret_proof`(SEC-15), JWT iss/aud(AUTH-6)
- `GET /music/tracks/:trackId/audio-assets`가 없는 트랙에도 `[]`을 반환하는 문제를 404로 정리(스모크 테스트에서 발견)
- 배포 경로를 하나로 통일(OPS-8), 의도된 503의 로그 등급 조정(OPS-9), `DB_POOL_MIN` 정리(DB-11)
- `noImplicitAny` 활성화 등 tsconfig strict 강화
- S3/CloudFront 음원 업로드와 서명 URL(음원 보안 요구사항)

## 7. 검증과 한계

### 7.1 실행 결과 (감사 후)

```text
npm run lint:check    → 0 problems
npm run format:check  → All matched files use Prettier code style
npm run typecheck     → 0 errors
npx jest              → 46 suites / 310 tests passed
npm run build         → success
npm audit --omit=dev  → 5 vulnerabilities (3 moderate, 2 high)
```

### 7.2 DI·HTTP 스모크 (가짜 DataSource로 AppModule 전체 기동)

| 요청 | 기대 | 결과 |
| --- | --- | --- |
| `GET /health` (DB up / down) | 200 / 503 `degraded` | 통과 |
| `GET /music/tracks`, `?limit=101` | 200 / 400 | 통과 |
| `POST /music/tracks` 토큰 없음 / `alg=none` 토큰 / user 토큰 | 401 / 401 / 403 | 통과 |
| `DELETE /music/legacy/artists/1` user 토큰 | 403 | 통과 |
| `GET /music/legacy/artists` user 토큰 | 200 | 통과 |
| `GET /music/legacy/playlists/by-date` (date 없음) | 400 | 통과 |
| `GET /users/profile` | 200, `role`·`providers` 포함 | 통과 |
| `POST /users/register` `google_123` | 400 | 통과 |
| `POST /auth/kakao/login` (provider 비활성) | 503 `AUTH_KAKAO_DISABLED` | 통과 |
| `GET /music/tracks/1/audio-assets` admin 토큰 | 가드 통과 | 통과. 단, 없는 트랙도 `[]`을 반환함(📌 P2 404 처리) |

### 7.3 검증하지 못한 항목

- ~~실제 MariaDB 대상 migration 왕복~~ → 2026-11-09 CI `database` job에서 검증(빈 DB 전체 체인, `AddRoleToUsers` revert/재적용). 이 과정에서 DB-13을 발견해 수정했습니다.
- ~~e2e~~ → 같은 job에서 MariaDB 10.11로 실행해 통과했습니다.
- **사용자 개발 서버 실접속:** 비밀번호를 입력하기 전이라 실행하지 못했습니다. 로그인 없이 handshake만 확인했습니다(MariaDB 10.11.11, TLS 미지원). [10장](#10-후속-조치-개발-db-연결과-스키마-관리-체계)의 명령으로 확인해야 합니다.
- **SNS provider 실연동**(Kakao `access_token_info`의 `app_id` 응답 등): 외부 계정이 필요합니다. staging에서 확인해야 합니다.

## 8. 커밋·PR 컨벤션 권고

- **커밋 제목:** Conventional Commits(`feat|fix|refactor|chore|docs|test(scope): 요약`). 이번 브랜치가 예시입니다.
- **브랜치 흐름:** `feature/*` → PR → develop, develop → PR(`release: …`) → main. develop/main 직접 push 금지.
- **PR 본문:** 변경 요약, 브레이킹 변경, 마이그레이션 여부, 검증 결과, 배포 메모.
- **merge 방식:** squash 대신 merge commit을 쓰면 develop → main 릴리스 이력이 남습니다(현재 PR #2 방식).

## 9. 후속 조치: 환경별 DB 설정과 SNS 비활성화

같은 날 사용자 요청으로 추가로 반영한 내용입니다(PR #10에 커밋 추가).

**환경별 env 파일 단일화** (`src/config/env-files.ts`)

| 환경 | env 파일 | DB | 비고 |
| --- | --- | --- | --- |
| Dev | `.env` | 외부 개발 서버 `app_db` | |
| Test | `.env.test.local` | 개발 서버 `app_db_test` | 파일 필수, `*_test` 외 DB 거부(`app_db` 예외 제거) |
| Prod | `.env.production` | EC2 localhost MariaDB | PM2 `cwd` 고정 |

- 앱, migration CLI, e2e가 같은 규칙을 씁니다. `ENV_FILE`로 재지정할 수 있습니다.
- 셸 환경변수가 파일 값보다 우선합니다.
- 상세: [환경별 DB·설정 가이드](../deployment/database-environments.kr.md)

**명령 추가**

- `env:check`·`env:check:test`·`env:check:prod`: DB에 접속하지 않고 기동 시와 같은 검증만 실행하며, 비밀번호·secret 값은 출력하지 않습니다.
- `migration:*:test`, `migration:*:prod`: prod는 `dist` 기반이라 ts-node가 필요 없습니다.

**SNS 로그인 비활성화**

- 5종 모두 명시적 opt-in으로 바꿨습니다. credential 추론을 제거해 기본 비활성이고, 꺼진 provider는 설정 키가 없어도 빌드와 기동에 영향이 없습니다.
- Naver는 켜더라도 accessToken 로그인이 기본 차단됩니다.
- 재활성화 조건: [SNS 재활성화 체크리스트](../auth/sns-reenable-checklist.kr.md)

**기타**

- `CORS_ORIGIN=none`으로 CORS를 명시적으로 끌 수 있습니다(모바일 전용).
- 운영 `TRUST_PROXY` 기본값은 `loopback`입니다. 같은 호스트의 nginx만 신뢰하고, proxy가 없어도 안전합니다.

**검증**

- 품질 게이트: lint, format, typecheck, unit tests, build 모두 통과
- prod 설정 스모크(SNS 키 없음, `CORS_ORIGIN=none`, 가짜 DataSource)
  - `/health` 200
  - SNS 5종 503 `AUTH_*_DISABLED`
  - `/api-docs` 404
- prod 설정 실기동은 설정 검증을 통과한 뒤 DB 연결 단계에서 멈춤(의도한 결과)
- placeholder `JWT_SECRET`은 기동 즉시 실패
- `migration:show:prod`는 `dist`의 `.js` migration 9개를 인식
- 개발 DB `migration:show`(읽기 전용): 8개 적용, `AddRoleToUsers`만 대기

## 10. 후속 조치: 개발 DB 연결과 스키마 관리 체계

2026-11-09, 사용자 요청으로 추가한 내용입니다(PR #10에 커밋 추가).

**요청**

- 새 외부 개발 DB 서버에 Dev와 Test를 연결하고, 비밀번호는 직접 입력합니다.
- DB나 테이블이 없으면 생성합니다.
- 실무에서는 생성, 적용, 검증을 어떻게 하는지 정리합니다.

**결정**

| 항목 | 결정 |
| --- | --- |
| 서버 용도 | Dev(`app_db`)와 Test(`app_db_test`) 모두 새 서버를 사용하고, 같은 개발 계정을 씁니다 |
| 생성 시점 | 명령으로 실행합니다(`db:setup`). 앱 기동 시 자동 실행은 하지 않습니다 |
| 비밀번호 | `.env`와 `.env.test.local`에 직접 입력합니다(Git 미추적, `chmod 600`) |

이유는 [DB·스키마 관리 학습 가이드](../learning/database-schema-management.kr.md) 4장과 10장에 있습니다.

**추가한 것**

| 구분 | 내용 |
| --- | --- |
| 명령 | `db:check`(읽기 전용: 접속, 계정, TLS, DB, 테이블 수, pending, 권한)<br>`db:setup`(DB가 없으면 utf8mb4로 생성한 뒤 migration 적용)<br>`db:check:test`, `db:setup:test`, `db:reset:test`<br>`migration:revert:test`, `migration:check:test`(drift)<br>`db:check:prod`(dist) |
| 안전장치 | 운영에서는 `db:ensure`를 거부합니다(관리자 SQL로 생성)<br>`db:reset`은 test의 `*_test` DB에서만 동작합니다<br>허용되지 않는 명령은 서버에 연결하기 전에 거부합니다<br>DB 이름 문자를 검증하고, 비밀번호와 `SHOW GRANTS` 해시는 출력하지 않습니다 |
| 오류 안내 | 1045, 1130, 1129, 1044/1227, 1049, TLS 미지원, ECONNREFUSED/ETIMEDOUT/ENOTFOUND를 조치 문장으로 바꿔 줍니다 |
| 기동 시 점검 | `MigrationStatusService`가 pending migration을 경고합니다(운영은 error 등급). 기동은 막지 않고 DB에 쓰지 않습니다 |
| migration 경로 | 실행 중인 파일 기준으로 찾습니다(cwd와 무관하고 e2e에서도 인식) |
| CI | `database` job(MariaDB 10.11)<br>빈 DB 전체 체인 → pending 없음(`--strict`) → 최신 revert/재적용 → drift(보고만) → e2e |

**CI가 발견한 문제**

- **DB-13(수정):** 빈 MariaDB에서 `1761`이 실패했고, `1762`도 같은 문제가 있었습니다. 새 개발 서버에 그대로 `db:setup`을 했다면 실패했을 결함입니다.
- **DB-12(보고):** entity와 migration 결과가 다릅니다. 해결 방향을 결정해야 합니다(P1).

**로컬 파일(사용자 PC, Git 미추적)**

- `.env`
  - `DB_HOST`, `DB_PORT`, `DB_USERNAME`을 새 서버 값으로 바꿨습니다.
  - `DB_PASSWORD`는 비워 두었습니다.
  - 원본은 `.env.bak.2026-11-08`에 있습니다.
- `.env.test.local`(신규): `app_db_test`, 무작위 `JWT_SECRET`, `DB_PASSWORD`는 비워 두었습니다.
- 위 파일과 백업은 모두 `chmod 600`입니다.

**검증**

- 로컬: lint, format, typecheck, unit tests(49 suites / 362 tests), build 통과
- 비밀번호 없이 실행: `db:check`/`db:setup`/`db:check:test`가 `DB_PASSWORD is required.`로 중단(의도한 결과)
- 닫힌 포트: `db:check:prod`가 `Connection refused` 안내 출력
- 거부 동작: 운영 `db:ensure`, 개발 `db:reset`이 연결 전에 거부됨
- CI(PR #10): `verify`와 `database` job 모두 통과

**사용자가 할 일**

1. `.env`와 `.env.test.local`의 `DB_PASSWORD=`에 비밀번호를 입력합니다.
2. `npm run db:check`로 접속, 권한, TLS를 확인합니다.
3. `npm run db:setup`으로 `app_db`를 만들고 테이블을 적용합니다.
4. `npm run db:setup:test` → `npm run test:e2e`를 실행합니다.
5. 개발 서버의 DB 포트를 개발자 IP로 제한하거나, SSH 터널을 사용합니다(TLS 미지원).

### 10.1 첫 연결 점검: `DB_PASSWORD is required.`와 권한 부족

**증상**

`.env.test.local`에 비밀번호를 넣고 `npm run db:check`를 실행했는데 `FAIL DB_PASSWORD is required.`가 나왔습니다.

**원인 (읽기 전용으로 확인)**

1. `npm run db:check`는 Dev 명령이라 `.env`를 읽습니다. `.env`의 `DB_PASSWORD`가 비어 있었습니다.
   - `.env.test.local`의 값은 정상이었습니다(`#`, 따옴표, CRLF 문제 없음).
   - 셸에 export된 값도 없었습니다.
   - **오류에 읽은 파일 정보가 없어** 원인을 찾기 어려웠습니다.
2. `db:check:test`로 접속해 보니 개발 계정의 권한은 서버의 기존 DB 하나에만 있었고, `DROP`이 없었습니다.
   - `app_db`·`app_db_test`에는 권한이 없어 DB를 만들 수 없었습니다.
   - 그대로 migration을 실행하면 6번째(`RENAME TABLE`)에서 **중간 실패**했을 상태입니다.

**결정**

Dev는 서버의 기존 빈 DB를 사용합니다. Test는 `app_db_test`를 유지합니다.

**보완**

| ID | 내용 |
| --- | --- |
| OPS-10 ✅ | **설정 오류에 맥락 추가**(`src/config/env-diagnostics.ts`)<br>오류에 읽은 env 파일과 `NODE_ENV`를 붙입니다.<br>같은 키가 다른 환경 파일에 있으면 `Hint:`를 출력합니다(값은 출력하지 않음).<br>앱 기동, `env:check`, `db:*`에 적용했습니다 |
| DB-14 ✅ | **권한 사전 점검**(`evaluatePrivileges`)<br>`SHOW GRANTS`를 해석합니다(전역, DB 단위, 와일드카드, role이면 판정 보류).<br>`db:check`는 부족한 권한과 GRANT SQL을 출력하고, `--strict`에서는 실패합니다.<br>`db:setup`은 권한이 부족하면 **아무것도 바꾸지 않고 멈춥니다** |
| DB-15 ✅ | DB 이름에 `-`를 허용합니다(백틱으로 감싸 안전). 대상 DB가 없을 때 이 계정에서 보이는 DB 목록을 출력합니다 |

**검증 (실서버, 읽기 전용)**

- `db:check`: 기존 DB에 0 tables, 9 pending, `missing DROP`, 그리고 `GRANT DROP …` 출력
- `db:check:test`: `app_db_test` 없음, 보이는 DB 목록, 8개 권한 부족과 GRANT 출력
- `db:setup`: 권한 점검에서 중단. 이후 `db:check`에서 0 applied가 유지됨(변경 없음)
- 빈 비밀번호 파일을 지정한 재현에서 `env file`과 `Hint:` 출력
- 로컬 게이트: lint, format, typecheck, 50 suites / 379 tests, build 통과

**사용자가 할 일 (서버 관리자)**

1. `db:check`가 출력한 GRANT를 실행합니다(Dev DB에 `DROP`, `app_db_test`에 8개 권한).
2. `npm run db:setup` → `npm run db:setup:test` → `npm run test:e2e`를 실행합니다.

