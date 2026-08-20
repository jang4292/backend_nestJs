# Google SNS Login – Implementation Guide (English)

## Overview

This document describes the Google Social Login (server-side verification) feature added to the NestJS backend.

---

## Channel × Flow Matrix

| Channel | Flow | Endpoint | Notes |
|---------|------|----------|-------|
| Web (GIS `credential`) | ID token | `POST /auth/google/verify-id-token` or `POST /auth/google/login` (idToken) | Google Identity Services returns a JWT |
| Native (Android / iOS) | Auth-code + PKCE | `POST /auth/google/exchange-code` then `POST /auth/google/login` (code) | Server exchanges code; PKCE codeVerifier recommended |
| QA / Testing | ID token only | `POST /auth/google/verify-id-token` | No relaxation of aud/iss rules |

### Policy

- `/auth/google/login` accepts **exactly one** of `idToken` or `code`.
- If neither or both are provided → `400 AUTH_GOOGLE_BAD_REQUEST`.

---

## Endpoints

### `POST /auth/google/verify-id-token`

Verify a Google ID token and return the decoded social identity.

**Request Body**

```json
{
  "idToken": "<Google ID token>",
  "nonce": "<optional nonce>"
}
```

**Success Response (200)**

```json
{
  "ok": true,
  "requestId": "request-id",
  "data": {
    "provider": "google",
    "sub": "117123456789012345678",
    "email": "user@example.com",
    "emailVerified": true,
    "name": "Jane Doe",
    "picture": "https://..."
  }
}
```

---

### `POST /auth/google/exchange-code`

Exchange a Google authorization code for tokens (Native / auth-code flow).

**Request Body**

```json
{
  "code": "<authorization code>",
  "redirectUri": "https://your-app.example.com/callback",
  "codeVerifier": "<PKCE code_verifier – recommended>",
  "state": "<received state>",
  "expectedState": "<original state stored by client>"
}
```

**Success Response (200)**

```json
{
  "ok": true,
  "requestId": "request-id",
  "data": {
    "idToken": "<Google ID token>",
    "accessToken": "<access token>",
    "refreshToken": "<refresh token>",
    "expiresIn": 3600
  }
}
```

---

### `POST /auth/google/login`

Full login flow: verify identity → upsert user → issue JWT session.

**Request Body (idToken flow)**

```json
{
  "idToken": "<Google ID token>",
  "nonce": "<optional nonce>"
}
```

**Request Body (auth-code flow)**

```json
{
  "code": "<authorization code>",
  "redirectUri": "https://your-app.example.com/callback",
  "codeVerifier": "<PKCE code_verifier>",
  "state": "<received state>",
  "expectedState": "<original state>"
}
```

**Success Response (200)**

```json
{
  "ok": true,
  "requestId": "request-id",
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

## Error Response Contract

```json
{
  "ok": false,
  "requestId": "request-id",
  "errorCode": "AUTH_GOOGLE_TOKEN_EXPIRED",
  "message": "Token has expired.",
  "details": { /* optional */ }
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_GOOGLE_BAD_REQUEST` | 400 | Missing/conflicting input (e.g., both idToken and code) |
| `AUTH_GOOGLE_INVALID_AUDIENCE` | 401 | Token `aud` does not match allowed audiences |
| `AUTH_GOOGLE_INVALID_ISSUER` | 401 | Token `iss` is not in the allowed issuers list |
| `AUTH_GOOGLE_TOKEN_EXPIRED` | 401 | Token has expired (`exp` check failed) |
| `AUTH_GOOGLE_MISSING_SUB` | 401 | Token is missing the `sub` claim |
| `AUTH_GOOGLE_NONCE_MISMATCH` | 401 | Nonce in token does not match provided nonce |
| `AUTH_GOOGLE_STATE_MISMATCH` | 401 | State parameter mismatch (possible CSRF) |
| `AUTH_GOOGLE_EXCHANGE_FAILED` | 401 | Authorization code exchange with Google failed |
| `AUTH_GOOGLE_INTERNAL_ERROR` | 500 | Unexpected server-side error |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_ALLOWED_AUDIENCES` | ✅ | — | Comma-separated list of allowed `aud` values (your OAuth client IDs) |
| `GOOGLE_ALLOWED_ISSUERS` | ❌ | `accounts.google.com,https://accounts.google.com` | Comma-separated allowed issuers |
| `GOOGLE_OAUTH_CLIENT_ID` | ✅ (code flow) | — | OAuth 2.0 Client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | ✅ (code flow) | — | OAuth 2.0 Client Secret |
| `GOOGLE_OAUTH_REDIRECT_URIS` | ✅ (code flow) | — | Comma-separated allowed redirect URIs |

---

## Architecture (Clean / Hexagonal)

```
Interface Layer       src/auth/google/interface/
  AuthGoogleController        ← HTTP adapter; maps DTOs → use-cases
  GoogleAuthExceptionFilter   ← Maps GoogleAuthError → HTTP envelope responses

Application Layer     src/auth/google/application/
  use-cases/                  ← Orchestration; depend on Ports only
    VerifyGoogleIdTokenUseCase
    ExchangeGoogleAuthCodeUseCase
    UpsertSocialUserUseCase
    IssueSessionTokenUseCase
    GoogleLoginUseCase
  ports/                      ← Interfaces (no implementation details)
    GoogleTokenVerifierPort
    GoogleAuthCodeExchangerPort
    SocialUserRepositoryPort
    SessionIssuerPort

Domain Layer          src/auth/google/domain/
  SocialIdentity              ← Pure type (no framework deps)
  GoogleAuthError / GoogleAuthErrorCode ← Stable error enum

Infrastructure Layer  src/auth/google/infrastructure/
  GoogleOAuthClientAdapter    ← Implements TokenVerifier + CodeExchanger via google-auth-library
  SocialUserTypeOrmAdapter    ← Implements SocialUserRepositoryPort via TypeORM/UsersService
  SessionIssuerJwtAdapter     ← Implements SessionIssuerPort via @nestjs/jwt

Common Layer          src/common/
  RequestIdInterceptor        ← Resolves/echoes x-request-id for Google responses
  RequestIdService            ← Generates request IDs via crypto.randomUUID()
```

---

## Security Notes

1. **No hardcoded secrets** – all configuration via environment variables.
2. **Token logging** – raw tokens are never logged.
3. **Request ID tracing** – `x-request-id` header is echoed/generated for all responses.
4. **Audience validation** – enforced via `GOOGLE_ALLOWED_AUDIENCES`.
5. **Issuer validation** – enforced; only Google's known issuers are accepted.
6. **Nonce** – optional replay-attack prevention; validate when used with GIS.
7. **State + PKCE** – recommended for auth-code flow; state mismatch throws `AUTH_GOOGLE_STATE_MISMATCH`.

---

## Running Tests

```bash
# Unit tests only (all use-cases)
npx jest src/auth/google

# All tests
npm test
```

---

## Migration Notes

The `users` table gains two new nullable columns:

| Column | Type | Constraint |
|--------|------|------------|
| `provider` | varchar | nullable |
| `googleId` | varchar | nullable, unique |
| `password` | varchar | now **nullable** (social users have no password) |

Keep `DB_SYNCHRONIZE=false` for shared and production databases. Generate and
run a TypeORM migration for schema changes:

```bash
npm run migration:generate -- src/database/migrations/AddGoogleSocialLogin
npm run migration:run
```
