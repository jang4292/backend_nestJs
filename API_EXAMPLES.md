# API Usage Examples

> Last updated: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`.
> The complete route and permission table is in
> [docs/product/api-spec.kr.md](docs/product/api-spec.kr.md).

## Prerequisites

1. Create `.env` from the template and type in the DB connection values,
   including `DB_PASSWORD` (the file is git-ignored):
   ```bash
   cp .env.example .env && chmod 600 .env
   ```
   ```env
   NODE_ENV=development
   DB_HOST=<dev-db-host>
   DB_PORT=<port>
   DB_USERNAME=<dev-user>
   DB_PASSWORD=<type it here>
   DB_DATABASE=app_db_dev   # a database dedicated to this app
   JWT_SECRET=a-local-secret-of-at-least-32-characters
   CORS_ORIGIN=http://localhost:3001
   # SNS providers stay disabled (AUTH_*_ENABLED=false); their routes return 503.
   ```
2. Check the connection, then create the database and tables:
   ```bash
   npm ci
   npm run db:check   # read-only: connection, privileges, pending migrations
   npm run db:setup   # creates app_db_dev if missing, then applies migrations
   ```
3. Start the server:
   ```bash
   npm run start:dev
   ```
4. For admin-only examples, promote a user after registering it:
   `UPDATE users SET role = 'admin' WHERE username = '<username>';`

See [docs/deployment/database-environments.kr.md](docs/deployment/database-environments.kr.md)
for Test and Prod.

Access levels used below:

- **public**: no token
- **JWT**: `Authorization: Bearer <token>`
- **admin**: JWT of a user whose `role` is `admin`

Grant admin access in the database:

```sql
UPDATE users SET role = 'admin' WHERE username = 'johndoe';
```

## 1. Health Check (public)

```bash
curl -i http://localhost:3000/health
```

```json
{ "status": "ok", "timestamp": "2026-11-08T10:00:00.000Z", "database": "up" }
```

When the database is unreachable the endpoint returns **503** with
`"status": "degraded", "database": "down"`. It is excluded from rate limiting.

## 2. Register (public)

```bash
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "SecurePass123",
    "email": "john@example.com",
    "name": "John Doe"
  }'
```

```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "name": "John Doe",
  "role": "user",
  "providers": [],
  "createdAt": "2026-11-08T10:00:00.000Z",
  "updatedAt": "2026-11-08T10:00:00.000Z"
}
```

Rules:

- `username` must be at least 4 characters and `password` at least 6.
- Usernames starting with `google_`, `apple_`, `kakao_`, `naver_` or
  `facebook_` are reserved for SNS accounts and return 400.
- A duplicate username or email returns 409.

## 3. Login (public)

`identifierType` is `username` or `email`.

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifierType": "username",
    "identifier": "johndoe",
    "password": "SecurePass123"
  }'
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "user",
    "providers": [],
    "createdAt": "2026-11-08T10:00:00.000Z",
    "updatedAt": "2026-11-08T10:00:00.000Z"
  }
}
```

- Wrong credentials, an unknown account, and an SNS-only account (no password)
  all return the same 401 `Invalid credentials`.
- The endpoint allows 5 requests per minute per client IP.

## 4. Profile (JWT)

```bash
curl http://localhost:3000/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

`providers` lists linked SNS accounts, for example `["google", "kakao"]`.

### Update name or email

```bash
curl -X PATCH http://localhost:3000/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{ "email": "newemail@example.com", "name": "John Smith" }'
```

An email that already belongs to another account returns 409.

### Change password

`currentPassword` is required when the account already has a password:

```bash
curl -X PATCH http://localhost:3000/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{ "currentPassword": "SecurePass123", "password": "NewSecurePass456" }'
```

| Case | Response |
| --- | --- |
| `currentPassword` missing | 400 |
| `currentPassword` wrong | 403 |
| SNS-only account without a password | First password can be set without `currentPassword` |

Existing tokens stay valid until they expire.

## 5. Social Login (public)

> **All SNS providers are currently disabled.** Only local login is used, and
> every `/auth/<provider>/*` route returns 503 `AUTH_<PROVIDER>_DISABLED`. A
> provider is enabled only with `AUTH_<PROVIDER>_ENABLED=true`, after completing
> [docs/auth/sns-reenable-checklist.kr.md](docs/auth/sns-reenable-checklist.kr.md).
> The examples below apply once a provider is enabled.

All SNS responses use the request-id envelope:

```json
{
  "ok": true,
  "requestId": "6f1c…",
  "data": {
    "accessToken": "jwt_token_here",
    "expiresIn": 3600,
    "user": { "id": 2, "username": "google_117123456789", "email": "user@example.com" }
  }
}
```

```bash
# Google / Apple: ID token (or {"code", "redirectUri"} for the code flow)
curl -X POST http://localhost:3000/auth/google/login \
  -H "Content-Type: application/json" \
  -d '{"idToken":"GOOGLE_ID_TOKEN"}'

# Kakao / Naver / Facebook: provider access token (or {"code", "redirectUri"})
curl -X POST http://localhost:3000/auth/kakao/login \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"KAKAO_ACCESS_TOKEN"}'
```

How each provider token is verified:

| Provider | Check |
| --- | --- |
| Google, Apple | ID token `aud` |
| Facebook | `debug_token` `app_id` |
| Kakao | `access_token_info` `app_id` against `KAKAO_APP_ID`; a token from another app returns 401 `AUTH_KAKAO_INVALID_TOKEN` |
| Naver | Cannot be verified, so `accessToken` login is rejected (400) unless `AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED=true`; use the code flow |

Other endpoints:

- Every provider exposes `POST /auth/{provider}/exchange-code`.
- Google and Apple also expose `POST /auth/{provider}/verify-id-token`.
- A disabled provider (`AUTH_<PROVIDER>_ENABLED=false`) returns 503
  `AUTH_<PROVIDER>_DISABLED` without calling the provider.

Details are in the [SNS login overview](docs/auth/sns-login-overview.kr.md).

## 6. Catalog Tracks and Audio Assets

```bash
# public: newest first, page/limit (limit <= 100)
curl 'http://localhost:3000/music/tracks?page=1&limit=20'
curl http://localhost:3000/music/tracks/1

# admin
curl -X POST http://localhost:3000/music/tracks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -d '{ "title": "Song A", "artist": "Artist X", "bpm": 120 }'

curl -X POST http://localhost:3000/music/tracks/1/audio-assets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -d '{ "url": "https://media.example.com/song-a.mp3", "duration": 210, "bpm": 121 }'
```

- `Track.bpm` is the catalog value. `AudioAsset.bpm` is file or analysis
  metadata and is not synchronised with it.
- A regular user token on a write route returns 403.
- Deleting a track that is used in a playlist returns 409
  `FOREIGN_KEY_CONSTRAINT`.

## 7. Public Catalog Playlists (public)

Only `published` playlists are visible:

```bash
curl 'http://localhost:3000/music/public/playlists?page=1&limit=20'
curl http://localhost:3000/music/public/playlists/1
```

The detail response contains playlist metadata, track summaries and each item's
`position`. It never includes `audio_asset.url`, S3 object keys or playback
tokens.

## 8. Manage Catalog Playlists (admin)

```bash
curl -X POST http://localhost:3000/music/playlists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -d '{ "title": "Evening Set", "description": "A public catalog playlist", "anonymousPlayable": false }'

curl -X POST http://localhost:3000/music/playlists/1/tracks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -d '{"trackId":1,"position":1,"note":"Opening track"}'

curl -X PATCH http://localhost:3000/music/playlists/1/publish \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"

curl -X PATCH http://localhost:3000/music/playlists/1/tracks/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -d '{"items":[{"id":2,"position":1},{"id":1,"position":2}]}'
```

- The reorder request must include every existing item exactly once.
- `(playlistId, position)` is unique, so an occupied position returns 400.

## 9. Legacy Music API (`/music/legacy`)

Access:

- `GET /music/legacy/tracks` and `GET /music/legacy/tracks/:id` are public.
- Other reads require a JWT.
- All writes are admin-only.

```bash
curl 'http://localhost:3000/music/legacy/tracks?search=song&page=1&limit=20'

curl http://localhost:3000/music/legacy/artists \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

curl 'http://localhost:3000/music/legacy/playlists/by-date?date=2026-01-01' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

curl -X POST http://localhost:3000/music/legacy/artists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -d '{"name":"Artist X"}'

curl -X POST http://localhost:3000/music/legacy/playlists/1/tracks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -d '{ "trackId": 1, "seq": 1, "note": "Opening track" }'
```

- `by-date` requires `date=YYYY-MM-DD`; without it the endpoint returns 400.
- Deleting an artist that still has tracks returns 409 `FOREIGN_KEY_CONSTRAINT`.

## 10. Error Responses

Every error uses the same envelope, and the `x-request-id` response header
matches `requestId`:

```json
{
  "ok": false,
  "requestId": "6f1c…",
  "errorCode": "BAD_REQUEST",
  "message": "username must be longer than or equal to 4 characters, password must be longer than or equal to 6 characters"
}
```

| HTTP | `errorCode` | Example |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Validation failure, reserved username, missing `currentPassword` |
| 401 | `UNAUTHORIZED` | Missing, expired or tampered token; invalid credentials |
| 403 | `FORBIDDEN` | Not an admin; wrong `currentPassword` |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT`, `FOREIGN_KEY_CONSTRAINT` | Duplicate username/email; resource still referenced |
| 429 | `RATE_LIMITED` | Too many requests |
| 503 | `AUTH_<PROVIDER>_DISABLED` | SNS provider disabled |
| 500 | `INTERNAL_SERVER_ERROR` / `AUTH_<PROVIDER>_INTERNAL_ERROR` | Message is always `Internal server error`; details are logged server-side |

SNS routes use `AUTH_<PROVIDER>_<REASON>` codes, for example
`AUTH_KAKAO_EXCHANGE_FAILED`.

## 11. JavaScript Example

```typescript
const base = 'http://localhost:3000';

await fetch(`${base}/users/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'testuser', password: 'password123' }),
});

const loginResponse = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifierType: 'username',
    identifier: 'testuser',
    password: 'password123',
  }),
});
const { access_token } = await loginResponse.json();

const profile = await fetch(`${base}/users/profile`, {
  headers: { Authorization: `Bearer ${access_token}` },
}).then((res) => res.json());
```

## 12. Security Notes

1. Use HTTPS in production. Set `TRUST_PROXY` when TLS terminates at a proxy.
2. Never commit `.env` files; only `*.example` files are tracked.
3. `JWT_SECRET` must be at least 32 characters in production. Placeholder text
   is rejected at startup.
4. Set `CORS_ORIGIN` to explicit origins; `*` is rejected.
5. Do not log raw provider tokens, JWTs or passwords. The exception filters
   redact them.

## 13. Production Deployment Checklist

Follow [docs/deployment/mariadb-systemd.kr.md](docs/deployment/mariadb-systemd.kr.md).
In short:

1. Back up the database.
2. Set `NODE_ENV=production`, a 32+ character `JWT_SECRET`, `CORS_ORIGIN`,
   `TRUST_PROXY` (behind a proxy), and the enabled providers' settings
   (`KAKAO_APP_ID`, `APPLE_ALLOWED_AUDIENCES`, ...).
3. Run `npm run build`, then `npm run env:check:prod`, `npm run migration:show:prod`
   and `npm run migration:run:prod`.
4. Grant the admin role.
5. Run `npm run pm2:reload`, then check `curl -fsS /health`.
