# 보안 전수 감사 리포트 (2026-11-09)

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 이전 감사: [2026-11-08 프로젝트 감사](2026-11-08-project-audit.kr.md). ID 체계(SEC, AUTH, DB, OPS, R)를 이어서 씁니다.
> 개념 설명과 실습: [API 보안 학습 가이드](../learning/api-security-guide.kr.md) · DB 후속 과제: [DB 개선 가이드](../learning/database-improvement-guide.kr.md)

## 0. 요약

**감사 대상:** `chore/project-audit-2026-11`(PR #10) 전체 코드, 설정, 스크립트, CI, 배포 예시, Git 이력

**결론**

- High 1건(SEC-17)을 새로 발견해 수정했습니다. 비활성 SNS provider가 대소문자를 바꾼 경로로 열렸고, 다른 앱에서 발급된 토큰으로 로그인할 수 있는 상태였습니다.
- Medium 4건(SEC-18, SEC-19, SEC-21, AUTH-3)을 수정했습니다. AUTH-3을 고치면서 migration `1766000000000-AddSessionVersionToUsers`가 추가되었습니다.
- 남은 위험은 [7장 로드맵](#7-로드맵)에 정리했습니다. 저장소 설정처럼 사용자가 직접 해야 하는 일은 [9장](#9-사용자가-할-일)에 있습니다.

| 지표 | 감사 시작 (`532ccc7`) | 감사 후 |
| --- | --- | --- |
| 유닛 테스트 | 50 suites / 388 tests | **58 suites / 442 tests** |
| e2e (MariaDB `app_db_test`) | 2 tests | **5 tests** (대소문자 경로 3건 추가) |
| HTTP 스모크 (빌드 결과 + `app_db_test`) | — | **16/16 통과** ([8장](#8-검증)) |
| migration | 9개 | **10개** (`AddSessionVersionToUsers` 추가, revert/재적용 검증) |
| `npm audit --omit=dev` | 5건 (high 2, moderate 3) | 5건 (변화 없음. 모두 메이저 업그레이드 필요, [OPS-14](#35-공급망저장소운영)) |
| Git 이력 비밀값 검색 | — | 이상 없음 ([R-8](#35-공급망저장소운영)) |

### 이번에 수정한 주요 결함

| 결함 | 수정 전 동작 | 수정 후 |
| --- | --- | --- |
| 비활성 provider 우회 (SEC-17) | `POST /auth/GOOGLE/verify-id-token`이 컨트롤러까지 실행됨(수정 전 커밋에서 500으로 재현). Google·Apple은 audience 없이, Kakao는 `app_id` 확인 없이 토큰을 받음 | 경로 철자와 무관하게 503. 설정이 비면 검증을 생략하지 않고 거부 |
| 비밀번호를 바꿔도 기존 토큰 유효 (AUTH-3) | 탈취된 토큰이 만료(기본 1시간)까지 계속 동작 | 비밀번호를 바꾸면 그 전에 발급된 토큰이 즉시 401 |
| 계정 단위 무차별 대입 (SEC-19) | IP당 5회/분만 제한. IP를 바꾸면 한 계정에 무제한 시도 | 같은 계정 실패 10회/15분이면 429와 `Retry-After` |
| bcrypt 72바이트 절단과 입력 길이 무제한 (SEC-18) | 73바이트 이상 비밀번호는 앞 72바이트만 비교. 긴 username은 DB 오류로 500 | 새 비밀번호 8자 이상·72바이트 이하, 모든 입력에 상한 |
| 비로그인 검색 패턴 조작 (SEC-21) | `%`, `_`를 그대로 LIKE에 넣고 길이 제한 없음 | 100자 상한, 와일드카드 이스케이프 |

## 1. 범위와 방법

| 영역 | 확인한 것 |
| --- | --- |
| 인증 | 로컬 로그인, 비밀번호 저장·비교, 세션 JWT 발급·검증, 비밀번호 변경 |
| 인가 | `@AdminOnly`·`RolesGuard`, 라우트별 권한, provider 활성 가드 |
| 외부 IdP | Google·Apple ID Token 검증(aud, iss, nonce), Kakao·Naver·Facebook 토큰의 발급 앱 검증, code 교환과 redirect URI |
| 입력 | 전역 `ValidationPipe`, DTO 상한, LIKE 쿼리, URL 필드 |
| 오류·로그 | 응답 마스킹, 로그 redaction, `x-request-id` |
| 설정 | `app-env.ts` 검증 규칙, CORS, helmet, trust proxy, Swagger 노출 |
| DB | 계정 권한, TLS, 백업 파일, migration |
| 공급망 | `npm audit`, GitHub Actions, Dependabot, Claude Code 공유 설정 |
| 저장소 | 추적 파일, Git 이력 비밀값 패턴 |

**실행 검증**

1. **라우팅 동작 확인:** Express 5.2.1의 `case sensitive routing` 기본값이 꺼져 있습니다(`node_modules/express/lib/application.js`). Nest 11.2.8은 이 설정을 그대로 따릅니다(`getRouteMatchingOptions`).
2. **수정 전 재현:** `532ccc7`을 별도 worktree에서 빌드해 실행했습니다. `/auth/google/verify-id-token`은 503이었지만 `/auth/GOOGLE/verify-id-token`은 500 `AUTH_GOOGLE_INTERNAL_ERROR`였습니다. 500은 컨트롤러와 Google 검증기까지 실행됐다는 뜻입니다.
3. **품질 게이트, e2e, 스모크:** [8장](#8-검증)
4. **이력 검색:** `git log --all -p`에서 `AKIA…`, `ghp_…`, `xox?-`, `PRIVATE KEY`를 검색했습니다. 값은 출력하지 않았습니다.

### OWASP API Security Top 10 (2023) 대응

| 항목 | 이 프로젝트의 상태 | 관련 ID |
| --- | --- | --- |
| API1 객체 수준 인가 | 사용자 소유 리소스는 프로필뿐이고 `req.user.id`로만 접근합니다. 음악 쓰기는 admin 전용입니다 | SEC-1 |
| API2 인증 결함 | **우회와 무차별 대입을 수정**했고, 토큰 폐기 수단을 추가했습니다 | SEC-17, SEC-19, AUTH-3 |
| API3 객체 속성 수준 인가 | `whitelist` + `forbidNonWhitelisted`로 `role` 같은 필드를 요청으로 바꿀 수 없습니다. 비밀번호 해시는 `select: false`입니다 | DB-5 |
| API4 무제한 자원 소비 | **입력 상한과 검색 패턴 제한을 추가**했습니다. `/health`는 남은 과제입니다 | SEC-18, SEC-21, SEC-20 |
| API5 기능 수준 인가 | 쓰기 라우트에 `@AdminOnly`가 빠지면 spec이 실패합니다 | SEC-1 |
| API6 민감한 비즈니스 흐름 | 가입 자동화 방지(CAPTCHA 등)는 없습니다. IP당 전역 제한만 있습니다 | SEC-25 |
| API7 SSRF | 외부 호출 URL은 상수입니다. Facebook Graph 버전만 설정값입니다 | — |
| API8 보안 설정 오류 | CORS `*` 금지, helmet, 운영 Swagger 비노출, trust proxy. **systemd 샌드박스를 추가**했습니다 | OPS-15 |
| API9 API 목록 관리 | legacy 라우트(`/music/legacy`)가 아직 열려 있습니다. 라우트 표는 [API 명세](../product/api-spec.kr.md)에 있습니다 | — |
| API10 외부 API 안전하지 않은 사용 | 타임아웃, JSON 파싱 실패 처리가 있습니다. provider 오류 원문이 응답에 나가는 문제는 남은 과제입니다 | SEC-24 |

## 2. 심각도와 조치 표기

[2026-11-08 감사 2장](2026-11-08-project-audit.kr.md#2-심각도-기준)과 같습니다.

- **High:** 권한 우회, 비밀 노출, 데이터 손상, 운영 중단으로 이어질 수 있음
- **Medium:** 특정 조건에서 보안 수준을 낮춤
- **Low:** 심층 방어, 관측성

조치 표기: ✅ 수정 · 📌 로드맵 · 📝 문서·운영 절차로 대응

## 3. 발견 사항과 조치

### 3.1 인증·세션

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| SEC-17 | **High** | `ProviderReadinessGuard`가 요청 경로를 대소문자 구분 정규식(`^/auth/([^/]+)`)으로 검사했습니다. Express 라우팅은 대소문자를 구분하지 않아 `/auth/GOOGLE/*`, `/auth/Kakao/*`가 가드를 통과해 컨트롤러에 도달합니다. 꺼진 provider는 설정이 비어 있어, 검증이 다음처럼 **fail-open**이었습니다.<br>· Google: `audience: undefined` → 다른 OAuth client용 ID Token도 통과<br>· Apple: `audience: undefined`<br>· Kakao: `KAKAO_APP_ID`가 없으면 경고 후 `app_id` 검증 생략<br>결과적으로 "SNS 비활성" 상태에서도 다른 앱에서 발급된 토큰으로 `<provider>_<sub>` 계정이 생기고 세션 JWT가 발급됩니다. `verify-id-token`은 공개 검증기로 동작합니다 | ✅ 가드가 경로 대신 `@SocialProviderRoute()` 메타데이터로 판정합니다(`src/common/auth/social-provider-route.decorator.ts`). 5개 컨트롤러에 메타데이터가 빠지면 spec이 실패합니다<br>✅ **fail-closed:** Google·Apple은 audience가 비면 `*_CONFIG_MISSING`(503)을 반환합니다. Kakao는 `KAKAO_APP_ID`가 없으면 거부하며, Kakao가 켜져 있으면 모든 환경에서 필수입니다<br>✅ e2e에 `/auth/GOOGLE/login`, `/auth/Kakao/login` 503 확인 추가 |
| AUTH-3 | Medium | (11-08 감사에서 로드맵) 비밀번호를 바꿔도 기존 JWT가 만료까지 유효했습니다. 토큰이 탈취되면 비밀번호를 바꿔도 막을 수 없습니다 | ✅ `users.sessionVersion`(migration 1766)을 추가했습니다. JWT에 `sv`를 넣고 `JwtStrategy`가 매 요청 DB 값과 비교합니다. 비밀번호를 바꾸면 버전이 1 오릅니다. 배포 전에 발급된 토큰은 `sv`가 없어 0으로 간주하므로 배포 직후에도 유효합니다 |
| SEC-19 | Medium | 로그인 제한이 IP당 5회/분뿐이었습니다. IP를 바꾸며 한 계정을 공격하는 무차별 대입을 막지 못합니다 | ✅ 정규화한 식별자(`username:alice`)마다 실패 10회/15분이면 비밀번호를 검사하기 전에 429 `RATE_LIMITED`와 `Retry-After`를 반환합니다. 성공하면 초기화합니다. 없는 계정도 같은 방식으로 세어 계정 존재가 드러나지 않습니다. 저장소는 프로세스 메모리(상한 1만 키)이며 PM2 단일 인스턴스 기준입니다 |
| SEC-18 | Medium | 계정 DTO에 길이 상한이 없었습니다.<br>· bcrypt는 72바이트 이후를 무시하므로 앞 72바이트가 같으면 같은 비밀번호로 취급<br>· 256자 username은 `Data too long` DB 오류로 500<br>· 최소 비밀번호 길이 6자 | ✅ 새 비밀번호 8자 이상·UTF-8 72바이트 이하, username 4~50, email 255, name 100(`src/users/domain/user-input-policy.ts`)<br>✅ 로그인과 `currentPassword`는 기존 비밀번호 호환을 위해 1024자 상한만 둡니다<br>✅ SNS DTO 12개에 token·code·state·nonce·PKCE·redirectUri 상한 |
| SEC-16 | Low | (11-08 로드맵) redirect URI 허용 목록이 비면 검사를 생략했습니다 | ✅ 5개 provider 모두 목록이 비면 code flow를 거부합니다(`*_CONFIG_MISSING`) |
| SEC-25 | Low | 가입 응답(`Username already exists`, `Email already exists`)으로 계정 존재 여부를 알 수 있습니다 | 📝 가입 UX와의 절충입니다. IP당 전역 제한(10회/60초)으로 대량 조회 비용을 높입니다. 필요하면 가입 email 인증 흐름과 함께 메시지를 통일합니다(📌 P2) |
| SEC-26 | Low | 프로필 email 변경에 소유 확인이 없습니다. 다른 사람의 email을 먼저 등록해 둘 수 있습니다(계정 병합은 하지 않으므로 탈취로 이어지지는 않음) | 📌 P2 email 인증 |

### 3.2 입력·오류·로그

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| SEC-21 | Medium | 비로그인 `GET /music/legacy/tracks`의 `search`·`title`·`artistName`이 길이 제한 없이 `LIKE '%…%'`로 들어갑니다. `%`, `_`도 이스케이프하지 않아 사용자가 패턴을 조작할 수 있습니다. 인덱스를 쓰지 못하는 쿼리라 비용이 큽니다 | ✅ 100자 상한, `escapeLike`로 `\ % _` 이스케이프 / 📌 검색 구조 개선은 [DB 가이드 DB-9](../learning/database-improvement-guide.kr.md#db-9-검색-쿼리) |
| SEC-22 | Low | AudioAsset `url`이 `ftp:` 등 다른 scheme을 받고, 2000자 컬럼 상한을 DTO에서 검사하지 않았습니다(admin 전용) | ✅ http(s) 절대 URL만, `@MaxLength(2000)`. 음악 쓰기 DTO 전체를 컬럼 길이에 맞춤 |
| SEC-14 | Low | (11-08 로드맵) 클라이언트가 보낸 `x-request-id`를 검사 없이 로그와 응답 헤더에 씁니다. 공백과 탭으로 가짜 로그 줄을 만들 수 있습니다 | ✅ `^[A-Za-z0-9._:=+/-]{1,128}$`일 때만 사용하고, 아니면 UUID를 새로 만듭니다 |
| SEC-23 | Low | 오류 로그의 `path`에 query string이 그대로 남습니다 | ✅ `redactSensitiveText` 적용(`token=…` 등 가림) |
| SEC-24 | Low | provider 오류 원문(`error_description`, Apple의 `Invalid token audience: …`, Google의 `Invalid token issuer: <iss>`)이 401 응답 메시지로 나갑니다 | 📌 P2 401 메시지를 고정 문구로 바꾸고 원문은 로그로만 |
| SEC-20 | Low | `/health`는 rate limit 없이 매 요청 `SELECT 1`을 실행합니다 | 📌 P2 1~2초 결과 캐시, 또는 nginx에서 내부망만 허용 |

### 3.3 DB

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| DB-18 | Medium | 런타임 앱 계정이 migration용 DDL 권한(`CREATE, ALTER, DROP, INDEX`)까지 갖고 있습니다. 앱이 탈취되면 테이블을 지울 수 있습니다 | 📌 P1 계정 분리(migrator / runtime). 셸 환경변수가 env 파일보다 우선하므로 코드 변경 없이 적용할 수 있습니다. 절차: [DB 가이드](../learning/database-improvement-guide.kr.md#db-18-migration-계정과-런타임-계정-분리) |
| DB-19 | Medium | 개발 DB 서버에 TLS가 없습니다. `db:check:test`가 `tls: off`를 표시하며, 계정 정보와 데이터가 평문으로 오갑니다 | 📝 SSH 터널 또는 서버 TLS 설정. 절차: [DB 가이드](../learning/database-improvement-guide.kr.md#db-19-전송-구간-보호) |
| DB-20 | Low | 배포 문서의 백업 명령이 프로젝트 루트에 기본 umask로 덤프를 만듭니다(사용자 데이터·비밀번호 해시 포함). `.gitignore`에 `*.sql`이 없었습니다 | ✅ `.gitignore`에 `*.sql`, `*.sql.gz`, `*.dump` 추가. 백업 명령을 `umask 077` + 저장소 밖 경로로 변경 |

### 3.4 SNS 설정 규칙 (재활성화 조건)

SEC-17 수정으로 provider를 다시 켤 때의 조건이 강해졌습니다. 지금은 모든 provider가 꺼져 있어 런타임 영향은 없습니다. 자세한 내용은 [SNS 재활성화 체크리스트](../auth/sns-reenable-checklist.kr.md)를 봅니다.

| provider | 새로 필수가 된 것 |
| --- | --- |
| Google | `GOOGLE_ALLOWED_AUDIENCES`(기동 검증은 기존과 같고, 비어 있으면 런타임에도 거부), code flow면 `GOOGLE_OAUTH_REDIRECT_URIS` |
| Apple | code flow면 `APPLE_REDIRECT_URIS` |
| Kakao | `KAKAO_APP_ID`: **모든 환경에서 필수**(이전에는 운영만). code flow면 `KAKAO_REDIRECT_URIS` |
| Naver | code flow는 `NAVER_REDIRECT_URIS` 필수 |
| Facebook | code flow는 `FACEBOOK_REDIRECT_URIS` 필수 |

### 3.5 공급망·저장소·운영

| ID | 등급 | 발견 사항 | 조치 |
| --- | --- | --- | --- |
| OPS-12 | Low | 의존성·Actions 업데이트 자동화가 없습니다. `actions/checkout`이 `GITHUB_TOKEN`을 `.git/config`에 남깁니다. Actions가 tag(`@v4`)로 참조됩니다 | ✅ `.github/dependabot.yml`(npm 주간, minor/patch 묶음, github-actions 주간), `persist-credentials: false` / 📌 Actions SHA 고정 |
| OPS-13 | Medium | 공개 저장소인데 secret scanning push protection, CodeQL, 브랜치 보호 설정 여부를 코드로 확인할 수 없습니다 | 📝 [9장](#9-사용자가-할-일)의 GitHub 설정 |
| OPS-14 | Low | CI audit 기준이 `critical`입니다. 남은 high 2건은 multer(파일 업로드 미사용)이고, NestJS 12 업그레이드가 필요합니다 | 📌 P1 업그레이드 후 `--audit-level=high` |
| OPS-15 | Low | systemd 예시에 샌드박스 지시어가 없습니다 | ✅ `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, `ProtectHome` 등 추가 |
| R-7 | Low | 추적 중인 `.claude/settings.json`이 `Bash(npm run *)`를 허용합니다. Claude Code를 쓰는 사람의 PC에서 `migration:run:prod`, `db:reset:test`가 확인 없이 실행될 수 있습니다 | ✅ lint, format, typecheck, build, test, `env:check*`, `db:check*`, `docs:html*`만 허용 |
| R-8 | Info | Git 이력 비밀값 재검색 결과, `PRIVATE KEY`는 `.env.example`의 자리표시자(`\n...\n`)와 문서 속 검색 명령뿐이었습니다. AWS·GitHub·Slack 토큰 패턴은 없었습니다 | 이상 없음 |
| R-9 | Info | 개발 PC의 `.env.bak*` 백업 4개에 과거 비밀값이 있을 수 있습니다(Git 미추적, chmod 600) | 📝 필요 없으면 삭제([9장](#9-사용자가-할-일)) |

## 4. 이전 감사 항목 재확인

| ID | 내용 | 상태 |
| --- | --- | --- |
| SEC-1 | 음악 쓰기 admin 전용 | ✅ 유지. 메타데이터 spec(`music-authorization.spec.ts`) |
| SEC-2 | trust proxy | ✅ 운영 기본 `loopback` |
| SEC-3 | Kakao·Naver 토큰 치환 | ✅ 유지. Kakao는 이번에 fail-closed로 강화 |
| SEC-4 | SNS 내부 오류 노출 | ✅ 유지 |
| SEC-5 | 서버 측 state 비교가 CSRF 방어가 안 됨 | 📌 P1 서버 저장형 state/PKCE |
| SEC-6 | `exchange-code`·`verify-id-token` 공개 범위 | 📌 P1. SEC-17로 비활성 상태에서는 확실히 막힘 |
| SEC-7~13 | Apple email, email 덮어쓰기, 타이밍, `currentPassword`, Apple aud, 예약 username, CORS | ✅ 유지 |
| SEC-14, SEC-16 | request id, redirect 허용 목록 | ✅ **이번에 수정** |
| SEC-15 | Facebook `appsecret_proof` | 📌 P2 |
| AUTH-1, 2, 4 | HS256 고정, 만료 해석, providers 로드 | ✅ 유지 |
| AUTH-3 | 토큰 폐기 | ✅ **이번에 수정**(비밀번호 변경 시). refresh token과 로그아웃은 📌 P1 |
| AUTH-5 | local·SNS 응답 형식 불일치 | 📌 P1 |
| AUTH-6 | JWT iss/aud | 📌 P2 |

## 5. 변경 요약

| 커밋 | 내용 |
| --- | --- |
| `1aa4946` `fix(auth)` | provider 가드를 메타데이터로 판정, Google·Apple·Kakao fail-closed, redirect 허용 목록 필수, `KAKAO_APP_ID` 모든 환경 필수, e2e |
| `cc31e95` `feat(auth)` | `sessionVersion`(migration 1766)과 JWT `sv`, 계정 단위 로그인 실패 제한, `RateLimitedError`(429) |
| `09c8e0b` `fix(api)` | 입력 상한과 비밀번호 정책, LIKE 이스케이프, request id 검증, 로그 path redaction |
| `610078f` `chore(security)` | Dependabot, checkout 자격 증명 비보존, systemd 샌드박스, Claude Code 허용 목록 축소, DB 덤프 ignore |
| `docs` | 이 리포트, [API 보안 가이드](../learning/api-security-guide.kr.md), [DB 개선 가이드](../learning/database-improvement-guide.kr.md), [용어집](../learning/glossary.kr.md), 작업 내역, 관련 문서 최신화 |
| `docs(html)` | [학습 사이트](../html/README.md) 생성기와 첫 스냅샷 |

**새 migration:** `1766000000000-AddSessionVersionToUsers`. `users.sessionVersion INT UNSIGNED NOT NULL DEFAULT 0`을 추가하고, `down()`은 컬럼을 삭제합니다. 기존 데이터는 바꾸지 않는 추가 전용(expand) 변경입니다.

## 6. 배포 영향 (develop → main)

[11-08 감사 5.2 브레이킹 변경](2026-11-08-project-audit.kr.md#52-브레이킹-변경-main-기준-클라이언트운영)에 다음이 더해집니다.

| # | 변경 | 영향 | 대응 |
| --- | --- | --- | --- |
| 10 | 비밀번호를 바꾸면 **현재 토큰도 무효** | `PATCH /users/profile` 성공 후 같은 토큰으로 보낸 요청이 401 | 클라이언트는 비밀번호 변경 후 다시 로그인 화면으로 이동 |
| 11 | 새 비밀번호 8자 이상, UTF-8 72바이트 이하 | 가입·비밀번호 변경 400 | 클라이언트 입력 검증과 안내 문구 |
| 12 | 같은 계정 로그인 실패 10회/15분이면 429 | 로그인 화면 | `Retry-After`(초)를 읽어 안내 |
| 13 | AudioAsset `url`은 http(s) 절대 URL만 | 관리 도구 | — |
| 14 | `x-request-id`가 허용 형식이 아니면 서버가 새 값으로 바꿈 | 로그 추적 | UUID 사용 권장 |

**배포 순서:** 백업 → `npm run migration:show:prod`(1766 pending 확인) → `npm run migration:run:prod` → `npm run pm2:reload`.

**롤백**

- 앱만 되돌릴 때: 이전 빌드로 `pm2:reload`합니다. 이전 코드는 `sessionVersion` 컬럼을 읽지 않으므로 컬럼이 남아 있어도 동작합니다.
- 컬럼까지 되돌릴 때: **먼저 앱을 이전 빌드로 되돌린 뒤** `migration:revert:prod`를 실행합니다. 새 코드는 entity가 이 컬럼을 조회하므로, 순서가 바뀌면 모든 사용자 조회가 실패합니다.

## 7. 로드맵

### P1

- 인증
  - refresh token(해시 저장, rotation, 재사용 탐지)과 로그아웃·전체 세션 폐기([DB 가이드](../learning/database-improvement-guide.kr.md#refresh-token-테이블-설계))
  - 서버 저장형 OAuth state/PKCE(SEC-5), `exchange-code`·`verify-id-token` 범위 재검토(SEC-6)
  - 응답 envelope 통일(AUTH-5)
- DB: 계정 분리(DB-18), 전송 구간 보호(DB-19), drift 해소(DB-12)
- 공급망: NestJS 12·TypeORM 1.x 업그레이드 후 CI audit 기준을 high로(OPS-14), Actions SHA 고정(OPS-12)
- 로그인 실패 제한 저장소를 Redis로(인스턴스를 늘릴 때)

### P2

- provider 오류 메시지 고정(SEC-24), `/health` 캐시(SEC-20)
- email 인증(SEC-26)과 가입 응답 통일(SEC-25)
- JWT iss/aud(AUTH-6), Facebook `appsecret_proof`(SEC-15)
- 의도된 503을 ERROR로 남기는 로그 등급 조정(OPS-9). e2e 출력에서도 확인됨

## 8. 검증

```text
npm run lint:check     → 0 problems
npm run format:check   → All matched files use Prettier code style
npm run typecheck      → 0 errors
npx jest               → 58 suites / 442 tests passed
npm run build          → success
npm audit --omit=dev   → 5 (3 moderate, 2 high), critical 0
```

**Test DB (`app_db_test`, 사용자 개발 서버. 다른 DB는 건드리지 않음)**

| 단계 | 결과 |
| --- | --- |
| `db:check:test` (읽기 전용) | ownership dedicated(11 app tables), 9 applied, 1 pending |
| `db:setup:test` | `AddSessionVersionToUsers1766000000000` 적용 |
| `db:check:test --strict` | 10 applied, 0 pending |
| `migration:revert:test` → `migration:run:test` | down/up 모두 성공 |
| `migration:check:test` | `sessionVersion` 관련 차이 없음(새 drift 없음). 기존 DB-12 drift 49문은 그대로 |
| `test:e2e` | 5/5 통과 |

**HTTP 스모크 (빌드 결과 + `app_db_test`, 임시 사용자 생성 후 삭제)**

| 요청 | 기대 | 결과 |
| --- | --- | --- |
| `POST /auth/GOOGLE/login`, `/auth/Kakao/login`, `/auth/apple/login` | 503 `AUTH_*_DISABLED` | 통과 |
| 가입: 7자 비밀번호, 73바이트 비밀번호, 51자 username | 400 | 통과 |
| 가입 → 로그인 → 프로필 | 201 → 201 → 200 | 통과 |
| 비밀번호 변경 후 이전 토큰 | 401 | 통과 |
| 새 비밀번호로 로그인한 토큰 | 200 | 통과 |
| 서로 다른 IP 10개에서 틀린 비밀번호 10회 | 401 × 10 | 통과 |
| 11번째(올바른 비밀번호, 새 IP) | 429 `RATE_LIMITED`, `Retry-After: 900` | 통과 |
| `x-request-id: trace-123` / `bad id with spaces` | 그대로 / 새 UUID | 통과 |

**CI:** PR #10에 push한 뒤 `verify`와 `database` job 결과를 PR에서 확인합니다.

**검증하지 못한 것:** SNS provider 실연동(외부 계정 필요). 운영 DB 적용(사용자가 배포할 때).

## 9. 사용자가 할 일

1. **GitHub 저장소 설정**(Settings)
   - Code security: **Secret scanning**과 **Push protection** 켜기(공개 저장소 무료)
   - **Dependabot alerts**와 security updates 켜기. 버전 업데이트는 이번에 추가한 `.github/dependabot.yml`이 담당합니다
   - **CodeQL default setup** 켜기
   - Branches: `develop`, `main`에 PR 필수와 status check(`verify`, `database (MariaDB 10.11)`) 필수
2. **클라이언트 공지:** [6장](#6-배포-영향-develop--main)의 10~13번
3. **Local DB:** `app_db_dev` GRANT를 받은 뒤 `npm run db:setup`을 실행하면 10개 migration이 모두 적용됩니다
4. **운영 배포:** 백업 후 1766 migration 적용([EC2 배포 가이드](../deployment/mariadb-systemd.kr.md))
5. **개발 PC 정리(선택):** 프로젝트 루트의 `.env.bak`, `.env.bak.2026-11-08`, `.env.bak.2026-11-09`, `.env.bak.2026-11-09-2`가 더 필요 없으면 삭제합니다
6. **DB 계정 분리(P1):** [DB 가이드 DB-18](../learning/database-improvement-guide.kr.md#db-18-migration-계정과-런타임-계정-분리)의 SQL을 운영 MariaDB에서 실행합니다
