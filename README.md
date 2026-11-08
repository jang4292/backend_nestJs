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

Copy the template for your environment and fill in the values (see
[Environment files](#environment-files) below):

```bash
cp .env.example .env                        # Dev (external dev DB)
cp .env.test.example .env.test.local        # Test (app_db_test)
cp .env.production.example .env.production  # Prod, on the EC2 server only
```

Always required: `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `JWT_SECRET`.

`NODE_ENV=production` also requires:

- `CORS_ORIGIN`: origins, or `none` to disable CORS
- a `JWT_SECRET` of at least 32 characters without placeholder text
  (`replace-with`, `change-this`, `your-`)
- `DB_SYNCHRONIZE=false`

In every environment:

- `JWT_EXPIRES_IN` must look like `3600`, `30m`, `1h` or `7d`.
- `NODE_ENV=test` only accepts `*_test` databases.
- SNS providers stay off unless `AUTH_<PROVIDER>_ENABLED=true`; an enabled
  provider requires its own keys (for example `GOOGLE_ALLOWED_AUDIENCES`,
  `APPLE_ALLOWED_AUDIENCES`, `KAKAO_APP_ID` in production).

The dev MariaDB server has TLS disabled (`DB_SSL=false`). Restrict port 3306 to
developer IPs, or use an SSH tunnel. The application supports `DB_TYPE=mariadb`
only.

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

### Environment files

Each environment is configured by one env file, chosen by `NODE_ENV`
(`src/config/env-files.ts`). The app, the migration CLI and e2e all use the same
rule. Exported shell variables take precedence over file values, and
`ENV_FILE=<path>` overrides the file choice.

| Environment | `NODE_ENV` | File (ignored by git) | Template | Database |
| --- | --- | --- | --- | --- |
| Dev | `development` (default) | `.env` | `.env.example` | external dev server, `app_db` |
| Test | `test` | `.env.test.local` (required) | `.env.test.example` | dev server, `*_test` only (e.g. `app_db_test`) |
| Prod | `production` | `.env.production` | `.env.production.example` | EC2 localhost MariaDB |

| Task | Dev | Test | Prod (EC2, after `npm run build`) |
| --- | --- | --- | --- |
| Validate config (no DB connection) | `npm run env:check` | `npm run env:check:test` | `npm run env:check:prod` |
| Migration status | `npm run migration:show` | `npm run migration:show:test` | `npm run migration:show:prod` |
| Apply migrations | `npm run migration:run` | `npm run migration:run:test` | `npm run migration:run:prod` |
| Run | `npm run start:dev` | `npm run test:e2e` | `npm run pm2:reload` |

- `env:check` requires `npm run build` first.
- Prod migrations run from `dist` with plain `node`; ts-node is not needed on the server.
- Full guide, including test/prod DB account SQL:
  [docs/deployment/database-environments.kr.md](docs/deployment/database-environments.kr.md).

SNS logins are opt-in and currently all disabled (`AUTH_<PROVIDER>_ENABLED=false`);
only local login is used. Disabled providers need no settings and return 503.
See [docs/auth/sns-reenable-checklist.kr.md](docs/auth/sns-reenable-checklist.kr.md)
before enabling one.

## API Documentation

Swagger is available at `http://localhost:3000/api-docs` in development and
test environments. It is disabled in production. Complete curl examples are
in [API_EXAMPLES.md](API_EXAMPLES.md).

`npm run test:e2e` boots `AppModule` and needs a reachable MariaDB database.
Without local or remote MariaDB access, unit tests and build can still pass
while e2e fails at DB connection time.

## Production on EC2 (PM2)

```bash
git pull --ff-only
npm ci
npm run build
npm run env:check:prod         # validates .env.production without touching the DB
npm run migration:run:prod
npm run pm2:reload             # ecosystem.config.cjs pins cwd and NODE_ENV=production
curl -fsS http://localhost:${PORT:-3000}/health   # 503 when the DB is down
```

After applying `1765000000000-AddRoleToUsers`, grant admin access manually:
`UPDATE users SET role = 'admin' WHERE username = '<admin-username>';`
See the [EC2 deployment guide](docs/deployment/mariadb-systemd.kr.md) for the
full checklist and rollback notes.

Optional: AWS Secrets Manager values can be exported into the shell before
`migration:run:prod` and `pm2:reload`
(`eval "$(AWS_SECRET_ID=<secret-id> AWS_REGION=ap-northeast-2 npm run -s secrets:export)"`).
Exported values override `.env.production`. `scripts/export-secrets-env.cjs`
and `ecosystem.config.cjs` share one key list, `scripts/runtime-env-keys.cjs`;
add new variables there as well as in `src/config/app-env.ts` (a spec fails
when they drift).

## E2E Database

E2E tests use a dedicated `*_test` database on the dev server (for example
`app_db_test`); `NODE_ENV=test` refuses any other database name. The SQL for the
test database and account is in
[docs/deployment/database-environments.kr.md](docs/deployment/database-environments.kr.md).

```bash
cp .env.test.example .env.test.local
npm run migration:run:test
npm run test:e2e
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
