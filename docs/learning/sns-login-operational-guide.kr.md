# SNS 로그인 빌드·동작·운영·학습 가이드

작성일: 2026-09-12

이 문서는 현재 NestJS 프로젝트의 Google, Apple, Kakao, Naver, Facebook 로그인 흐름을 빌드하고 검증하며 운영하는 절차를 정리합니다. 실제 provider credential을 문서나 저장소에 기록하지 않고, 환경변수와 운영 secret 저장소를 통해 주입합니다.

## 1. 구조

```text
Client
  -> POST /auth/{provider}/login
  -> provider use-case
  -> provider adapter (JWKS, OAuth token endpoint, Graph/Profile API)
  -> SocialAccountLinkerPort
  -> users + social_accounts transaction
  -> SessionIssuerPort
  -> application JWT
```

- Google, Apple: `idToken` 또는 authorization code
- Kakao, Naver, Facebook: access token 또는 authorization code
- 계정 식별자: 이메일이 아니라 `(provider, providerUserId)`
- 세션: 모든 로그인 방식이 `SessionModule`의 JWT issuer를 공유
- 저장: user와 social account 생성/갱신은 TypeORM transaction으로 처리

## 2. 빌드와 단위 검증

Node와 npm 환경을 준비한 뒤 잠금 파일 기준으로 의존성을 설치합니다.

```bash
npm ci
npm run build
npm test -- --runInBand
```

변경한 TypeScript 파일만 먼저 lint합니다.

```bash
npx eslint \
  src/config/app-env.ts \
  src/common/auth/provider-readiness.guard.ts \
  src/common/auth/provider-readiness.guard.spec.ts \
  src/config/app-env.spec.ts
```

MariaDB와 전용 테스트 계정이 준비된 환경에서는 다음을 추가 실행합니다.

```bash
npm run migration:show
npm run migration:run
npm run test:e2e
```

실제 provider 서버 호출은 단위 테스트에서 mock으로 대체합니다. 실계정 OAuth 검증은 별도 staging 환경에서 redirect URI와 credential을 확인한 뒤 수행합니다.

## 3. 환경변수 정책

### 공통 필수값

```env
NODE_ENV=development|test|production
DB_TYPE=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=...
DB_PASSWORD=...
DB_DATABASE=...
DB_SYNCHRONIZE=false
JWT_SECRET=...
JWT_EXPIRES_IN=1h
```

### provider 활성화

```env
AUTH_GOOGLE_ENABLED=true
AUTH_APPLE_ENABLED=false
AUTH_KAKAO_ENABLED=false
AUTH_NAVER_ENABLED=false
AUTH_FACEBOOK_ENABLED=false
```

`false`인 provider는 route가 제거되지 않지만 controller와 외부 provider API를 실행하지 않고 `503`을 반환합니다.

Google은 기존 환경과의 호환성을 위해 flag를 생략하면 활성화로 추론됩니다. Google을 사용하지 않으면 반드시 `AUTH_GOOGLE_ENABLED=false`를 지정합니다.

### flow 설정

- Google ID token: `GOOGLE_ALLOWED_AUDIENCES`
- Google code: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URIS`
- Apple ID token: `APPLE_ALLOWED_AUDIENCES`
- Apple code: `APPLE_SERVICE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_REDIRECT_URIS`
- Kakao: `KAKAO_REST_API_KEY`; code flow는 `KAKAO_REDIRECT_URIS`를 함께 관리
- Naver: `NAVER_CLIENT_ID`; code flow는 `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URIS`를 함께 관리
- Facebook: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`; code flow는 `FACEBOOK_REDIRECT_URIS`를 함께 관리

production에서 선택한 code-flow 설정을 일부만 입력하면 startup validation이 실패합니다. token-only 배포는 code-flow 설정을 모두 생략할 때만 허용됩니다. placeholder 값을 실제 secret처럼 입력하지 않습니다.

## 4. API 동작 계약

### 로그인

```text
POST /auth/google/login
POST /auth/apple/login
POST /auth/kakao/login
POST /auth/naver/login
POST /auth/facebook/login
```

각 요청은 token 계열 입력과 `code` 중 정확히 하나를 사용합니다. 둘 다 보내거나 둘 다 생략하면 provider별 `*_BAD_REQUEST`가 반환됩니다.

성공 응답은 공통적으로 application JWT와 사용자 공개 정보를 반환합니다.

```json
{
  "ok": true,
  "requestId": "...",
  "data": {
    "accessToken": "<application-jwt>",
    "expiresIn": 3600,
    "user": { "id": 1, "username": "google_...", "email": "user@example.com" }
  }
}
```

### 비활성 provider

```json
{
  "ok": false,
  "requestId": "...",
  "errorCode": "AUTH_KAKAO_DISABLED",
  "message": "This authentication provider is not available."
}
```

HTTP status는 `503`입니다. `x-request-id`는 응답 헤더와 envelope에 함께 있어야 합니다.

### OAuth code 보안

- code flow는 등록된 redirect URI만 사용합니다.
- `state`와 `expectedState`는 둘 다 전달하거나 둘 다 생략해야 하며, 값이 다르면 state mismatch입니다.
- Google code flow에서는 PKCE `codeVerifier`를 사용합니다.
- token, code, client secret, private key는 로그에 기록하지 않습니다.
- 이메일이 같다는 이유만으로 local 계정과 SNS 계정을 자동 병합하지 않습니다.

## 5. EC2 + MariaDB 운영 순서

1. `/etc/backend-nestjs/backend-nestjs.env`에 환경변수를 주입합니다.
2. 파일 권한을 `root:root`, `600`으로 제한합니다.
3. MariaDB는 애플리케이션과 같은 EC2라면 `127.0.0.1:3306`으로 연결합니다.
4. Security Group에서 3306을 인터넷에 공개하지 않습니다.
5. `DB_SYNCHRONIZE=false`를 확인합니다.
6. build 후 migration 상태를 확인하고 migration을 실행합니다.
7. systemd 또는 PM2로 애플리케이션을 재시작합니다.
8. `/health`와 비활성 provider 503 응답을 확인합니다.

권장 명령:

```bash
npm ci
npm run build
npm run migration:show
npm run migration:run
npm run pm2:reload
curl -i http://127.0.0.1:3000/health
```

배포 중 migration이 실패하면 애플리케이션을 정상 서비스 상태로 전환하지 않습니다. 장애 로그에는 request ID, 경로, HTTP status만 남기고 secret과 token은 남기지 않습니다.

## 6. 장애 대응

| 증상 | 확인 항목 |
| --- | --- |
| `AUTH_*_DISABLED` 503 | `AUTH_{PROVIDER}_ENABLED`, 배포 환경변수 주입, systemd/PM2 `--update-env` |
| `*_CONFIG_MISSING` 503 | 활성 flow의 client credential, redirect URI, Apple private key |
| state mismatch | client가 보낸 state와 expectedState 보존 여부, callback 재시도 여부 |
| profile fetch 실패 | provider access token 만료, provider API 상태, Graph/API version |
| 앱 startup 실패 | `npm run build`, DB credential, `DB_SYNCHRONIZE`, production provider 설정 |
| DB 로그인 후 계정 미생성 | migration 상태, `social_accounts` unique/FK, transaction rollback 로그 |

## 7. 학습 순서

1. `src/app.module.ts`에서 provider module, global guard, filter를 확인합니다.
2. `src/auth/{provider}/interface`에서 DTO와 route 계약을 읽습니다.
3. `application/use-cases`에서 token/code 상호배타성, state 검증, 세션 발급 흐름을 읽습니다.
4. `infrastructure`에서 외부 API/JWKS adapter와 오류 매핑을 읽습니다.
5. `src/users/infrastructure/social-account-linker-typeorm.adapter.ts`에서 transaction 경계를 확인합니다.
6. `src/auth/session`에서 provider-agnostic JWT 발급을 확인합니다.
7. 각 구조를 해당 `*.spec.ts` 테스트와 함께 읽고, mock이 외부 호출을 어떻게 대체하는지 확인합니다.

핵심 학습 포인트는 provider별 외부 인증과 애플리케이션 계정·세션 발급을 분리하는 것입니다. provider가 바뀌어도 계정 연결 포트, transaction, JWT 세션 계약은 공용으로 유지합니다.
