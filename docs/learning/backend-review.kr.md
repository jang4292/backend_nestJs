# 백엔드 API 서버 검토: DB 설정 / 로그인 로직 / 보안 / REST API 구조

이 문서는 `feature/login-logics` 브랜치 기준으로 (1) MySQL 관련 설정값의 위치, (2) 로그인 로직, (3) 보안 처리, (4) REST API 구조를 정리하고, 검토 과정에서 발견된 이슈와 이번 작업에서의 조치 여부를 기록한다. PostgreSQL 연결 자체의 기본 구조는 [postgresql-rds-nestjs-guide.kr.md](postgresql-rds-nestjs-guide.kr.md)를, 시크릿 흐름은 [security-guide.kr.md](security-guide.kr.md)를 함께 참고한다.

## 1. MySQL 관련 설정값 위치 (재도입 가능 구조로 정리)

이 프로젝트는 현재 PostgreSQL만 실제로 사용하지만(설치된 드라이버도 `pg`뿐), 나중에 MySQL 설정값을 별도로 다시 반영할 수 있도록 DB 종류를 `DB_TYPE` 환경변수로 분기하는 구조로 정리했다.

DB 설정이 모이는 지점은 다음 4곳이다.

| 파일 | 역할 |
| --- | --- |
| [src/config/app-env.ts](../../src/config/app-env.ts) | `DB_TYPE: 'postgres' \| 'mysql'` 타입 정의, 환경변수 검증(`postgres`/`mysql` 외 값은 부팅 시 에러) |
| [src/database/database-options.ts](../../src/database/database-options.ts) | `createDatabaseOptions()` — `DB_TYPE`에 따라 TypeORM `DataSourceOptions.type`을 분기해 반환. 이 함수 하나가 앱 런타임과 migration CLI가 공유하는 단일 진입점 |
| [src/database/data-source.ts](../../src/database/data-source.ts) | migration CLI용 `DataSource` — `DB_TYPE` env를 읽어 `createDatabaseOptions`에 전달, 기본 포트도 타입에 따라 5432/3306으로 분기 |
| [src/app.module.ts](../../src/app.module.ts) | `TypeOrmModule.forRootAsync`에서 `ConfigService`의 `DB_TYPE`을 읽어 `createDatabaseOptions`에 전달 |

`.env` / `.env.example`의 `DB_*` 변수(`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DATABASE_URL`)는 두 DB 종류에 공통으로 쓰인다. `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`는 현재 postgres(RDS) 전용으로만 적용되도록 분기해 두었다(`database-options.ts` 참고).

### MySQL을 실제로 다시 붙일 때 추가로 필요한 작업 (이번 범위 밖)

이번 작업은 "구조 분기"까지만 진행했고, 아래는 실제로 `DB_TYPE=mysql`을 운영에 쓰기 전에 반드시 필요한 후속 작업이다.

- `mysql2` 드라이버 설치 (`package.json` dependencies)
- MySQL 전용 migration 작성 — 현재 [1760000000000-CreateInitialSchema.ts](../../src/database/migrations/1760000000000-CreateInitialSchema.ts)는 `serial`, `timestamp without time zone` 등 PostgreSQL 전용 컬럼 타입을 사용하므로 MySQL에서는 그대로 동작하지 않는다
- 실제 MySQL 인스턴스에 연결해 커넥션/마이그레이션/쿼리 동작 검증 (이번 작업 범위에서 명시적으로 제외)

## 2. 로그인 로직 정리

### 현재 흐름

```text
POST /auth/login (AuthController)
  -> AuthService.login (LoginDto 검증)
    -> UsersService.findOne (username으로 조회)
    -> UsersService.validatePassword (bcrypt.compare)
  -> JwtService.sign({ username, sub: userId })
  -> { access_token, user }
```

관련 파일: [auth.controller.ts](../../src/auth/auth.controller.ts), [auth.service.ts](../../src/auth/auth.service.ts), [jwt.strategy.ts](../../src/auth/strategies/jwt.strategy.ts), [jwt-auth.guard.ts](../../src/auth/guards/jwt-auth.guard.ts)

Google OAuth 로그인은 별도 DDD 모듈([src/auth/google/**](../../src/auth/google))로 분리되어 있으며 `POST /auth/google/verify-id-token`, `/auth/google/exchange-code`, `/auth/google/login` 세 엔드포인트를 제공한다.

### 발견된 문제와 조치

| 문제 | 조치 |
| --- | --- |
| `LocalStrategy`/`LocalAuthGuard`(Passport local 전략)가 등록만 되어 있고 실제로는 `AuthController.login`이 이를 거치지 않고 `AuthService.login()`을 직접 호출 — 죽은 코드이자 두 로그인 경로가 존재하는 것처럼 보이는 혼란 요소 | **이번 작업에서 제거함** — `local.strategy.ts`, `local-auth.guard.ts` 삭제, `auth.module.ts` provider 목록에서도 제거 |
| Refresh token 미구현, `access_token`은 만료(`1h`) 후 재로그인 외 방법 없음 | 후속 과제로 보류 (신규 기능 추가이므로 이번 범위 밖) |
| JWT payload에 `jti`(토큰 고유 ID) 없음 — 서버 측에서 특정 토큰을 강제로 무효화(로그아웃)할 방법이 없음 | 후속 과제로 보류 |

## 3. 보안 처리 정리

### 발견된 문제와 조치

| 영역 | 문제 | 조치 |
| --- | --- | --- |
| Rate limiting | `ThrottlerModule`은 [app.module.ts](../../src/app.module.ts)에 등록되어 있었지만 `ThrottlerGuard`가 어디에도 바인딩되지 않아 실제로는 동작하지 않음 — `/auth/login`, `/auth/google/*`가 무제한 시도에 노출 | **이번 작업에서 수정함** — `APP_GUARD`로 `ThrottlerGuard`를 전역 등록 |
| 인증 | [music.controller.ts](../../src/music/music.controller.ts)의 트랙/플레이리스트 CRUD 16개 엔드포인트 전체에 guard가 없어 비로그인 상태로 생성/수정/삭제 가능 | **이번 작업에서 수정함** — 컨트롤러 레벨에 `@UseGuards(JwtAuthGuard)` 적용. 단 `Track`/`Playlist` 엔티티에 소유자(`userId`) 컬럼이 없어 "로그인 필요"만 강제되고 "본인 데이터만 접근 가능"까지는 아님 — 이는 엔티티에 소유자 컬럼 추가 + migration이 필요한 별도 작업이라 후속 과제로 보류 |
| 설정 기본값 | `DB_PASSWORD` 기본값이 `'password'`로 하드코딩되어 있어, 프로덕션에서 env 설정을 빠뜨려도 앱이 약한 기본값으로 그냥 기동됨 | **이번 작업에서 수정함** — `NODE_ENV=production`일 때 `DB_PASSWORD` 미설정 시 부팅 에러 발생하도록 `app-env.ts`에 검증 추가 (기존 `JWT_SECRET`/`CORS_ORIGIN` 프로덕션 검증과 동일 패턴) |
| 정보 노출 | Swagger(`/api-docs`)가 `NODE_ENV`와 무관하게 항상 노출되어 프로덕션에서도 전체 API 스펙이 공개됨 | **이번 작업에서 수정함** — `NODE_ENV !== 'production'`일 때만 `SwaggerModule.setup` 호출하도록 `main.ts` 변경 |
| 예외 처리 | 전역 예외 필터가 없어 처리되지 않은 에러가 Nest 기본 필터를 그대로 타고, 상황에 따라 내부 에러 메시지/스택 정보가 응답에 노출될 수 있음 | **이번 작업에서 수정함** — [src/common/filters/http-exception.filter.ts](../../src/common/filters/http-exception.filter.ts) 신규 추가, `APP_FILTER`로 전역 등록. 5xx는 프로덕션에서 `"Internal server error"`로 일반화, 4xx는 원래 메시지 유지 |
| CSRF | 세션 쿠키 없이 JWT Bearer 토큰만 사용하는 stateless 구조라 CSRF 공격 자체가 성립하지 않음 | 조치 불필요 (구조상 안전) |
| 입력 검증 / SQL Injection | `ValidationPipe({whitelist, forbidNonWhitelisted, transform})`가 전역 적용되어 있고, DB 조회는 전부 TypeORM Repository/QueryBuilder의 파라미터 바인딩(`:search` 등)을 사용 — raw query나 문자열 조립 쿼리 없음 | 문제 없음, 현행 유지 |

## 4. REST API 구조

| 모듈 | 주요 엔드포인트 | 인증 |
| --- | --- | --- |
| `AuthModule` | `POST /auth/login` | 불필요 (로그인 자체) |
| `AuthGoogleModule` | `POST /auth/google/verify-id-token`, `/auth/google/exchange-code`, `/auth/google/login` | 불필요 (로그인 자체) |
| `UsersModule` | `POST /users/register` | 불필요 |
| | `GET /users/profile`, `PATCH /users/profile` | `JwtAuthGuard` |
| `MusicModule` | `/music/tracks/*` (CRUD), `/music/playlists/*` (CRUD), `/music/playlists/:id/tracks/*` (관계 CRUD) | `JwtAuthGuard` (이번 작업에서 추가) |

모든 API는 `Controller`/`@Body`/`@Query`/`@Param` + DTO(class-validator) 조합의 표준 REST 패턴을 따른다. Google 로그인 모듈만 도메인/유스케이스/어댑터를 분리한 클린 아키텍처 스타일이고, 나머지는 Controller-Service-Repository 계층 구조다.

## 5. 종합 검토 체크리스트

- [x] MySQL 설정값 위치 정리 + `DB_TYPE` 기반 재도입 가능 구조로 리팩터링 (드라이버 설치·실연결 검증은 범위 밖)
- [x] 사용되지 않는 `LocalStrategy`/`LocalAuthGuard` 제거
- [x] `ThrottlerGuard` 전역 바인딩 (rate limiting 실제 적용)
- [x] `MusicController`에 `JwtAuthGuard` 적용
- [x] 프로덕션 `DB_PASSWORD` 필수화
- [x] 프로덕션에서 Swagger 비노출
- [x] 전역 예외 필터로 에러 응답 정규화
- [ ] Refresh token / 서버 측 로그아웃(토큰 무효화) 구현 — 후속 과제
- [ ] `Track`/`Playlist`에 소유자(`userId`) 컬럼 추가 후 "본인 데이터만 접근" 수준까지 인가 강화 — 후속 과제
- [ ] MySQL 실사용을 위한 `mysql2` 설치 + 전용 migration 작성 + 실연결 검증 — 후속 과제
