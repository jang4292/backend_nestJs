# NestJS Backend API

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
- Protected user profile read/update endpoints
- Music artist, track, playlist, and playlist-track APIs
- MariaDB + TypeORM integration
- Environment validation for unsafe production settings
- Helmet, CORS allow-listing, throttling, and DTO validation
- Unit and integration coverage for auth, config, users, and music

## Installation

```bash
npm install
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
DB_HOST=yhjang.com
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
CORS_ORIGIN=http://localhost:3001

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
`NODE_ENV=production` also requires `CORS_ORIGIN`, rejects placeholder JWT
secrets, and blocks `DB_SYNCHRONIZE=true`. For a remote MariaDB instance, use
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
curl -fsS http://localhost:${PORT:-3000}/health
```

`scripts/export-secrets-env.cjs` accepts these Secrets Manager `SecretString`
shapes:

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

Public endpoints:

```http
GET  /health
POST /users/register
POST /auth/login
POST /auth/google/verify-id-token
POST /auth/google/exchange-code
POST /auth/google/login
POST /auth/apple/verify-id-token
POST /auth/apple/exchange-code
POST /auth/apple/login
POST /auth/facebook/exchange-code
POST /auth/facebook/login
POST /auth/kakao/exchange-code
POST /auth/kakao/login
POST /auth/naver/exchange-code
POST /auth/naver/login
```

Protected user endpoints:

```http
GET   /users/profile
PATCH /users/profile
```

Music endpoints:

```http
GET    /music/public/playlists
GET    /music/public/playlists/:id

POST   /music/tracks
GET    /music/tracks
GET    /music/tracks/:id
PATCH  /music/tracks/:id
DELETE /music/tracks/:id
POST   /music/tracks/:trackId/audio-assets
GET    /music/tracks/:trackId/audio-assets
PATCH  /music/audio-assets/:id
DELETE /music/audio-assets/:id

POST   /music/playlists
PATCH  /music/playlists/:id/publish
POST   /music/playlists/:playlistId/tracks
PATCH  /music/playlists/:playlistId/tracks/reorder

GET    /music/legacy/artists
GET    /music/legacy/artists/:id
POST   /music/legacy/artists
PATCH  /music/legacy/artists/:id
DELETE /music/legacy/artists/:id

POST   /music/legacy/playlists
GET    /music/legacy/playlists
GET    /music/legacy/playlists/by-date?date=YYYY-MM-DD
GET    /music/legacy/playlists/:id
PATCH  /music/legacy/playlists/:id
DELETE /music/legacy/playlists/:id

GET    /music/legacy/playlists/:playlistId/tracks
POST   /music/legacy/playlists/:playlistId/tracks
PATCH  /music/legacy/playlists/:playlistId/tracks/:playlistTrackId
DELETE /music/legacy/playlists/:playlistId/tracks/:playlistTrackId
```

`/music/public/*`와 Catalog Track 조회는 로그인 없이 사용할 수 있습니다. 공개 응답은 화면용 메타데이터와 Track 순서만 반환하며 AudioAsset의 S3 URL이나 내부 저장소 식별자를 포함하지 않습니다. Catalog 생성·수정·Playlist 관리와 AudioAsset 목록 조회는 JWT가 필요합니다. 자세한 학습 흐름은 [Music 학습 가이드](docs/music/learning-guide.kr.md)를 참고하세요.

## Project Structure

```text
src/
  common/        shared request-id, response, and request contracts
  config/        environment validation and AppEnv contract
  auth/          local/JWT auth plus five social providers
  users/         user entity, DTOs, controller, service, public-user mapper
  music/         music controller, facade service, domain services, entities
  app.module.ts  application module and infrastructure wiring
  main.ts        bootstrap, validation pipe, helmet, CORS
```

## Learning Guide

- [API usage examples](API_EXAMPLES.md)
- [SNS login overview](docs/auth/sns-login-overview.kr.md)
- [Google login guide](docs/auth/google-login.en.md)
- [NestJS operational stability refactor guide](docs/learning/nestjs-operational-stability-guide.kr.md)
- [MariaDB EC2 deployment guide](docs/deployment/mariadb-systemd.kr.md)

## Verification

```bash
npm test -- --runInBand
npm run build
npx eslint "src/**/*.ts" "test/**/*.ts"
```

## Production Notes

- Keep `DB_SYNCHRONIZE=false`; use TypeORM migrations for shared databases.
- Run migrations as a release/deployment step before deploying the application.
- Do not run the initial migration against an existing MariaDB database until its
  current schema has been compared and backed up.
- Use a strong `JWT_SECRET` and rotate it according to your security policy.
- Set `CORS_ORIGIN` to the real frontend origin, never `*`.
- Configure `GOOGLE_ALLOWED_AUDIENCES` with the exact OAuth client IDs.
- Avoid logging raw Google tokens, JWTs, or passwords.
