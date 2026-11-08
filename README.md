# NestJS Backend API

> Last updated: 2026-11-08 · develop `9b731ef` + `chore/project-audit-2026-11` ·
> Documentation index: [docs/README.md](docs/README.md)

A NestJS backend for local and social authentication, user profiles, and music
catalog and playlist APIs. The project uses MariaDB with TypeORM, strict
environment validation, global request validation, and security-focused
runtime defaults.

## Features

- Local user registration and JWT login
- Social login for Google, Apple, Facebook, Kakao, and Naver
- Google and Apple ID-token verification plus authorization-code exchange flows
- Authorization-code exchange and access-token login flows for Facebook, Kakao,
  and Naver
- Protected user profile read/update endpoints (password change requires `currentPassword`)
- Music catalog (tracks, audio assets, playlists) and legacy music APIs
- Minimal RBAC: music write APIs are admin-only (`users.role`)
- MariaDB + TypeORM integration
- Environment validation for unsafe production settings
- Helmet, CORS allow-listing, throttling, and DTO validation
- Unit and integration coverage for auth, config, users, and music; GitHub Actions CI

## Installation

Use Node.js 24 (`.nvmrc`; `engines` requires >= 22.13).

```bash
npm ci
```

## Configuration

Copy `.env.example` to an ignored local file and update the values:

```bash
cp .env.example .env
```

Required operational settings:

```env
PORT=3000
NODE_ENV=development

DB_TYPE=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=replace-with-local-db-user
DB_PASSWORD=replace-with-local-db-password
DB_DATABASE=nestjs_db
DB_SYNCHRONIZE=false
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
# Optional compatibility alternative. DATABASE_URL takes precedence over DB_*.
# DATABASE_URL=mariadb://username:password@hostname:3306/database

JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRES_IN=1h

THROTTLE_TTL=60
THROTTLE_LIMIT=10
# Comma-separated list; "*" is rejected.
CORS_ORIGIN=http://localhost:3001
# Set to the proxy hop count (e.g. 1) when running behind nginx/ALB.
# TRUST_PROXY=1

GOOGLE_ALLOWED_AUDIENCES=your-google-client-id.apps.googleusercontent.com
GOOGLE_ALLOWED_ISSUERS=accounts.google.com,https://accounts.google.com
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URIS=https://your-app.example.com/auth/google/callback
```

`DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `JWT_SECRET`, and
`GOOGLE_ALLOWED_AUDIENCES` are required at startup. The current MariaDB server
has TLS disabled, so use `DB_SSL=false`. Re-check `have_ssl` and
`require_secure_transport` before exposing the database outside its current
network.
`NODE_ENV=production` also requires `CORS_ORIGIN`, requires a `JWT_SECRET` of
at least 32 characters without placeholder text (`replace-with`, `change-this`,
`your-`), requires `KAKAO_APP_ID` when Kakao is enabled, and blocks
`DB_SYNCHRONIZE=true`. In every environment `JWT_EXPIRES_IN` must look like
`3600`, `30m`, `1h` or `7d`, and enabling Apple requires
`APPLE_ALLOWED_AUDIENCES`. For a remote MariaDB instance, use
its hostname as `DB_HOST`. Enable `DB_SSL=true` only after the server TLS
configuration and CA certificate are ready. Keep real endpoints, usernames,
database names, and secret values in ignored environment files or the EC2
environment.

```env
NODE_ENV=development
DB_HOST=<mariadb-host>
DB_PORT=3306
DB_USERNAME=<db-user>
DB_PASSWORD=<local-only-password-or-exported-secret>
DB_DATABASE=<db-name>
DB_SYNCHRONIZE=false
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
DB_CONNECT_TIMEOUT_MS=5000
```

The application supports `DB_TYPE=mariadb` only. PostgreSQL is not a supported
runtime database. Run migrations against the target MariaDB database before
starting a shared or production instance.

## Running

```bash
npm run start
npm run start:dev
npm run start:prod
```

Apply the database schema before starting the application in a shared or
production environment:

```bash
npm run migration:show
npm run migration:run
```

The environment files have four clear roles:

- `.env`: actual local development settings (ignored by git)
- `.env.example`: development settings template (tracked)
- `.env.test.local`: actual local E2E settings (ignored by git)
- `.env.test.example`: E2E settings template (tracked)

Do not create or use `.env.local`; it is not part of the supported configuration.

## API Documentation

Swagger is available at `http://localhost:3000/api-docs` in development and
test environments. It is disabled in production. Complete curl examples are
in [API_EXAMPLES.md](API_EXAMPLES.md).

`npm run test:e2e` boots `AppModule` and needs a reachable MariaDB database.
Without local or remote MariaDB access, unit tests and build can still pass
while e2e fails at DB connection time.

## Secrets Manager and PM2

The app itself reads only environment variables. On EC2, fetch Secrets Manager
values immediately before migrations and PM2 reloads:

```bash
git pull --ff-only
npm ci
npm run build
eval "$(AWS_SECRET_ID=<secret-id> AWS_REGION=ap-northeast-2 npm run -s secrets:export)"
npm run migration:run
npm run pm2:reload
curl -fsS http://localhost:${PORT:-3000}/health   # 503 when the DB is down
```

After applying `1765000000000-AddRoleToUsers`, grant admin access manually:
`UPDATE users SET role = 'admin' WHERE username = '<admin-username>';`
See the [EC2 deployment guide](docs/deployment/mariadb-systemd.kr.md) for the
full checklist and rollback notes.

`scripts/export-secrets-env.cjs` and `ecosystem.config.cjs` share one key list,
`scripts/runtime-env-keys.cjs`; add new variables there as well as in
`src/config/app-env.ts` (a spec fails when they drift). The export script
accepts these Secrets Manager `SecretString` shapes:

- Env-key JSON: `{"DB_PASSWORD":"...","JWT_SECRET":"..."}`
- MariaDB managed JSON: `{"username":"...","password":"...","host":"...","port":3306,"dbname":"..."}`
- Password-only string: the whole secret becomes `DB_PASSWORD`

The helper prints shell `export` statements for allow-listed app variables only.
It does not print diagnostic logs with secret values.

## E2E Database

E2E tests require a separate MariaDB database and account. Copy
`.env.test.example` to `.env.test.local`, enter the test credentials, and use
the database currently granted to the test account. The current temporary
setting is `DB_DATABASE=app_db`; change it to a dedicated `app_db_test` after
that database and its permissions are provisioned.

```bash
cp .env.test.example .env.test.local
npm run test:e2e
```

Run test-database migrations with `NODE_ENV=test`. In Windows PowerShell:

```powershell
$env:NODE_ENV='test'; npm run migration:run
```

## Troubleshooting Guide

로컬 환경 파일, MariaDB 연결, TypeORM 메타데이터, Jest ESM 오류의 발생 및 수정 이력은
[로컬 실행 오류 및 수정 이력](docs/learning/runtime-troubleshooting-history.kr.md)을 참고하세요.

## Endpoints

The full route table with authorization levels is in
[docs/product/api-spec.kr.md](docs/product/api-spec.kr.md) (55 routes).

| Area | Routes | Access |
| --- | --- | --- |
| System | `GET /`, `GET /health` | public |
| Accounts | `POST /users/register`, `POST /auth/login` | public |
| Profile | `GET/PATCH /users/profile` | JWT |
| SNS login | `POST /auth/{google,apple,kakao,naver,facebook}/{login,exchange-code}`, `POST /auth/{google,apple}/verify-id-token` | public (503 when the provider is disabled) |
| Catalog reads | `GET /music/tracks`, `GET /music/tracks/:id`, `GET /music/public/playlists(/:id)` | public |
| Catalog writes | tracks, audio assets, playlists (create/update/delete/publish/reorder), `GET /music/tracks/:trackId/audio-assets` | **admin** |
| Legacy reads | `GET /music/legacy/tracks(/:id)` public; artists, playlists, `tracks/full` | JWT |
| Legacy writes | `POST/PATCH/DELETE /music/legacy/**` | **admin** |

Public responses never include audio URLs or internal storage identifiers. See
the [Music learning guide](docs/music/learning-guide.kr.md) for the request flow.

## Project Structure

```text
src/
  main.ts        bootstrap: helmet, CORS, trust proxy, validation, shutdown hooks
  app.module.ts  module wiring, global interceptor/filter/guards
  config/        environment validation (AppEnv) and duration parsing
  database/      TypeORM options, CLI data source, MariaDB error helpers, migrations
  common/        DomainError, global exception filter, request id, response envelope
  auth/          session (JWT, RBAC), local login, shared SNS kernel, 5 providers
  users/         domain, use-cases, ports/adapters, controller, presenters
  music/         legacy (/music/legacy) and catalog (/music) modules
```

Architecture walkthrough: [docs/learning/nestjs-operational-stability-guide.kr.md](docs/learning/nestjs-operational-stability-guide.kr.md).
Latest audit and roadmap: [docs/audit/2026-11-08-project-audit.kr.md](docs/audit/2026-11-08-project-audit.kr.md).

## Verification

```bash
npm run lint:check
npm run format:check
npm run typecheck
npx jest
npm run build
```

CI (`.github/workflows/ci.yml`) runs the same steps plus a critical production
`npm audit` on every pull request and push to `develop` and `main`.

## Production Notes

- Keep `DB_SYNCHRONIZE=false`; use TypeORM migrations for shared databases.
- Run migrations as a release/deployment step before deploying the application.
- Do not run the initial migration against an existing MariaDB database until its
  current schema has been compared and backed up.
- Use a strong `JWT_SECRET` (32+ characters) and rotate it according to your security policy.
- Set `CORS_ORIGIN` to the real frontend origin(s), never `*`.
- Set `TRUST_PROXY` when running behind a reverse proxy so rate limits apply per client.
- Keep at least one admin account; music write APIs return 403 for regular users.
- Configure `GOOGLE_ALLOWED_AUDIENCES` with the exact OAuth client IDs.
- Avoid logging raw Google tokens, JWTs, or passwords.
