# Google SNS 로그인 – 구현 가이드 (한국어)

## 개요

이 문서는 NestJS 백엔드에 추가된 Google 소셜 로그인(서버 측 검증) 기능을 설명합니다.

---

## 채널 × 플로우 매트릭스

| 채널 | 플로우 | 엔드포인트 | 비고 |
|------|--------|----------|------|
| 웹 (GIS `credential`) | ID 토큰 | `POST /auth/google/verify-id-token` 또는 `POST /auth/google/login` (idToken) | Google Identity Services가 JWT 반환 |
| 네이티브 (Android / iOS) | 인증 코드 + PKCE | `POST /auth/google/exchange-code` 후 `POST /auth/google/login` (code) | 서버에서 코드 교환; PKCE codeVerifier 권장 |
| QA / 테스트 | ID 토큰 전용 | `POST /auth/google/verify-id-token` | aud/iss 규칙 완화 없음 |

### 정책

- `/auth/google/login`은 `idToken` 또는 `code` 중 **정확히 하나**만 허용합니다.
- 둘 다 없거나 둘 다 있으면 → `400 AUTH_GOOGLE_BAD_REQUEST`.

---

## 엔드포인트

### `POST /auth/google/verify-id-token`

Google ID 토큰을 검증하고 디코딩된 소셜 신원을 반환합니다.

**요청 본문**

```json
{
  "idToken": "<Google ID 토큰>",
  "nonce": "<선택적 nonce>"
}
```

**성공 응답 (200)**

```json
{
  "ok": true,
  "requestId": "uuid-v4",
  "data": {
    "provider": "google",
    "sub": "117123456789012345678",
    "email": "user@example.com",
    "emailVerified": true,
    "name": "홍길동",
    "picture": "https://..."
  }
}
```

---

### `POST /auth/google/exchange-code`

Google 인증 코드를 토큰으로 교환합니다 (네이티브 / 인증 코드 플로우).

**요청 본문**

```json
{
  "code": "<인증 코드>",
  "redirectUri": "https://your-app.example.com/callback",
  "codeVerifier": "<PKCE code_verifier – 권장>",
  "state": "<수신된 state>",
  "expectedState": "<클라이언트가 저장한 원본 state>"
}
```

**성공 응답 (200)**

```json
{
  "ok": true,
  "requestId": "uuid-v4",
  "data": {
    "idToken": "<Google ID 토큰>",
    "accessToken": "<액세스 토큰>",
    "refreshToken": "<리프레시 토큰>",
    "expiresIn": 3600
  }
}
```

---

### `POST /auth/google/login`

전체 로그인 플로우: 신원 검증 → 사용자 upsert → JWT 세션 발급.

**요청 본문 (idToken 플로우)**

```json
{
  "idToken": "<Google ID 토큰>",
  "nonce": "<선택적 nonce>"
}
```

**요청 본문 (인증 코드 플로우)**

```json
{
  "code": "<인증 코드>",
  "redirectUri": "https://your-app.example.com/callback",
  "codeVerifier": "<PKCE code_verifier>",
  "state": "<수신된 state>",
  "expectedState": "<원본 state>"
}
```

**성공 응답 (200)**

```json
{
  "ok": true,
  "requestId": "uuid-v4",
  "data": {
    "accessToken": "<JWT>",
    "expiresIn": 3600,
    "user": {
      "id": 1,
      "username": "google_117123456789012345678",
      "email": "user@example.com"
    }
  }
}
```

---

## 에러 응답 형식

```json
{
  "ok": false,
  "requestId": "uuid-v4",
  "errorCode": "AUTH_GOOGLE_TOKEN_EXPIRED",
  "message": "Token has expired.",
  "details": { /* 선택적 */ }
}
```

### 에러 코드

| 코드 | HTTP | 설명 |
|------|------|------|
| `AUTH_GOOGLE_BAD_REQUEST` | 400 | 잘못된 입력 (예: idToken과 code를 동시에 전송) |
| `AUTH_GOOGLE_INVALID_AUDIENCE` | 401 | 토큰 `aud`가 허용된 audience 목록에 없음 |
| `AUTH_GOOGLE_INVALID_ISSUER` | 401 | 토큰 `iss`가 허용된 발급자 목록에 없음 |
| `AUTH_GOOGLE_TOKEN_EXPIRED` | 401 | 토큰 만료 (`exp` 검사 실패) |
| `AUTH_GOOGLE_MISSING_SUB` | 401 | 토큰에 `sub` 클레임이 없음 |
| `AUTH_GOOGLE_NONCE_MISMATCH` | 401 | 토큰의 nonce가 제공된 nonce와 불일치 |
| `AUTH_GOOGLE_STATE_MISMATCH` | 401 | state 파라미터 불일치 (CSRF 가능성) |
| `AUTH_GOOGLE_EXCHANGE_FAILED` | 401 | Google 인증 코드 교환 실패 |
| `AUTH_GOOGLE_INTERNAL_ERROR` | 500 | 예기치 않은 서버 오류 |

---

## 환경 변수

| 변수명 | 필수 | 기본값 | 설명 |
|--------|------|--------|------|
| `GOOGLE_ALLOWED_AUDIENCES` | ✅ | — | 허용된 `aud` 값 목록 (쉼표 구분, OAuth 클라이언트 ID) |
| `GOOGLE_ALLOWED_ISSUERS` | ❌ | `accounts.google.com,https://accounts.google.com` | 허용된 발급자 목록 (쉼표 구분) |
| `GOOGLE_CLOCK_SKEW_SECONDS` | ❌ | `60` | 향후 클럭 편차 허용 설정용 예약 변수 |
| `GOOGLE_OAUTH_CLIENT_ID` | ✅ (코드 플로우) | — | OAuth 2.0 클라이언트 ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | ✅ (코드 플로우) | — | OAuth 2.0 클라이언트 시크릿 |
| `GOOGLE_OAUTH_REDIRECT_URIS` | ✅ (코드 플로우) | — | 허용된 리다이렉트 URI 목록 (쉼표 구분) |

---

## 아키텍처 (클린 / 헥사고날)

```
인터페이스 레이어   src/auth/google/interface/
  AuthGoogleController        ← HTTP 어댑터; DTO → 유스케이스 매핑; 에러 처리

애플리케이션 레이어 src/auth/google/application/
  use-cases/                  ← 오케스트레이션; Port에만 의존
    VerifyGoogleIdTokenUseCase
    ExchangeGoogleAuthCodeUseCase
    UpsertSocialUserUseCase
    IssueSessionTokenUseCase
    GoogleLoginUseCase
  ports/                      ← 인터페이스 (구현 세부사항 없음)
    GoogleTokenVerifierPort
    GoogleAuthCodeExchangerPort
    SocialUserRepositoryPort
    SessionIssuerPort
    RequestIdProviderPort

도메인 레이어       src/auth/google/domain/
  SocialIdentity              ← 순수 타입 (프레임워크 의존성 없음)
  GoogleAuthError / GoogleAuthErrorCode ← 안정적인 에러 열거형

인프라스트럭처 레이어 src/auth/google/infrastructure/
  GoogleOAuthClientAdapter    ← google-auth-library를 통해 TokenVerifier + CodeExchanger 구현
  SocialUserTypeOrmAdapter    ← TypeORM/UsersService를 통해 SocialUserRepositoryPort 구현
  SessionIssuerJwtAdapter     ← @nestjs/jwt를 통해 SessionIssuerPort 구현
  RequestIdAdapter            ← uuid를 통해 RequestIdProviderPort 구현
```

---

## 보안 주의사항

1. **하드코딩된 시크릿 없음** – 모든 설정은 환경 변수를 통해 관리합니다.
2. **토큰 로깅 금지** – 원본 토큰은 절대 로그에 기록하지 않습니다.
3. **요청 ID 추적** – `x-request-id` 헤더가 모든 응답에 포함됩니다.
4. **Audience 검증** – `GOOGLE_ALLOWED_AUDIENCES`를 통해 강제 적용됩니다.
5. **발급자 검증** – Google의 공식 발급자만 허용됩니다.
6. **Nonce** – GIS와 함께 사용 시 재전송 공격 방지를 위해 검증합니다.
7. **State + PKCE** – 인증 코드 플로우에서 권장; state 불일치 시 `AUTH_GOOGLE_STATE_MISMATCH` 오류 발생.

---

## 테스트 실행

```bash
# Google 관련 유닛 테스트만 실행
npx jest src/auth/google

# 전체 테스트
npm test
```

---

## 마이그레이션 안내

`users` 테이블에 두 개의 nullable 컬럼이 추가되고, `password` 컬럼이 nullable로 변경됩니다:

| 컬럼 | 타입 | 제약조건 |
|------|------|---------|
| `provider` | varchar | nullable |
| `googleId` | varchar | nullable, unique |
| `password` | varchar | **nullable**로 변경 (소셜 사용자는 비밀번호 없음) |

`DB_SYNCHRONIZE=true` 설정 시 (개발 환경) TypeORM이 자동으로 적용합니다.  
프로덕션에서는 마이그레이션을 생성하여 실행하세요:

```bash
npx typeorm migration:generate -n AddGoogleSocialLogin
npx typeorm migration:run
```
