# API Usage Examples

This document provides practical examples for using the backend API.

## Prerequisites

1. Make sure MariaDB is reachable at the configured `DB_HOST:DB_PORT`
2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Update `.env` with your settings:
```env
JWT_SECRET=your-strong-secret-key-here
DB_TYPE=mariadb
DB_HOST=yhjang.com
DB_PORT=3306
DB_USERNAME=your-db-user
DB_PASSWORD=your-password
DB_DATABASE=nestjs_db
DB_SYNCHRONIZE=false
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
CORS_ORIGIN=http://localhost:3001
GOOGLE_ALLOWED_AUDIENCES=your-google-client-id.apps.googleusercontent.com
```

4. Install dependencies and start the server:
```bash
npm install
npm run start:dev
```

For a shared or production database, apply the schema before starting the API:

```bash
npm run migration:show
npm run migration:run
```

## API Examples

### 1. Health Check

Check if the API is running:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-09-10T14:30:00.000Z",
  "database": "up"
}
```

### 2. User Registration

Register a new user:

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

Response:
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "name": "John Doe",
  "createdAt": "2025-12-06T14:30:00.000Z",
  "updatedAt": "2025-12-06T14:30:00.000Z"
}
```

### 3. User Login

Login with username and password:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "SecurePass123"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "name": "John Doe",
    "createdAt": "2025-12-06T14:30:00.000Z",
    "updatedAt": "2025-12-06T14:30:00.000Z"
  }
}
```

**Save the `access_token` for subsequent requests!**

### 4. Get User Profile (Protected)

Get the current user's profile using the JWT token:

```bash
curl http://localhost:3000/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

Response:
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "john@example.com",
  "name": "John Doe",
  "createdAt": "2025-12-06T14:30:00.000Z",
  "updatedAt": "2025-12-06T14:30:00.000Z"
}
```

### 5. Update User Profile (Protected)

Update user information:

```bash
curl -X PATCH http://localhost:3000/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "email": "newemail@example.com",
    "name": "John Smith"
  }'
```

Response:
```json
{
  "id": 1,
  "username": "johndoe",
  "email": "newemail@example.com",
  "name": "John Smith",
  "createdAt": "2025-12-06T14:30:00.000Z",
  "updatedAt": "2025-12-06T14:35:00.000Z"
}
```

### 6. Change Password (Protected)

Update password:

```bash
curl -X PATCH http://localhost:3000/users/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "password": "NewSecurePass456"
  }'
```

### 7. Social Login

Google and Apple support ID-token verification and authorization-code login.
Facebook, Kakao, and Naver accept a provider access token or authorization code.
All social login responses use this envelope:

```json
{
  "ok": true,
  "requestId": "request-id",
  "data": {
    "accessToken": "jwt_token_here",
    "expiresIn": 3600,
    "user": { "id": 1, "username": "provider_subject", "email": "user@example.com" }
  }
}
```

#### Google login

Login with a Google ID token:

```bash
curl -X POST http://localhost:3000/auth/google/login \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "GOOGLE_ID_TOKEN"
  }'
```

Response:

```json
{
  "ok": true,
  "requestId": "request-id",
  "data": {
    "accessToken": "jwt_token_here",
    "expiresIn": 3600,
    "user": {
      "id": 1,
      "username": "google_117123456789",
      "email": "user@example.com"
    }
  }
}
```

#### Apple login

```bash
curl -X POST http://localhost:3000/auth/apple/login \
  -H "Content-Type: application/json" \
  -d '{"idToken":"APPLE_ID_TOKEN"}'
```

#### Facebook, Kakao, and Naver login

Replace the provider name and token with the corresponding provider value:

```bash
curl -X POST http://localhost:3000/auth/kakao/login \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"KAKAO_ACCESS_TOKEN"}'
```

Authorization-code exchange endpoints are:

```text
POST /auth/google/exchange-code
POST /auth/apple/exchange-code
POST /auth/facebook/exchange-code
POST /auth/kakao/exchange-code
POST /auth/naver/exchange-code
```

Google and Apple also expose `POST /auth/{provider}/verify-id-token`.
Provider-specific credentials and error codes are documented in
[the SNS login overview](docs/auth/sns-login-overview.kr.md).

### 8. Music Artists

All music endpoints require `Authorization: Bearer YOUR_ACCESS_TOKEN_HERE`.

```bash
curl http://localhost:3000/music/artists \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"

curl -X POST http://localhost:3000/music/artists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{"name":"Artist X"}'
```

Use `GET /music/artists/:id`, `PATCH /music/artists/:id`, and
`DELETE /music/artists/:id` for single-artist operations.

### 9. Music Tracks

Create and list tracks:

```bash
curl -X POST http://localhost:3000/music/tracks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "title": "Song A",
    "artist": "Artist X",
    "bpm": 120,
    "lengthSec": 210
  }'

curl http://localhost:3000/music/tracks \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

### 10. Music Playlists

Create a playlist and add a track:

```bash
curl -X POST http://localhost:3000/music/playlists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "name": "Evening Set",
    "playDate": "2026-01-01",
    "description": "Main playlist"
  }'

curl -X POST http://localhost:3000/music/playlists/1/tracks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "trackId": 1,
    "seq": 1,
    "note": "Opening track"
  }'
```

## Error Responses

Social authentication errors use the request-id envelope:

```json
{
  "ok": false,
  "requestId": "request-id",
  "errorCode": "AUTH_KAKAO_INVALID_TOKEN",
  "message": "Invalid provider token."
}
```

### 400 Bad Request

Invalid input data:

```json
{
  "statusCode": 400,
  "message": [
    "username must be longer than or equal to 4 characters",
    "password must be longer than or equal to 6 characters"
  ],
  "error": "Bad Request"
}
```

### 401 Unauthorized

Invalid credentials or missing/invalid token:

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### 409 Conflict

Username already exists:

```json
{
  "statusCode": 409,
  "message": "Username already exists",
  "error": "Conflict"
}
```

## Using with Postman

1. Import the following into Postman or create a new collection
2. Set a base URL variable: `http://localhost:3000`
3. For protected endpoints, add Authorization header:
   - Type: Bearer Token
   - Token: `{{access_token}}`

## Testing with JavaScript/TypeScript

```typescript
// Register a user
const registerResponse = await fetch('http://localhost:3000/users/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'testuser',
    password: 'password123',
    email: 'test@example.com',
    name: 'Test User'
  })
});
const user = await registerResponse.json();

// Login
const loginResponse = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'testuser',
    password: 'password123'
  })
});
const { access_token } = await loginResponse.json();

// Get profile
const profileResponse = await fetch('http://localhost:3000/users/profile', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
const profile = await profileResponse.json();
```

## Security Notes

1. **Always use HTTPS in production**
2. **Never commit `.env` file** - it's already in `.gitignore`
3. **Use strong JWT secrets** - minimum 32 characters recommended
4. **Rotate JWT secrets periodically**
5. **Set appropriate CORS_ORIGIN** - never use `*` in production
6. **Enable rate limiting** - configured via THROTTLE_TTL and THROTTLE_LIMIT
7. **Use strong passwords** - minimum 6 characters (configure as needed)

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use a strong, randomly generated `JWT_SECRET`
- [ ] Set `DB_SYNCHRONIZE=false` and use migrations
- [ ] Configure `CORS_ORIGIN` to your frontend domain
- [ ] Configure `GOOGLE_ALLOWED_AUDIENCES` with exact OAuth client IDs
- [ ] Configure credentials for every social provider the client uses
- [ ] Set up HTTPS/TLS
- [ ] Configure database connection pooling
- [ ] Set up logging and monitoring
- [ ] Enable rate limiting with appropriate limits
- [ ] Review and adjust JWT token expiration time
- [ ] Set up database backups
- [ ] Configure environment-specific error messages
