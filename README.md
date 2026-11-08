# NestJS Backend API

> Last updated: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11` ·
> Documentation index (Korean): [docs/README.md](docs/README.md)

A NestJS 11 backend that provides local JWT authentication, user profiles, and
music catalog and playlist APIs. It runs on MariaDB through TypeORM. Settings
are validated at startup, and the schema changes only through versioned
migrations.

## Features

- Local registration and JWT login (HS256). A password change requires
  `currentPassword`.
- Minimal RBAC: music write APIs are admin-only (`users.role`).
- Music catalog (tracks, audio assets, playlists) and legacy music APIs.
- Social login modules for Google, Apple, Kakao, Naver and Facebook.
  **They are currently all disabled; only local login is used.** Each provider
  is opt-in, see [SNS login](#sns-login).
- Helmet, an explicit CORS allow-list, throttling, DTO validation and a single
  error envelope.
- Per-environment env files, read-only DB checks, and migrations verified on
  MariaDB in CI.

## Quick start (development)

Requires Node.js 24 (`.nvmrc`; `engines` requires >= 22.13).

```bash
npm ci
cp .env.example .env && chmod 600 .env
# edit .env: DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD
npm run db:check     # read-only: connection, account, TLS, database, pending migrations
npm run db:setup     # create the database if missing, then apply migrations (tables)
npm run start:dev    # http://localhost:3000, Swagger at /api-docs
```

- Type the password into the `DB_PASSWORD=` line of `.env` yourself. The file
  is ignored by git; do not put the password in chats, docs or commits.
- `db:setup` is safe to run again: it never recreates an existing database and
  never re-runs an applied migration.
- The dev MariaDB server has no TLS (`db:check` prints `tls: off`). Restrict its
  port to developer IPs, or connect through an SSH tunnel.

## Environments

One env file per environment, chosen by `NODE_ENV`
(see [`src/config/env-files.ts`](src/config/env-files.ts)). The app, the
migration CLI, the `db:*` tools and e2e all use the same rule.

- Exported shell variables override file values.
- `ENV_FILE=<path>` replaces the file choice.

| Environment | `NODE_ENV` | File (git-ignored) | Template | Database |
| --- | --- | --- | --- | --- |
| Dev | `development` (default) | `.env` | `.env.example` | external dev server, `app_db` |
| Test | `test` | `.env.test.local` (required) | `.env.test.example` | dev server, `*_test` only (`app_db_test`) |
| Prod | `production` | `.env.production` | `.env.production.example` | EC2 localhost MariaDB |

Validation rules (startup, `env:check`, `db:*`):

- **Always required:** `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `JWT_SECRET`.
  `JWT_EXPIRES_IN` must look like `3600`, `30m`, `1h` or `7d`. `CORS_ORIGIN`
  must not be `*`.
- **`NODE_ENV=test`:** only accepts `*_test` databases.
- **`NODE_ENV=production`** also requires:
  - `CORS_ORIGIN`: an origin list, or `none` to disable CORS
  - `JWT_SECRET`: at least 32 characters, with no placeholder text
  - `DB_SYNCHRONIZE=false`
- **New keys:** add them to `src/config/app-env.ts` and to
  `scripts/runtime-env-keys.cjs`. A spec fails when the two lists drift.

Full guide with account SQL and common errors:
[docs/deployment/database-environments.kr.md](docs/deployment/database-environments.kr.md).

## Scripts

| Purpose | Dev | Test | Prod (on EC2, after `npm run build`) |
| --- | --- | --- | --- |
| Validate config, no DB connection (needs a build) | `env:check` | `env:check:test` | `env:check:prod` |
| DB check, read-only | `db:check` | `db:check:test` | `db:check:prod` |
| Create DB if missing + apply migrations | `db:setup` | `db:setup:test` | admin SQL once, then `migration:run:prod` |
| Recreate the test DB and apply every migration | — | `db:reset:test` | — |
| Migration status / apply / revert | `migration:show` / `migration:run` / `migration:revert` | `migration:show:test` / `migration:run:test` / `migration:revert:test` | `migration:show:prod` / `migration:run:prod` / `migration:revert:prod` |
| Entity vs migration drift check | — | `migration:check:test` | — |
| Run | `start:dev` | `test:e2e` | `pm2:reload` |

- Other scripts:
  - `build`, `start`, `start:prod`
  - `lint` / `lint:check`, `format` / `format:check`, `typecheck`
  - `test`, `test:cov`
  - `migration:generate`, `secrets:export`
- Each environment-specific script runs through
  [`scripts/typeorm-env.cjs`](scripts/typeorm-env.cjs), which sets `NODE_ENV`
  and works the same on macOS, Linux and Windows.
- Prod commands run from `dist` with plain `node`, so the server does not need
  ts-node.
- `db:ensure` refuses to run in production, and `db:reset` only works on a
  `*_test` database.

## Database and migrations

- **Tables come only from migrations**
  ([`src/database/migrations/`](src/database/migrations/)). Never use
  `synchronize` or hand-written `CREATE TABLE`.
- **The same migration files go through every environment in order:** CI
  (empty DB) → Test → Dev → Prod.
- **Migrations are an explicit deploy step.** The app does not run them on
  startup. It logs a warning, or an error in production, when migrations are
  pending.
- **Database containers are created once per environment.** Dev and Test use
  `db:setup`. Prod uses admin SQL, so the app account holds privileges on its
  own database only.
- **Back up before any production migration.** Some legacy migrations cannot
  be reverted.

Why it works this way (manual SQL vs a command vs auto-run, verification
layers, rollback):
[docs/learning/database-schema-management.kr.md](docs/learning/database-schema-management.kr.md).

## Deploy (EC2 + PM2)

```bash
git pull --ff-only
npm ci
npm run build
npm run env:check:prod       # validate .env.production without touching the DB
npm run db:check:prod        # read-only: connection, privileges, pending migrations
# back up the database when migrations are pending (mysqldump --single-transaction)
npm run migration:run:prod
npm run pm2:reload           # ecosystem.config.cjs pins cwd and NODE_ENV=production
curl -fsS http://127.0.0.1:${PORT:-3000}/health   # 503 when the DB is down
```

- **After `1765000000000-AddRoleToUsers`:** grant admin manually with
  `UPDATE users SET role = 'admin' WHERE username = '<admin-username>';`.
- **Optional AWS Secrets Manager:** run
  `eval "$(AWS_SECRET_ID=<id> AWS_REGION=ap-northeast-2 npm run -s secrets:export)"`
  first. Exported values override `.env.production`.
- **Full checklist, rollback and TLS:**
  [docs/deployment/mariadb-systemd.kr.md](docs/deployment/mariadb-systemd.kr.md).

## SNS login

All providers are off: `AUTH_<PROVIDER>_ENABLED=false`, where `<PROVIDER>` is
`GOOGLE`, `APPLE`, `KAKAO`, `NAVER` or `FACEBOOK`.

- A disabled provider needs no settings, and its routes return 503
  `AUTH_<PROVIDER>_DISABLED`.
- Naver access-token login stays blocked even when Naver is enabled
  (`AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED=false`).

Before enabling a provider, complete
[docs/auth/sns-reenable-checklist.kr.md](docs/auth/sns-reenable-checklist.kr.md).

## API

- Swagger: `http://localhost:3000/api-docs` in development and test. It is
  disabled in production.
- Route table with access levels (55 routes):
  [docs/product/api-spec.kr.md](docs/product/api-spec.kr.md).
- curl examples: [API_EXAMPLES.md](API_EXAMPLES.md).

| Area | Routes | Access |
| --- | --- | --- |
| System | `GET /`, `GET /health` | public |
| Accounts | `POST /users/register`, `POST /auth/login` | public |
| Profile | `GET/PATCH /users/profile` | JWT |
| SNS login | `POST /auth/{google,apple,kakao,naver,facebook}/{login,exchange-code}`, `POST /auth/{google,apple}/verify-id-token` | public (503 while disabled) |
| Catalog reads | `GET /music/tracks`, `GET /music/tracks/:id`, `GET /music/public/playlists(/:id)` | public |
| Catalog writes | tracks, audio assets, playlists (create/update/delete/publish/reorder), `GET /music/tracks/:trackId/audio-assets` | **admin** |
| Legacy reads | `GET /music/legacy/tracks(/:id)` public; artists, playlists, `tracks/full` | JWT |
| Legacy writes | `POST/PATCH/DELETE /music/legacy/**` | **admin** |

Public responses never include audio URLs or internal storage identifiers.

## Project structure

```text
src/
  main.ts        bootstrap: helmet, CORS, trust proxy, validation, shutdown hooks
  app.module.ts  module wiring, global interceptor/filter/guards
  config/        env file selection (env-files.ts) and validation (app-env.ts)
  database/      TypeORM options, CLI data source, db-tool, pending-migration check, migrations
  common/        DomainError, global exception filter, request id, response envelope
  auth/          session (JWT, RBAC), local login, shared SNS kernel, 5 providers
  users/         domain, use-cases, ports/adapters, controller, presenters
  music/         legacy (/music/legacy) and catalog (/music) modules
scripts/         typeorm-env.cjs, check-env.cjs, runtime-env-keys.cjs, export-secrets-env.cjs
test/            e2e (runs against MariaDB)
```

## Verification and CI

```bash
npm run lint:check && npm run format:check && npm run typecheck && npx jest && npm run build
npm run db:setup:test && npm run test:e2e      # needs .env.test.local
```

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs
on every pull request and on every push to `develop` and `main`:

- **`verify`:** lint, format, typecheck, unit tests, build and a critical
  production `npm audit`.
- **`database`** (MariaDB 10.11 service container):
  1. apply every migration to an empty database
  2. assert that nothing is pending
  3. revert and re-apply the latest migration
  4. run the schema drift check (report-only for now, audit item DB-12)
  5. run e2e

## Documentation

| Topic | Document |
| --- | --- |
| Index and reading order | [docs/README.md](docs/README.md) |
| Product scope, features, API contract | [docs/product/](docs/product/) |
| Music catalog design and decisions | [docs/music/README.md](docs/music/README.md) |
| Architecture walkthrough | [docs/learning/nestjs-operational-stability-guide.kr.md](docs/learning/nestjs-operational-stability-guide.kr.md) |
| DB and schema management (concepts) | [docs/learning/database-schema-management.kr.md](docs/learning/database-schema-management.kr.md) |
| Environments, DB setup, errors (procedures) | [docs/deployment/database-environments.kr.md](docs/deployment/database-environments.kr.md) |
| EC2 deployment and rollback | [docs/deployment/mariadb-systemd.kr.md](docs/deployment/mariadb-systemd.kr.md) |
| Security and secrets | [docs/learning/security-guide.kr.md](docs/learning/security-guide.kr.md), [docs/learning/deployment-secrets-checklist.kr.md](docs/learning/deployment-secrets-checklist.kr.md) |
| Latest audit, roadmap, release checklist | [docs/audit/2026-11-08-project-audit.kr.md](docs/audit/2026-11-08-project-audit.kr.md) |
| Past runtime issues | [docs/learning/runtime-troubleshooting-history.kr.md](docs/learning/runtime-troubleshooting-history.kr.md) |
