# NestJS 아키텍처·운영 안정성 학습 가이드

> 최신화 기준: 2026-11-08 · develop `9b731ef` + `chore/project-audit-2026-11`

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

대표 규칙:

- **필수:** `JWT_SECRET`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`. Google이 활성이면 `GOOGLE_ALLOWED_AUDIENCES`
- **DB 타입:** `DB_TYPE`은 `mariadb`만 허용
- **production 전용**
  - `CORS_ORIGIN` 필수
  - `DB_SYNCHRONIZE=true` 차단
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

## 12. 품질 게이트

```bash
npm run lint:check     # ESLint (수정 없이 검사; 로컬 자동 수정은 npm run lint)
npm run format:check   # Prettier
npm run typecheck      # spec 포함 전체 tsc
npx jest               # 유닛 테스트
npm run build          # nest build
```

- GitHub Actions(`.github/workflows/ci.yml`)가 PR과 push마다 위 순서로 실행하고, production critical 취약점 검사도 함께 합니다.
- e2e(`npm run test:e2e`)는 MariaDB 테스트 DB가 필요해 CI에 아직 포함되지 않았습니다.
- Node 버전은 `.nvmrc`(24)로 고정합니다.

## 13. 추천 읽기 순서

1. `src/main.ts` → `src/app.module.ts` → `src/config/app-env.ts`
2. `src/common/errors/domain-error.ts` → `src/common/filters/global-exception.filter.ts`
3. `src/users/application/use-cases/update-user.use-case.ts`와 spec
4. `src/users/infrastructure/user-typeorm.repository.ts`
5. `src/auth/session/interface/jwt.strategy.ts` → `roles.guard.ts` → `auth-route.decorators.ts`
6. `src/auth/kakao/application/use-cases/kakao-login.use-case.ts` → `src/auth/shared/`
7. `src/music/catalog/interface/catalog-music.controller.ts` → `src/music/music-authorization.spec.ts`

각 파일을 읽을 때 다음을 확인해 보세요.

- 이 파일의 책임은 한 문장으로 무엇인가?
- 이 파일이 알면 안 되는 것(프레임워크, DB, HTTP)을 알고 있지 않은가?
- 그 책임은 어떤 테스트가 검증하는가?

## 14. 실습 과제

1. **CA-2 이어서 하기:** legacy music use-case의 `NotFoundException`을 `NotFoundError`로 바꾸고 spec을 고칩니다.
2. **Playlist 상태 전이 규칙:** `publishPlaylist`에 `archived → published` 금지 규칙을 도메인 함수로 추출하고 테스트합니다(결정 문서 확정 후).
3. **SNS use-case 통합:** kakao/naver/facebook 로그인 use-case를 하나의 공통 함수로 묶되, provider 오류 코드 계약은 유지합니다.
4. **e2e:** MariaDB 서비스 컨테이너로 `/users/register` → `/auth/login` → `/users/profile` e2e를 작성합니다.

## 15. 기억할 원칙

- 컨트롤러는 얇게, use-case는 프레임워크와 무관하게 유지합니다.
- 설정은 기동 시점에 검증하고, 실패는 빠를수록 좋습니다.
- HTTP 변환은 필터 한 곳에서 합니다. 비밀번호, 토큰, DB 오류 원문은 응답과 로그에 그대로 내보내지 않습니다.
- 인증(누구인가)과 인가(무엇을 할 수 있는가)는 별도 가드로 분리합니다.
- 완료 조건은 lint, format, typecheck, test, build 통과입니다.
