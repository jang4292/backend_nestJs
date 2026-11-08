# NestJS 아키텍처·운영 안정성 학습 가이드

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`

이 저장소의 구조를 NestJS와 Clean Architecture 관점에서 따라 읽기 위한 가이드입니다. "무엇을 바꿨는가"보다 "왜 이렇게 나눴는가"에 초점을 둡니다. 남은 구조 과제는 [감사 리포트 3.1장](../audit/2026-11-08-project-audit.kr.md#31-clean-architecture--ddd)을 참고하세요.

## 1. 학습 목표

이 가이드를 읽고 나면 다음을 설명할 수 있어야 합니다.

- `main.ts`와 `AppModule`의 책임 차이
- 기동 시 환경변수 검증이 운영 안정성에 중요한 이유
- domain, application, infrastructure, interface 계층의 의존 방향과 포트·어댑터
- 도메인 오류를 HTTP로 바꾸는 위치를 한 곳에 모으는 이유
- 인증(JWT)과 인가(RBAC)의 분리
- 테스트, lint, typecheck, build를 최소 품질 게이트로 보는 방법

## 2. 전체 구조

```text
src/
  main.ts                 HTTP 서버 기동: helmet, CORS, trust proxy, ValidationPipe, shutdown hooks, Swagger
  app.module.ts           루트 조립: Config 검증, TypeORM, Throttler, 전역 interceptor/filter/guard
  config/                 app-env.ts(환경변수 파싱·검증), duration.ts
  database/               database-options.ts, data-source.ts(CLI), mariadb-errors.ts, migrations/
  common/
    errors/               DomainError 계층(프레임워크 무관)
    filters/              GlobalExceptionFilter(DomainError·HttpException → 공통 envelope)
    http/                 api-response.ts({ok, requestId, data|errorCode})
    logging/              redact-sensitive-text.ts
    request-id/           RequestIdInterceptor·Service
    auth/                 ProviderReadinessGuard(AUTH_*_ENABLED), AuthenticatedRequest
  auth/
    session/              JWT 발급(SessionIssuerPort)·검증(JwtStrategy), RolesGuard, @AdminOnly()
    local/                로컬 로그인 use-case
    shared/               SNS 공통: SocialAuthError, SocialAuthExceptionFilter, fetchWithTimeout
    google|apple|kakao|naver|facebook/
      domain/ application/{ports,use-cases}/ infrastructure/ interface/
  users/
    domain/               UserRole, SocialIdentity, 예약 username 규칙
    application/          ports(UserRepository, PasswordHasher, SocialAccountLinker), use-cases
    infrastructure/       TypeORM repository, bcrypt hasher, social account linker
    interface/            UsersController, DTO, PublicUser presenter
    users.service.ts      다른 모듈이 쓰는 공개 facade
  music/
    (legacy)              application/ infrastructure/ interface/ — /music/legacy
    catalog/              CatalogMusicService, entities, interface — /music
```

## 3. Bootstrap: `main.ts`

| 설정 | 이유 |
| --- | --- |
| `app.set('trust proxy', TRUST_PROXY)` | proxy 뒤에서 `req.ip`가 실제 클라이언트가 되도록 합니다. Throttler가 IP 기준으로 집계하기 때문입니다 |
| `enableShutdownHooks()` | SIGTERM 시 진행 중인 요청과 DB 풀을 정리합니다 |
| `helmet()` | 기본 보안 헤더 |
| `enableCors({ origin: CORS_ORIGINS, credentials, exposedHeaders: ['x-request-id'] })` | `*`는 `app-env.ts`에서 거부합니다 |
| `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` | 모든 DTO에 같은 입력 정책을 적용합니다. 컨트롤러마다 `@Body(ValidationPipe)`를 반복하지 않습니다 |
| Swagger(`NODE_ENV !== 'production'`) | 운영에서는 스펙을 노출하지 않습니다 |

## 4. 루트 조립: `AppModule`

- `ConfigModule.forRoot({ validate: validateAppEnv })`: 잘못된 설정이면 DB 연결이나 외부 호출 전에 기동을 실패시킵니다.
- `TypeOrmModule.forRootAsync`: `createDatabaseOptions()` 하나를 앱 런타임과 migration CLI가 공유합니다.
- 전역 provider
  - `RequestIdInterceptor`
  - `GlobalExceptionFilter`
  - `ThrottlerGuard`
  - `ProviderReadinessGuard`

학습 포인트: 설정은 한 곳에서 읽고 주입합니다. 코드 곳곳에서 `process.env`를 읽으면 검증과 테스트가 어려워집니다.

## 5. 환경변수 검증: `src/config/app-env.ts`

**어떤 파일을 읽는가** (`src/config/env-files.ts`)

- `NODE_ENV`에 따라 env 파일 하나를 고릅니다: Local(`development`) → `.env`, Test(`test`) → `.env.test.local`(필수), Prod(`production`) → `.env.production`
- `ENV_FILE`로 다른 파일을 지정할 수 있습니다.
- 셸 환경변수가 파일 값보다 우선합니다.
- 앱, migration CLI, DB 도구(`db:*`), e2e가 모두 이 규칙 하나를 씁니다. 환경별 절차는 [환경별 DB·설정 가이드](../deployment/database-environments.kr.md)에 있습니다.
- 검증에 실패하면 `src/config/env-diagnostics.ts`가 메시지에 **읽은 파일과 `NODE_ENV`**를 붙입니다. 같은 키가 다른 환경 파일에 있으면 `Hint:`도 붙입니다(값은 출력하지 않음).

대표 규칙:

- **필수:** `JWT_SECRET`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- **SNS:** 5종 모두 `AUTH_<P>_ENABLED=true`일 때만 켜지고(현재 전부 off), 켜진 provider만 자기 키를 요구합니다(Google이면 `GOOGLE_ALLOWED_AUDIENCES`)
- **test 전용:** `DB_DATABASE`는 `*_test`만 허용
- **모든 환경:** `DB_SYNCHRONIZE=true` 거부(스키마는 migration으로만 변경)
- **DB 타입:** `DB_TYPE`은 `mariadb`만 허용
- **production 전용**
  - `CORS_ORIGIN` 필수
  - `JWT_SECRET` 32자 이상, placeholder 금지
  - 활성 provider의 최소 설정(Kakao는 `KAKAO_APP_ID` 포함)
- **환경 무관:**
  - `JWT_EXPIRES_IN` 형식(`3600|30m|1h|7d`)
  - `CORS_ORIGIN`에 `*` 금지
  - Apple이 활성이면 `APPLE_ALLOWED_AUDIENCES`

`AppEnv`에 키를 추가하면 `scripts/runtime-env-keys.cjs`에도 추가해야 PM2와 Secrets Manager 경로로 전달됩니다. 빠뜨리면 `src/config/runtime-env-keys.spec.ts`가 실패합니다.

## 6. 계층과 포트·어댑터 (Users 예시)

```text
UsersController (interface)            ── DTO 검증, PublicUser로 변환
  → UsersService (facade)               ── 다른 모듈에 공개하는 application API
    → CreateUserUseCase / UpdateUserUseCase / VerifyCredentialsUseCase (application)
        → USER_REPOSITORY_PORT          ← UserTypeOrmRepository (infrastructure)
        → PASSWORD_HASHER_PORT          ← BcryptPasswordHasherAdapter (infrastructure)
        → DomainError(Conflict/NotFound/…) 던짐 → GlobalExceptionFilter가 HTTP로 변환
```

- **포트 구성 패턴:** `Symbol` 토큰 + interface + `{ provide: TOKEN, useExisting: Adapter }`(`users.module.ts`, `music.module.ts`)
- **의존 방향:** use-case는 TypeORM `Repository`, `bcrypt`, interface DTO를 import하지 않습니다. 테스트는 포트를 `jest.Mocked`로 대체해 DB 없이 작성합니다(`src/users/application/use-cases/*.spec.ts`).
- **보안 규칙의 위치**
  - 비밀번호 해시는 entity에서 `select: false`로 숨깁니다.
  - 로그인 경로만 `findCredentialsByIdentifier()`로 명시적으로 조회합니다.
  - 계정이 없어도 해셔가 같은 비용의 비교를 하므로 응답 시간으로 계정 존재를 알 수 없습니다.
- **현재 한계:** 포트 시그니처가 아직 TypeORM entity(`User`)를 씁니다. 도메인 모델 분리는 로드맵 P2입니다.

## 7. 오류 처리를 한 곳에 모으기

| 오류 종류 | 던지는 곳 | 변환하는 곳 | 응답 |
| --- | --- | --- | --- |
| `DomainError`(`InvalidArgument`/`Unauthorized`/`Forbidden`/`NotFound`/`Conflict`) | application, infrastructure | `GlobalExceptionFilter` | 400/401/403/404/409, `{ok:false, requestId, errorCode, message}` |
| `HttpException` | Nest 내장(ValidationPipe, Guard) | `GlobalExceptionFilter` | 상태 코드 그대로 |
| `SocialAuthError`(`AUTH_<PROVIDER>_*`) | SNS use-case, adapter | `SocialAuthExceptionFilter` | 코드 접미사로 400/401/503/500 |
| 그 밖의 오류(DB 등) | 어디서든 | 두 필터 모두 | 500, 메시지 `Internal server error`, 원인은 redaction 후 로그 |

- **DB 오류 판별:** `src/database/mariadb-errors.ts`에서 MariaDB 코드(`ER_DUP_ENTRY`, `ER_ROW_IS_REFERENCED_2`)로 판별합니다. infrastructure가 이를 `ConflictError`/`ForeignKeyConstraintError`로 바꿉니다.
- **use-case의 역할:** HTTP 상태를 알지 못합니다.

## 8. 인증과 인가

```text
요청 → ThrottlerGuard → ProviderReadinessGuard(/auth/<provider>/*만)
     → JwtAuthGuard (HS256만 허용, 토큰 검증 → DB에서 사용자 재조회 → req.user = PublicUser{role, providers})
     → RolesGuard (@Roles(UserRole.ADMIN) 메타데이터와 req.user.role 비교 → 아니면 403)
```

- **라우트 데코레이터:** `@Authenticated()`는 로그인, `@AdminOnly()`는 admin을 요구합니다(`src/auth/session/interface/auth-route.decorators.ts`).
- **역할 반영:** 역할을 JWT에 넣지 않고 매 요청 DB에서 읽으므로, 권한 변경이 즉시 반영됩니다.
- **회귀 방지:** 음악 쓰기 라우트에 `@AdminOnly()`가 빠지면 `src/music/music-authorization.spec.ts`가 실패합니다.

## 9. SNS 로그인: provider별 모듈 + 공통 커널

- provider마다 `domain/application/infrastructure/interface`를 가지며, 외부 API는 포트 뒤에 둡니다. 예: `GoogleTokenVerifierPort`, `KakaoOAuthPort`
- 공통으로 쓰는 부분
  - 계정 연결: `SocialAccountLinkerPort`(users)
  - 세션 발급: `SessionIssuerPort`(session)
  - 오류 처리: `src/auth/shared/`
- 외부 호출은 `fetchWithTimeout`(5초)과 `readJsonSafely`를 거칩니다.
- **현재 한계:** kakao/naver/facebook 로그인 use-case는 아직 거의 같은 코드입니다. 통합은 로드맵 P2입니다.

자세한 내용은 [SNS 로그인 개요](../auth/sns-login-overview.kr.md)를 참고하세요.

## 10. Music: Legacy와 Catalog

- `/music/legacy`
  - 구조: 이전 Artist/Track/Playlist 모델. `MusicService` facade → use-case 20개 → repository port
  - 테이블: `legacy_*`
- `/music`
  - 구조: 새 Catalog. `CatalogMusicService`, Track 1:N AudioAsset, Playlist 상태와 position
  - 테이블: `track`, `audio_asset`, `playlist`, `playlist_track`
- 공개 응답은 presenter를 거쳐 음원 URL과 내부 정보를 제외합니다.
- 현재 한계: `CatalogMusicService`는 use-case가 없는 큰 서비스이고, `MusicService`는 그대로 전달만 하는 facade입니다(로드맵 P2).

자세한 내용은 [Music 아키텍처](../music/architecture.kr.md)를 참고하세요.

## 11. DTO, Entity, Presenter

- **Entity:** DB 테이블과 관계
- **DTO:** HTTP 입력 계약(class-validator)
- **Command:** use-case 입력. 예: `CreateUserCommand`, `UpdateProfileCommand`. use-case가 DTO에 의존하지 않게 합니다.
- **Presenter:** entity를 공개 가능한 응답으로 변환합니다. 예: `toPublicUser`, `toPublicPlaylistResponse`

## 12. DB와 migration: `src/database/`

스키마는 **versioned migration으로만** 바꾸고(`synchronize` 금지), 배포 단계의 명령으로 적용합니다. 앱 기동 시 자동 실행은 하지 않습니다. 개념, 방식 비교, 검증 계층은 [DB·스키마 관리 학습 가이드](database-schema-management.kr.md)에서 자세히 다룹니다.

| 파일 | 책임 |
| --- | --- |
| `database-options.ts` | TypeORM 옵션. migration 경로는 실행 중인 파일 기준(src면 `.ts`, dist면 `.js`)이라 cwd와 무관 |
| `data-source.ts` | TypeORM CLI용 DataSource(앱과 같은 env 규칙) |
| `database-admin.ts` | DB 확인·생성·test DB 초기화, 권한 판정(`evaluatePrivileges`), 앱 소유 판정(`APP_TABLES`, `inspectOwnership`). 연결을 주입받아 unit test 가능 |
| `cli/db-tool.ts` | `db:check`(읽기 전용) / `db:ensure`(dev·test만) / `db:reset`(test만) |
| `migration-status.service.ts` | 기동 시 pending migration을 경고(읽기 전용, 기동을 막지 않음) |
| `mariadb-errors.ts` | 드라이버 오류 코드(`ER_DUP_ENTRY` 등) 판별 |

볼 만한 설계 포인트:

- **연결 시점:** 허용되지 않는 명령(운영에서 DB 생성 등)은 서버에 연결하기 전에 거부합니다.
- **SQL 식별자:** DB 이름처럼 파라미터로 바인딩할 수 없는 값은 허용 문자로 먼저 검증합니다.
- **출력:** 비밀번호는 어떤 출력에도 넣지 않습니다(`SHOW GRANTS`의 해시도 가림).
- **사전 점검:** 쓰기 전에 권한과 소유를 읽기 전용으로 확인하고, 부족하거나 다른 앱의 객체가 있으면 아무것도 바꾸지 않습니다.
- **범위:** 대상 DB 하나만 다룹니다. 다른 DB는 절대 바꾸지 않으며, spec이 쓰기 SQL의 대상을 검사합니다.

## 13. 품질 게이트

```bash
npm run lint:check     # ESLint (수정 없이 검사; 로컬 자동 수정은 npm run lint)
npm run format:check   # Prettier
npm run typecheck      # spec 포함 전체 tsc
npx jest               # 유닛 테스트
npm run build          # nest build
```

- GitHub Actions(`.github/workflows/ci.yml`)의 `verify` job이 PR과 push마다 위 순서로 실행하고, production critical 취약점 검사도 함께 합니다.
- **`database` job**은 MariaDB 10.11 서비스 컨테이너에서 다음을 실행합니다.
  1. 빈 DB에 전체 migration 적용
  2. pending이 없는지 확인
  3. 최신 migration revert 후 재적용
  4. drift 검사(현재는 보고만, 감사 DB-12)
  5. e2e
- Node 버전은 `.nvmrc`(24)로 고정합니다.

## 14. 추천 읽기 순서

1. `src/main.ts` → `src/app.module.ts` → `src/config/app-env.ts`
2. `src/common/errors/domain-error.ts` → `src/common/filters/global-exception.filter.ts`
3. `src/users/application/use-cases/update-user.use-case.ts`와 spec
4. `src/users/infrastructure/user-typeorm.repository.ts`
5. `src/auth/session/interface/jwt.strategy.ts` → `roles.guard.ts` → `auth-route.decorators.ts`
6. `src/auth/kakao/application/use-cases/kakao-login.use-case.ts` → `src/auth/shared/`
7. `src/music/catalog/interface/catalog-music.controller.ts` → `src/music/music-authorization.spec.ts`
8. `src/config/env-files.ts` → `src/database/database-options.ts` → `src/database/cli/db-tool.ts` → `src/database/migration-status.service.ts`

각 파일을 읽을 때 다음을 확인해 보세요.

- 이 파일의 책임은 한 문장으로 무엇인가?
- 이 파일이 알면 안 되는 것(프레임워크, DB, HTTP)을 알고 있지 않은가?
- 그 책임은 어떤 테스트가 검증하는가?

## 15. 실습 과제

1. **CA-2 이어서 하기:** legacy music use-case의 `NotFoundException`을 `NotFoundError`로 바꾸고 spec을 고칩니다.
2. **Playlist 상태 전이 규칙:** `publishPlaylist`에 `archived → published` 금지 규칙을 도메인 함수로 추출하고 테스트합니다(결정 문서 확정 후).
3. **SNS use-case 통합:** kakao/naver/facebook 로그인 use-case를 하나의 공통 함수로 묶되, provider 오류 코드 계약은 유지합니다.
4. **e2e 확장:** `/users/register` → `/auth/login` → `/users/profile` 흐름을 `test/`에 추가합니다. CI `database` job이 MariaDB에서 실행합니다.
5. **drift 해소(DB-12):** entity에 FK·인덱스 이름과 `datetime` 정밀도를 선언해 `npm run migration:check:test`가 `No changes`를 출력하게 만들고, CI의 `continue-on-error`를 제거합니다.
6. **스키마 변경 한 바퀴:** [DB·스키마 관리 학습 가이드 12장](database-schema-management.kr.md#12-실습-과제)의 과제를 따라 migration 생성 → 검증 → 되돌리기를 연습합니다.

## 16. 기억할 원칙

- 컨트롤러는 얇게, use-case는 프레임워크와 무관하게 유지합니다.
- 설정은 기동 시점에 검증하고, 실패는 빠를수록 좋습니다.
- HTTP 변환은 필터 한 곳에서 합니다. 비밀번호, 토큰, DB 오류 원문은 응답과 로그에 그대로 내보내지 않습니다.
- 인증(누구인가)과 인가(무엇을 할 수 있는가)는 별도 가드로 분리합니다.
- 스키마는 migration으로만 바꾸고, 같은 파일을 CI(빈 DB) → Test → Local → Prod 순으로 명령으로 적용합니다.
- 앱은 자기 전용 DB만 다룹니다. 같은 서버의 다른 DB와 객체는 지우거나 바꾸지 않습니다.
- 모든 작업 내역과 교훈은 [작업 내역과 배운 점](work-history-2026-11.kr.md)에 있습니다.
- 완료 조건은 lint, format, typecheck, test, build, CI `database` job 통과입니다.
