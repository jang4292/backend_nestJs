# NestJS Backend API

A secure NestJS backend application with user authentication, registration, and database integration.

## Features

1. ✅ NestJS framework setup with TypeScript
2. ✅ User registration with password encryption (bcrypt)
3. ✅ User login with JWT authentication
4. ✅ Database integration with TypeORM (PostgreSQL)
5. ✅ User profile management with timestamps (createdAt, updatedAt)
6. ✅ Security features:
   - Helmet for HTTP headers security
   - CORS configuration
   - Rate limiting with @nestjs/throttler
   - Password hashing with bcrypt
   - JWT token-based authentication
   - Input validation with class-validator

## Installation

```bash
$ npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
$ cp .env.example .env
```

2. Update the `.env` file with your database credentials and JWT secret:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=nestjs_db
DB_SYNCHRONIZE=true

# JWT Configuration
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=1h

# Security
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## API Endpoints

### Public Endpoints

#### Health Check
```
GET /health
```

#### User Registration
```
POST /users/register
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123",
  "email": "test@example.com",
  "name": "Test User"
}
```

#### User Login
```
POST /auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123"
}

Response:
{
  "access_token": "jwt_token_here",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "name": "Test User",
    "createdAt": "2025-12-06T14:30:00.000Z",
    "updatedAt": "2025-12-06T14:30:00.000Z"
  }
}
```

### Protected Endpoints (Require JWT Token)

#### Get User Profile
```
GET /users/profile
Authorization: Bearer {jwt_token}
```

#### Update User Profile
```
PATCH /users/profile
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "email": "newemail@example.com",
  "name": "Updated Name",
  "password": "newpassword123"  // optional
}
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Project Structure

```
src/
├── auth/                    # Authentication module
│   ├── dto/                 # Data Transfer Objects
│   ├── guards/              # Auth guards (JWT, Local)
│   ├── strategies/          # Passport strategies
│   ├── auth.controller.ts   # Auth controller
│   ├── auth.module.ts       # Auth module
│   └── auth.service.ts      # Auth service
├── users/                   # Users module
│   ├── dto/                 # Data Transfer Objects
│   ├── entities/            # TypeORM entities
│   ├── users.controller.ts  # Users controller
│   ├── users.module.ts      # Users module
│   └── users.service.ts     # Users service
├── app.controller.ts        # Root controller
├── app.module.ts            # Root module
├── app.service.ts           # Root service
└── main.ts                  # Application entry point
```

## Security Features

1. **Password Encryption**: All passwords are hashed using bcrypt with salt rounds of 10
2. **JWT Authentication**: Stateless authentication using JSON Web Tokens
3. **Helmet**: Secures HTTP headers
4. **CORS**: Configurable Cross-Origin Resource Sharing
5. **Rate Limiting**: Prevents brute force attacks (configurable via environment variables)
6. **Input Validation**: Automatic validation of all incoming requests
7. **SQL Injection Protection**: TypeORM parameterized queries

## Database Schema

### Users Table
- `id`: Primary key (auto-generated)
- `username`: Unique username
- `password`: Encrypted password (bcrypt)
- `email`: User email (optional)
- `name`: User's full name (optional)
- `createdAt`: Registration timestamp (auto-generated)
- `updatedAt`: Last update timestamp (auto-updated)

## License

This project is [MIT licensed](LICENSE).
