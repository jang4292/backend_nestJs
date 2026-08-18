# NestJS Backend API

A NestJS backend focused on authentication, Google social login, user profile
management, and music playlist APIs. The project uses PostgreSQL with TypeORM,
strict environment validation, global request validation, and security-focused
runtime defaults.

## Features

- Local user registration and JWT login
- Google social login using ID token or auth-code + PKCE flow
- Protected user profile read/update endpoints
- Music track, playlist, and playlist-track APIs
- PostgreSQL + TypeORM integration
- Environment validation for unsafe production settings
- Helmet, CORS allow-listing, throttling, and DTO validation
- Unit/integration coverage for auth, Google auth, config, users, and music

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Required operational settings:

```env
PORT=3000
NODE_ENV=development

DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=nestjs_db
DB_SYNCHRONIZE=false

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

`JWT_SECRET` and `GOOGLE_ALLOWED_AUDIENCES` are required at startup.
`NODE_ENV=production` also requires `CORS_ORIGIN`, rejects placeholder JWT
secrets, and blocks `DB_SYNCHRONIZE=true`.

## Running

```bash
npm run start
npm run start:dev
npm run start:prod
```

## API Overview

Public endpoints:

```http
GET  /health
POST /users/register
POST /auth/login
POST /auth/google/verify-id-token
POST /auth/google/exchange-code
POST /auth/google/login
GET  /music/tracks
GET  /music/playlists
```

Protected user endpoints:

```http
GET   /users/profile
PATCH /users/profile
```

Music endpoints:

```http
POST   /music/tracks
GET    /music/tracks
GET    /music/tracks/:id
PATCH  /music/tracks/:id
DELETE /music/tracks/:id

POST   /music/playlists
GET    /music/playlists
GET    /music/playlists/by-date?date=YYYY-MM-DD
GET    /music/playlists/:id
PATCH  /music/playlists/:id
DELETE /music/playlists/:id

GET    /music/playlists/:playlistId/tracks
POST   /music/playlists/:playlistId/tracks
PATCH  /music/playlists/:playlistId/tracks/:playlistTrackId
DELETE /music/playlists/:playlistId/tracks/:playlistTrackId
```

## Project Structure

```text
src/
  common/        shared request-id, response, and request contracts
  config/        environment validation and AppEnv contract
  auth/          local/JWT auth plus Google social auth
  users/         user entity, DTOs, controller, service, public-user mapper
  music/         music controller, facade service, domain services, entities
  app.module.ts  application module and infrastructure wiring
  main.ts        bootstrap, validation pipe, helmet, CORS
```

## Learning Guide

- [NestJS operational stability refactor guide](docs/learning/nestjs-operational-stability-guide.kr.md)

## Verification

```bash
npm test -- --runInBand
npm run build
npx eslint "src/**/*.ts" "test/**/*.ts"
```

## Production Notes

- Keep `DB_SYNCHRONIZE=false`; use TypeORM migrations for shared databases.
- Use a strong `JWT_SECRET` and rotate it according to your security policy.
- Set `CORS_ORIGIN` to the real frontend origin, never `*`.
- Configure `GOOGLE_ALLOWED_AUDIENCES` with the exact OAuth client IDs.
- Avoid logging raw Google tokens, JWTs, or passwords.
