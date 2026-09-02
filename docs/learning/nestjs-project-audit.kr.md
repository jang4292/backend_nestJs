# NestJS 프로젝트 전수 감사 및 개선 가이드

## 1. 감사 범위와 검증 결과

2026-09-02 기준으로 애플리케이션 부트스트랩, 모듈 구성, 인증, 사용자,
음악 도메인, 데이터베이스, 예외 처리, 환경 설정, 테스트와 배포 설정을
점검했다.

| 검증 항목 | 결과 | 근거 |
| --- | --- | --- |
| 단위 테스트 | 부분 통과 | 27개 스위트 중 25개 통과, 128개 테스트 통과 |
| 프로덕션 빌드 | 실패 | 로컬 설치 트리에서 `@nestjs/swagger`, `jose`, `google-auth-library`를 찾지 못함 |
| 의존성 선언 | 정상 | `package.json`, `package-lock.json`에 세 패키지가 모두 기록됨 |
| Node 런타임 | 경고 | Node 22.12.0은 `eslint-visitor-keys`가 요구하는 Node 22.13.0 이상보다 낮음 |
| 작업 트리 | 깨끗함 | 감사 시작 시 추적 파일 변경 없음 |

빌드와 두 DTO 테스트의 실패 원인은 코드가 아닌 의존성 설치 상태로 판단된다.
현재 `node_modules`에 위 패키지가 없으므로, 가장 먼저 `npm ci`를 실행하여
잠금 파일 기준으로 설치를 복구해야 한다. 이후 아래 명령으로 재검증한다.

```bash
npm ci
npx jest --runInBand
npm run build
npx eslint "src/**/*.ts" "test/**/*.ts"
```

Node는 22.13 이상 또는 24 이상으로 고정한다. 현재 Node 22.12.0에서는 설치는
진행될 수 있어도 ESLint 의존성이 엔진 경고를 출력한다. `.nvmrc` 또는 CI의
`node-version` 설정으로 런타임을 고정하는 것이 바람직하다.

## 2. 현재 구조 설명

### 애플리케이션 시작과 공통 정책

`src/main.ts`는 Nest 애플리케이션을 만들고 Helmet, CORS, 전역 DTO 검증,
Swagger를 구성한다. 운영 환경에서는 Swagger를 노출하지 않는다.

`src/app.module.ts`는 전체 조립 지점이다. 환경 변수 검증 뒤 TypeORM,
요청 제한(Throttler), 공통 모듈, 사용자, 음악, 로컬 로그인과 5개 소셜 로그인
모듈을 등록한다. 전역으로 다음 횡단 관심사를 적용한다.

| 구성 | 역할 |
| --- | --- |
| `RequestIdInterceptor` | 요청 식별자를 생성 또는 전달하고 응답 헤더에 기록 |
| `GlobalExceptionFilter` | 예외 응답 형식을 통일하고 비밀 값이 로그나 응답에 노출될 위험을 줄임 |
| `ThrottlerGuard` | 기본적으로 지정 시간 내 요청 수를 제한 |
| `ValidationPipe` | DTO 변환 및 class-validator 기반 입력 검증 |

### 설정과 데이터베이스

`src/config/app-env.ts`는 환경 변수의 타입 변환과 운영 안전장치를 담당한다.
운영 환경에서 CORS 원본 누락, `DB_SYNCHRONIZE=true`, 플레이스홀더 JWT 비밀값,
TLS 인증서가 필요한 RDS 설정 누락, 잘못된 커넥션 풀 범위를 시작 단계에서 막는다.

`src/database/database-options.ts`와 `src/database/data-source.ts`는 TypeORM
연결 옵션 및 CLI 마이그레이션 설정을 제공한다. PostgreSQL이 기본이며
`DATABASE_URL`이 있으면 개별 `DB_*` 값보다 우선한다. 공유 환경에서는
`DB_SYNCHRONIZE=false`를 유지하고 `src/database/migrations`의 마이그레이션만
사용하는 현재 원칙이 적절하다.

### 인증과 세션

인증은 제공자별 모듈 아래에 `application`, `domain`, `infrastructure`,
`interface`를 둔 포트-어댑터 구조다.

| 기능 | 경로 | 동작 |
| --- | --- | --- |
| 로컬 가입 | `POST /users/register` | 사용자 생성, 비밀번호 해시 저장, 공개 사용자 형태로 응답 |
| 로컬 로그인 | `POST /auth/login` | 사용자명 또는 이메일 조회, bcrypt 검증, JWT 발급 |
| Google 로그인 | `/auth/google/*` | ID 토큰 검증 또는 Authorization Code + PKCE 교환 후 소셜 계정 upsert와 JWT 발급 |
| Apple/Kakao/Naver/Facebook | `/auth/{provider}/*` | 각 공급자 검증 또는 코드 교환 후 공통 소셜 계정 연결과 세션 발급 |
| JWT 보호 | `JwtAuthGuard` | Bearer 토큰을 Passport 전략으로 검증하고 요청 사용자 주입 |

`SessionModule`이 JWT 발급을 중앙화해 소셜 제공자 간 세션 형식을 일관되게
유지한다. Google 흐름은 ID 토큰과 코드 방식이 동시에 들어오는 경우를 거부하고,
코드 방식에서는 redirect URI와 state 일치 여부를 검증한다.

### 사용자 도메인

`UsersModule`은 사용자 생성, 식별자 조회, 프로필 수정, 비밀번호 검증과
소셜 계정 연결을 제공한다. `/users/profile` 읽기와 수정은 JWT의 사용자 ID를
사용하므로 다른 사용자의 프로필을 URL 파라미터로 수정하는 경로는 없다.
`PublicUser` 매퍼로 비밀번호 등 내부 필드를 응답에서 분리하는 구조도 적절하다.

### 음악 도메인

`MusicModule`은 다음 세 하위 도메인으로 구성된다.

| 기능 | 설명 |
| --- | --- |
| Artist | 아티스트 생성, 단건/목록 조회, 수정, 삭제 |
| Track | 아티스트와 제목, BPM 등을 가진 트랙의 CRUD 및 검색/필터/페이지네이션 |
| Playlist | 날짜와 설명을 가진 플레이리스트 CRUD, 트랙 추가/순서 및 메모 수정/제거 |

컨트롤러는 `MusicService`를 파사드로 호출하고, 서비스는 유스케이스를 조합한다.
유스케이스는 Repository Port에 의존하며 TypeORM 어댑터가 구현하므로, 도메인
로직의 단위 테스트에서 DB를 쉽게 대체할 수 있다. `PlaylistTrack`은
플레이리스트와 트랙의 관계 및 순서(`seq`), 메모(`note`)를 표현한다.

중요한 현재 설계 판단은 음악 리소스가 `userId` 없이 모델링된 공용 카탈로그라는
점이다. 모든 음악 변경 API는 JWT 인증은 요구하지만 역할 또는 소유권 검증은
없다. 이것이 관리자 전용 편집 도구라면 명시적인 관리자 권한 정책이 필요하며,
사용자별 플레이리스트 제품이라면 `ownerId` 모델링, 조회 범위, 소유권 가드를
함께 도입해야 한다.

## 3. 실무 기준 개선 우선순위

### P0: 즉시 조치

1. **CI와 로컬 설치의 재현성 복구**
   - `npm ci` 후 빌드, 테스트, 린트를 실행한다.
  - Node 22.13 이상 또는 24 이상을 CI와 개발 환경의 최소 버전으로 고정한다.
   - CI는 `npm install` 대신 `npm ci`를 사용하고, 빌드 실패 시 배포를 차단한다.
   - 현재 `@nestjs/swagger`, `jose`, `google-auth-library` 누락은 컴파일과 DTO
     테스트를 모두 막으므로 기능 개발 전에 해소해야 한다.

2. **음악 쓰기 권한 모델 확정**
   - 공용 카탈로그라면 `role`/`permission` 기반 `AdminGuard`를 생성, 수정,
     삭제 API에 적용한다.
   - 개인 플레이리스트라면 Playlist에 소유자 FK를 추가하고, 목록/상세/변경
     유스케이스에 `requestUserId`를 전달해 DB 조회 단계에서 소유자를 제한한다.
   - 현재처럼 인증 사용자 모두가 음악 카탈로그를 변경할 수 있는 상태는 운영
     권한 정책으로 설명되지 않는 한 허용하면 안 된다.

3. **테스트 종료와 리소스 정리**
   - E2E의 `afterEach` 또는 `afterAll`에서 `app.close()`를 호출한다.
   - 테스트에서 실제 DB를 사용한다면 개발/RDS DB가 아닌 격리된 테스트 DB를
     명시적으로 설정한다.

### P1: 다음 스프린트

1. **인증 방어 강화**
   - 로그인 실패 횟수를 식별자와 IP 기준으로 제한하고, 일정 시간 잠금 또는
     지수 백오프를 적용한다.
   - 가입 DTO의 최소 길이 외에 비밀번호 정책, 사용자명 최대 길이 및 엔티티
     컬럼 길이를 정의한다.
   - 운영 JWT 비밀값은 32바이트 이상의 고엔트로피 값만 허용하도록 현재
     플레이스홀더 검사를 강화한다.
   - 리프레시 토큰, 폐기/회전 정책, 만료 테스트를 설계한다.

2. **운영 관측성 확보**
   - JSON 구조화 로그에 request ID, HTTP 상태, 지연 시간, 인증 주체 ID를
     비밀 정보 없이 기록한다.
   - OpenTelemetry 기반 trace ID를 도입해 외부 호출과 DB 지연을 연결한다.
   - `/live`와 `/ready`를 분리한다. `/live`는 프로세스 생존만, `/ready`는
     DB 연결 가능 여부를 보고해야 한다.
   - SIGTERM/SIGINT graceful shutdown을 켜고, 종료 유예 시간과 DB 연결 종료를
     배포 환경의 termination grace period에 맞춘다.

3. **데이터 정합성 보강**
   - `playlistId`와 `playlistTrackId` 조합 검증은 이미 유스케이스에서 한다.
     여기에 동일 트랙 중복 허용 여부와 `seq`의 유일성/재정렬 규칙을 DB 제약과
     트랜잭션으로 정의한다.
   - 여러 저장을 묶는 향후 기능(예: 플레이리스트 복제, 다건 순서 변경,
     소셜 가입 후 부가 프로필 생성)은 TypeORM transaction으로 원자성을 보장한다.
   - 마이그레이션 적용과 되돌리기를 임시 PostgreSQL에서 CI로 검증한다.

### P2: 운영 성숙화

1. 테스트를 Unit, Repository Integration, API E2E로 분리하고 Testcontainers
   PostgreSQL로 E2E를 격리한다.
2. OpenAPI 계약 테스트와 오류 응답 스키마 검증을 추가한다.
3. 의존성 취약점 스캔(`npm audit`)과 라이선스 점검을 CI에 추가한다.
4. 배포 전 migration, readiness 확인, 롤백 기준을 포함한 릴리스 파이프라인을
   문서화한다.

## 4. 테스트 현황과 권장 추가 케이스

현재 설정/DB 옵션/예외 필터, 각 소셜 제공자 유스케이스, 로컬 로그인,
사용자 컨트롤러, 음악의 Artist 유스케이스와 Track DTO에 테스트가 있다.
이는 핵심 계산 로직의 기반으로 충분하지만 HTTP와 실제 저장소의 결합 검증은
작다.

우선 추가할 테스트는 다음과 같다.

| 우선순위 | 테스트 |
| --- | --- |
| 높음 | 음악 쓰기 API가 관리자 또는 소유자가 아닌 요청을 403으로 거부 |
| 높음 | 고립된 PostgreSQL에서 회원 가입, 로그인, JWT 보호 프로필, 음악 CRUD E2E |
| 높음 | `npm ci && npm run build && npm test`를 CI 필수 단계로 설정 |
| 중간 | 잘못된 JWT, 만료 JWT, 로그인 실패 제한, CORS 운영 설정 |
| 중간 | 플레이리스트 트랙 중복/순서 규칙과 동시 수정 시나리오 |
| 중간 | migration run/revert와 기존 데이터 보존 |
| 낮음 | 대량 트랙 목록 및 플레이리스트 조회의 페이지네이션 성능 |

## 5. 의존성 취약점 분석과 조치 방향

`npm audit fix` 이후에도 취약점이 보이는 원인은 `npm audit fix`가 현재
`package-lock.json`을 갱신하지 않았기 때문이다. 확인 시 작업 트리에
`package.json` 또는 `package-lock.json` 변경이 없었고, `npm audit fix --dry-run`
은 메이저 버전 변경 없이 모든 항목을 수정할 수 있다고 제안했다. 일반적인
원인은 명령 중단, 다른 디렉터리에서 실행, 수정 후 `npm ci`로 기존 잠금 파일을
다시 설치한 경우다.

현재 전체 감사는 7건(높음 6, 보통 1), 운영 의존성만 대상으로 한 감사는
4건(높음 3, 보통 1)이다.

| 취약 패키지 | 의존 경로 | 영향 | 수정 제안 |
| --- | --- | --- | --- |
| `multer` | `@nestjs/platform-express` | 중첩된 폼 필드 또는 중단된 업로드로 인한 DoS | `@nestjs/platform-express` 11.1.27 -> 11.2.3, `multer` 2.1.1 -> 2.2.0 |
| `typeorm` | 직접 의존성 | `migration:generate`에 전달한 악의적 입력의 코드 주입 가능성 | 0.3.30 -> 0.3.31 |
| `brace-expansion` | TypeORM 및 Jest/ESLint 전이 의존성 | 특수 패턴 처리의 CPU/메모리 DoS | 2.1.1 -> 2.1.4, 5.0.7 -> 5.0.9 등 |
| `browserslist`, `fast-uri`, `js-yaml` | Webpack/ESLint/Jest 등 개발 의존성 | 빌드/테스트 환경의 메모리, URI 처리, YAML 파싱 위험 | 각각 패치 버전으로 갱신 |

`multer`, `typeorm`, TypeORM 하위 `brace-expansion`은 배포된 서버 또는
마이그레이션 CLI가 로드할 수 있으므로 운영 우선순위다. 나머지는 개발 의존성
중심이지만 CI가 외부 PR이나 신뢰할 수 없는 입력을 처리한다면 함께 수정해야 한다.

권장 절차는 아래와 같다. `--force`는 필요하지 않으며 사용하지 않는다.

```bash
git status --short
npm audit fix
git diff -- package.json package-lock.json
npm audit
npm test
npm run build
```

정상 결과는 `package-lock.json`에 패치 버전이 기록되고 `npm audit`가 0건을
보고하는 것이다. `package.json`의 `^` 범위가 이미 업데이트를 허용하므로,
이 조치는 API 메이저 버전을 올리지 않는다. 테스트 또는 빌드 실패가 발생하면
잠금 파일 변경을 유지한 채 실패 패키지의 릴리스 노트와 직접 의존성 호환성을
검토한 후 별도 수정한다.

## 6. 권장 운영 절차

개발자는 `.env.example`을 `.env`로 복사해 로컬 값만 채우고, 실제 RDS 정보와
JWT 비밀값은 추적하지 않는다. 공유/운영 환경은 Secrets Manager에서 환경 변수로
주입하고, 배포 전 `migration:show`로 상태를 확인한 뒤 마이그레이션을 먼저
실행한다.

```bash
npm ci
npm run build
npx jest --runInBand
npm run migration:show
npm run migration:run
npm run pm2:reload
curl -fsS http://localhost:${PORT:-3000}/health
```

현재 `/health`는 DB 상태가 `down`이어도 HTTP 200과 `status: ok`를 반환한다.
외부 로드밸런서의 readiness 판단에 사용하기 전에는 P1의 `/ready` 분리와
상태 코드 정책을 적용해야 한다.

## 7. 결론

이 프로젝트는 환경 변수 검증, 마이그레이션 우선 원칙, 포트-어댑터 기반의
소셜 인증, 전역 요청 검증/보안 미들웨어라는 좋은 기반을 갖췄다. 가장 중요한
다음 단계는 의존성 설치 재현성을 CI에서 강제하고, 음악 도메인의 공용 편집 또는
개인 소유 모델을 명확히 하여 인가를 구현하는 것이다. 그 다음으로 격리된 DB E2E,
로그/추적, readiness와 graceful shutdown을 보강하면 실무 운영 기준에 가까워진다.