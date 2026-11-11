# SNS 로그인 정리 (Google / Apple / Facebook / Kakao / Naver)

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`

## 아키텍처 요약

모든 로그인 방식(로컬 비밀번호 + 5개 SNS provider)은 동일한 레이어드(헥사고날/Clean
Architecture) 구조를 따르며, `interface`=View, `application/use-case`=ViewModel,
`domain`=Model로 이해해도 됩니다.

```
src/auth/session/              ← 공용 JWT 세션 발급/검증 (SessionIssuerPort, JwtStrategy, HS256 고정)
  interface/roles.guard.ts, auth-route.decorators.ts  ← @Authenticated(), @AdminOnly() (RBAC)
src/auth/shared/               ← SNS provider 공통 코드
  domain/social-auth.error.ts              ← SocialAuthError 기반 클래스 + 오류 코드 → HTTP 분류
  interface/social-auth-exception.filter.ts ← 5개 provider 공용 예외 필터(내부 오류 마스킹·로그)
  interface/to-social-auth-error.ts        ← 컨트롤러 catch용 래퍼
  infrastructure/fetch-with-timeout.ts     ← 외부 호출 5초 타임아웃, 안전한 JSON 파싱
src/auth/local/                ← 로컬 비밀번호 로그인
src/auth/{provider}/           ← google/apple/facebook/kakao/naver
  domain/{provider}-auth.errors.ts        ← 에러 코드 enum + SocialAuthError 상속 클래스
  application/ports/                       ← 포트 인터페이스
  application/use-cases/                   ← 오케스트레이션 (로그인, 코드교환)
  infrastructure/                          ← 외부 API 연동 어댑터
  interface/                               ← Controller, DTO (@UseFilters(SocialAuthExceptionFilter))
  auth-{provider}.module.ts                ← UsersModule + SessionModule 직접 import
src/users/
  domain/social-identity.ts, login-identifier-type.enum.ts  ← SNS/로그인 공용 도메인 타입 (users가 소유)
  application/ports/social-account-linker.port.ts           ← SNS 계정 연결 포트 (users가 소유, auth가 소비)
  infrastructure/social-account-linker-typeorm.adapter.ts   ← 포트 구현체
```

`users.social_accounts` 테이블(provider, providerUserId 유니크)이 SNS 계정 연결을 담당하며,
한 사용자가 여러 provider를 동시에 연결할 수 있습니다.

## Provider 비교표

| Provider | 플로우 | 로그인 엔드포인트 | 식별 방식 |
|----------|--------|-------------------|-----------|
| Google | OIDC id_token 검증 또는 인가코드 교환 | `POST /auth/google/login` (idToken\|code) | JWT id_token 서명 검증 (Google 공개키) |
| Apple | OIDC id_token 검증(JWKS) 또는 인가코드 교환(ES256 client-secret) | `POST /auth/apple/login` (idToken\|code) | JWT id_token 서명 검증 (Apple JWKS) |
| Facebook | 인가코드 교환 또는 클라이언트 발급 accessToken | `POST /auth/facebook/login` (accessToken\|code) | Graph API `/me` + `/debug_token` 검증 |
| Kakao | 인가코드 교환 또는 클라이언트 발급 accessToken | `POST /auth/kakao/login` (accessToken\|code) | REST API `/v2/user/me` |
| Naver | 인가코드 교환 또는 클라이언트 발급 accessToken | `POST /auth/naver/login` (accessToken\|code) | REST API `/v1/nid/me` |

모든 provider는 `POST /auth/{provider}/exchange-code`로 인가코드→토큰 교환만 별도 호출할 수 있고,
Google/Apple은 `POST /auth/{provider}/verify-id-token`으로 id_token 검증만 별도 호출할 수 있습니다.

## 필수 환경변수

| Provider | 환경변수 | 비고 |
|----------|----------|------|
| Google | `GOOGLE_ALLOWED_AUDIENCES`(필수), `GOOGLE_ALLOWED_ISSUERS`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URIS` | Google Cloud Console에서 OAuth 클라이언트 발급 |
| Apple | `APPLE_ALLOWED_AUDIENCES`(Apple 활성 시 모든 환경에서 필수), `APPLE_SERVICE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_REDIRECT_URIS` | Apple Developer Portal → Certificates, Identifiers & Profiles에서 Team ID / Key ID / .p8 개인키 / Service ID 발급 |
| Facebook | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URIS`, `FACEBOOK_GRAPH_API_VERSION`(기본 v20.0) | Meta for Developers에서 앱 생성 후 App ID/Secret 발급 |
| Kakao | `KAKAO_APP_ID`(production 필수), `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`(선택), `KAKAO_REDIRECT_URIS` | Kakao Developers에서 앱 생성 후 앱 ID·REST API 키 발급. `KAKAO_APP_ID`는 클라이언트가 보낸 accessToken의 발급 앱(`/v1/user/access_token_info`의 `app_id`) 검증에 사용 |
| Naver | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URIS` | Naver Developers에서 애플리케이션 등록 후 발급 |

> **현재 상태(2026-11-08): SNS 5종 모두 비활성, 로컬 로그인만 운영합니다.** provider는 명시적 opt-in(`AUTH_{PROVIDER}_ENABLED=true`)일 때만 켜지고, credential 키가 있어도 플래그가 없으면 꺼져 있습니다. 다시 켜기 전에는 [재활성화 체크리스트](sns-reenable-checklist.kr.md)를 완료하세요. Naver는 켜더라도 accessToken 로그인이 기본 차단됩니다(`AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED=false`, code flow만 허용).

`AUTH_{PROVIDER}_ENABLED=false`(또는 미지정)인 provider는 route를 유지하지만 외부 API를 호출하지 않고
`503 Service Unavailable`과 `AUTH_{PROVIDER}_DISABLED`를 반환합니다. 로컬 로그인
`POST /auth/login`은 provider readiness 검사 대상이 아니며 SNS 설정과 독립적으로 동작합니다.

개발/테스트 환경에서는 비활성 provider의 secret 없이도 build와 앱 기동이 가능합니다. 운영에서
활성화한 provider는 최소 검증 설정이 필요하고, authorization-code flow 설정을 일부만 입력하면
startup validation이 실패합니다. code flow를 사용하지 않는 token-only 배포는 허용하되,
redirect URI allowlist와 client credential을 임의의 placeholder로 채우지 않습니다.

## 에러 코드 네이밍 규칙

각 provider는 `AUTH_{PROVIDER}_*` 형식의 에러 코드를 사용합니다 (예: `AUTH_KAKAO_EXCHANGE_FAILED`).
공통 카테고리:

- `*_BAD_REQUEST` (400): 잘못된 요청 (idToken/code/accessToken 동시 전달 등)
- `*_STATE_MISMATCH` / `*_INVALID_AUDIENCE` / `*_INVALID_ISSUER` / `*_TOKEN_EXPIRED` / `*_MISSING_SUB` / `*_EXCHANGE_FAILED` / `*_PROFILE_FETCH_FAILED` / `*_INVALID_TOKEN` (401)
- `*_CONFIG_MISSING` (503): 활성 flow에 필요한 자격증명이 설정되지 않음
- `AUTH_{PROVIDER}_DISABLED` (503): provider flag가 비활성화됨
- `*_INTERNAL_ERROR` (500): 메시지는 `Internal server error`로 고정되고, 원인(DB 오류 등)은 requestId와 함께 서버 로그에만 남습니다.

상태 매핑은 `src/auth/shared/domain/social-auth.error.ts`의 `classifySocialAuthErrorCode()` 한 곳에서 정하며, provider별 기존 매핑과 같은지 `social-auth-exception.filter.spec.ts`가 고정합니다.

## 계정 연결과 보안 정책

- **토큰 발급 앱 검증**: 클라이언트가 보낸 provider token이 이 앱용인지 확인합니다.
  - Google/Apple: ID Token `aud`
  - Facebook: `debug_token`의 `app_id`
  - Kakao: `access_token_info`의 `app_id`
  - ⚠ Naver는 공식 앱 바인딩 검증 API를 확인하지 못했습니다. 그래서 accessToken 로그인을 기본 차단하고 code flow만 허용합니다(`AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED=false`)([감사 로드맵 P0](../audit/2026-11-08-project-audit.kr.md#p0-main-배포-전-결정-또는-확인)).
- **email 정책**: provider email은 `social_accounts.email`에 저장합니다. `users.email`은 비어 있을 때만 채우며, 미검증(`emailVerified === false`)이거나 다른 계정이 쓰는 email은 쓰지 않습니다. 같은 email이라도 로컬 계정과 자동 병합하지 않습니다.
- **Apple email**: 서명된 ID Token의 email이 우선합니다. 최초 인증 시 클라이언트가 보낸 `user.email`은 token에 email이 없을 때만 미검증으로 사용합니다.
- **username 예약**: SNS 계정 username은 `<provider>_<sub>`입니다. 로컬 가입에서는 이 접두사를 쓸 수 없습니다.
- **동시 최초 로그인**: UNIQUE 위반이 나면 트랜잭션 밖에서 다시 조회해 먼저 생성된 계정을 반환합니다.
- **OAuth state**: `state`/`expectedState`는 모두 클라이언트가 보내므로 서버 비교는 형식 검사 수준입니다. CSRF 방어를 위한 state 검증은 redirect를 받는 클라이언트가 해야 합니다. 서버 저장형 state/PKCE는 로드맵 P1입니다.

## 참고

- DB 마이그레이션 `1762000000000-CreateSocialAccounts`는 기존 `users.googleId` 데이터를
  `social_accounts`로 이관한 뒤 `users.provider`/`users.googleId` 컬럼을 제거합니다.
  운영 DB에 적용하기 전 반드시 백업하세요.
- Google 로그인 상세 가이드는 [google-login.kr.md](./google-login.kr.md) 참고.
- 운영 배포와 secret 주입은 [배포/시크릿 운영 체크리스트](../learning/deployment-secrets-checklist.kr.md)를 참고.
