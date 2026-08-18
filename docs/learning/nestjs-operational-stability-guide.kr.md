# NestJS 운영 안정성 개편 학습 가이드

이 문서는 이 저장소의 개편 내용을 NestJS 학습 관점에서 따라 읽기 위한
가이드입니다. 단순히 “무엇을 바꿨는가”보다 “왜 그렇게 나눴는가”, “NestJS에서
어떤 개념으로 이해하면 되는가”에 초점을 둡니다.

## 1. 학습 목표

이 가이드를 읽고 나면 다음을 설명할 수 있어야 합니다.

- `AppModule`과 `main.ts`가 각각 어떤 책임을 가지는지
- `ConfigModule`의 `validate`가 운영 안정성에 왜 중요한지
- Controller, Service, Provider, Module을 어떻게 나눠야 하는지
- Interceptor와 Exception Filter가 HTTP 공통 관심사를 어떻게 분리하는지
- 인증 응답에서 `password`를 안전하게 제거하는 방법
- Google 로그인처럼 외부 API가 있는 기능을 port/adapter 구조로 분리하는 이유
- 테스트, 빌드, lint를 운영 안정성의 최소 품질 게이트로 보는 방법

## 2. 전체 구조 먼저 보기

현재 핵심 구조는 다음과 같습니다.

```text
src/
  app.module.ts
  main.ts
  config/
    app-env.ts
  common/
    auth/
    http/
    request-id/
  auth/
    auth.controller.ts
    auth.service.ts
    google/
      application/
      domain/
      infrastructure/
      interface/
  users/
    dto/
    entities/
    users.controller.ts
    users.service.ts
  music/
    music.controller.ts
    music.service.ts
    services/
    dto/
    entities/
```

크게 보면 세 층으로 이해하면 편합니다.

- 애플리케이션 조립: `app.module.ts`, `main.ts`
- 공통 운영 기반: `config/`, `common/`
- 도메인 기능: `auth/`, `users/`, `music/`

NestJS 프로젝트를 볼 때는 먼저 `main.ts`와 `app.module.ts`를 읽으면 전체 앱이
어떻게 시작되고 어떤 모듈이 연결되는지 빠르게 감이 잡힙니다.

## 3. Bootstrap: `main.ts`

`main.ts`는 Nest 애플리케이션을 실제 HTTP 서버로 띄우는 진입점입니다.

현재 `main.ts`에서 눈여겨볼 부분은 다음입니다.

- `NestFactory.create(AppModule)`로 루트 모듈을 부트스트랩합니다.
- `helmet()`으로 기본 HTTP 보안 헤더를 활성화합니다.
- `ConfigService`에서 `CORS_ORIGIN`, `PORT`를 읽습니다.
- `ValidationPipe`를 전역으로 적용합니다.

전역 `ValidationPipe` 설정은 특히 중요합니다.

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
})
```

- `whitelist`: DTO에 선언되지 않은 필드를 제거합니다.
- `forbidNonWhitelisted`: 선언되지 않은 필드가 들어오면 400 에러를 냅니다.
- `transform`: query/path/body 값을 DTO 타입에 맞게 변환하려고 시도합니다.

즉, Controller마다 검증을 반복하지 않고 앱 전체에 같은 입력 정책을 적용합니다.

## 4. Module 조립: `AppModule`

`AppModule`은 앱의 루트 DI 컨테이너 구성입니다.

현재 중요한 구성은 다음입니다.

- `ConfigModule.forRoot(...)`
- `TypeOrmModule.forRootAsync(...)`
- `ThrottlerModule.forRootAsync(...)`
- `UsersModule`, `AuthModule`, `AuthGoogleModule`, `MusicModule`

여기서 `forRootAsync`는 설정값이 런타임 환경변수에 의존할 때 자주 씁니다.
예를 들어 DB 연결은 `ConfigService`에서 값을 읽어야 하므로 비동기 factory로
구성합니다.

```ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    ...
  }),
  inject: [ConfigService],
})
```

학습 포인트는 “설정은 한 곳에서 읽고, 필요한 모듈에 주입한다”입니다. 코드 곳곳에서
`process.env`를 직접 읽기 시작하면 테스트와 운영 검증이 어려워집니다.

## 5. 환경변수 검증: `src/config/app-env.ts`

운영 안정성 개편에서 가장 중요한 축 중 하나가 환경변수 검증입니다.

`validateAppEnv`는 앱 시작 전에 환경변수를 파싱하고, 위험한 설정이면 바로 실패시킵니다.

현재 검증하는 대표 규칙은 다음입니다.

- `JWT_SECRET`은 필수입니다.
- `GOOGLE_ALLOWED_AUDIENCES`는 필수입니다.
- `DB_TYPE`은 `postgres`만 허용합니다.
- `PORT`, `DB_PORT`, `THROTTLE_TTL`, `THROTTLE_LIMIT`는 정수로 파싱합니다.
- `DB_SYNCHRONIZE`는 boolean으로 파싱합니다.
- `NODE_ENV=production`이면 `CORS_ORIGIN`이 반드시 있어야 합니다.
- `NODE_ENV=production`이면 `DB_SYNCHRONIZE=true`를 차단합니다.
- production에서 placeholder JWT secret을 차단합니다.

이 방식의 장점은 서버가 잘못된 설정으로 “어찌어찌 떠버리는” 상황을 줄인다는 점입니다.
운영에서는 늦게 실패하는 것보다 시작 시점에 빠르게 실패하는 편이 더 안전합니다.

학습할 때는 `src/config/app-env.spec.ts`를 같이 보면 좋습니다. 설정 검증은
비즈니스 로직만큼 테스트 가치가 큽니다.

## 6. 공통 관심사: `src/common`

`common` 폴더에는 여러 기능이 공유하는 HTTP/인증 보조 코드가 들어갑니다.

현재 들어간 공통 관심사는 세 가지입니다.

- `common/http/api-response.ts`: `{ ok, requestId, data }` 응답 helper
- `common/request-id/*`: `x-request-id` 생성/반영
- `common/auth/authenticated-request.ts`: JWT 인증 후 request 타입

공통 코드를 만들 때의 기준은 “두 개 이상의 기능에서 반복되거나, 프레임워크 경계에
놓인 정책인가?”입니다. request id는 Google auth만의 도메인 지식이 아니므로
`auth/google` 내부가 아니라 `common`으로 옮기는 편이 맞습니다.

## 7. Interceptor: Request ID 처리

`RequestIdInterceptor`는 요청마다 request id를 정하고 응답 헤더에 넣습니다.

흐름은 다음과 같습니다.

1. 요청 헤더의 `x-request-id`를 확인합니다.
2. 없으면 `RequestIdService`가 새 id를 생성합니다.
3. request 객체에 `requestId`를 저장합니다.
4. 응답 헤더에도 `x-request-id`를 씁니다.
5. 다음 handler로 요청을 넘깁니다.

Interceptor는 Controller 전후의 공통 흐름을 다룰 때 좋습니다. 로깅, request id,
응답 변환, 성능 측정 같은 기능이 대표적입니다.

## 8. Exception Filter: Google Auth 에러 처리

`GoogleAuthExceptionFilter`는 `GoogleAuthError`를 HTTP 응답으로 바꿉니다.

예전 방식은 Controller가 `try/catch`와 `@Res()`를 직접 들고 있었습니다. 이러면
Controller가 너무 많은 일을 합니다.

개편 후 책임은 이렇게 나뉩니다.

- Controller: DTO를 use-case 입력으로 바꾸고 결과를 반환
- Use-case: 인증 흐름을 수행하고 도메인 에러를 던짐
- Exception Filter: 도메인 에러를 HTTP status와 error envelope로 변환
- Interceptor: request id 헤더 처리

NestJS에서는 Controller를 얇게 유지할수록 테스트와 유지보수가 쉬워집니다.

## 9. Local Auth와 Public User Mapper

`users`와 `auth`에서 중요한 보안 규칙은 “응답에 `password`를 절대 노출하지 않는다”입니다.

이를 위해 `src/users/dto/public-user.dto.ts`에 `PublicUser`와 `toPublicUser`를 둡니다.

```ts
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    provider: user.provider,
    googleId: user.googleId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
```

이전처럼 Controller마다 구조분해로 `password`를 빼면 실수하기 쉽습니다. mapper를
하나 두면 “공개 가능한 사용자 형태”가 코드로 고정됩니다.

읽어볼 파일:

- `src/auth/auth.service.ts`
- `src/auth/strategies/jwt.strategy.ts`
- `src/users/users.controller.ts`
- `src/users/dto/public-user.dto.ts`
- `src/auth/auth.service.spec.ts`
- `src/users/users.controller.spec.ts`

## 10. Google Auth: Port/Adapter 구조

Google 로그인은 외부 서비스, 토큰 검증, 사용자 upsert, JWT 발급이 엮여 있습니다.
이런 기능은 단순 Service 하나에 모두 넣으면 테스트가 어려워집니다.

현재 구조는 다음처럼 나뉩니다.

```text
auth/google/
  domain/          순수 타입과 도메인 에러
  application/     use-case와 port
  infrastructure/  Google API, TypeORM, JWT 구현체
  interface/       HTTP controller, DTO, exception filter
```

핵심은 application layer가 구체 구현을 직접 모르도록 하는 것입니다.

예를 들어 `GoogleLoginUseCase`는 “Google 토큰 검증”이 필요하다는 사실만 알고,
실제 구현이 `google-auth-library`인지 mock인지 알지 않습니다.

```text
GoogleLoginUseCase
  -> GoogleTokenVerifierPort
  -> SocialUserRepositoryPort
  -> SessionIssuerPort
```

이 구조 덕분에 use-case 테스트는 Google 서버나 DB 없이도 작성할 수 있습니다.

읽어볼 파일:

- `src/auth/google/application/use-cases/google-login.use-case.ts`
- `src/auth/google/application/ports/*.ts`
- `src/auth/google/infrastructure/google-oauth-client.adapter.ts`
- `src/auth/google/infrastructure/social-user-typeorm.adapter.ts`
- `src/auth/google/interface/auth-google.controller.ts`
- `src/auth/google/interface/google-auth-exception.filter.ts`

## 11. Music: Facade Service와 내부 서비스 분리

Music API는 외부 라우트를 유지하면서 내부 책임을 나눴습니다.

```text
MusicController
  -> MusicService
       -> TracksService
       -> PlaylistsService
       -> PlaylistTracksService
```

`MusicService`는 기존 Controller API를 유지하기 위한 facade 역할을 합니다.
Controller 입장에서는 여전히 `musicService.createTrack(...)`처럼 호출하지만,
실제 책임은 더 작은 서비스로 분리됩니다.

이 방식의 장점:

- 기존 라우트와 Controller 코드를 크게 흔들지 않습니다.
- track, playlist, playlist-track 로직을 따로 테스트/수정하기 쉬워집니다.
- 한 Service가 너무 많은 repository를 직접 다루는 상황을 줄입니다.

읽어볼 파일:

- `src/music/music.controller.ts`
- `src/music/music.service.ts`
- `src/music/services/tracks.service.ts`
- `src/music/services/playlists.service.ts`
- `src/music/services/playlist-tracks.service.ts`
- `src/music/music.service.spec.ts`

## 12. DTO와 Entity 구분

NestJS + TypeORM 프로젝트에서 자주 헷갈리는 점입니다.

- Entity: DB 테이블 구조와 ORM 관계를 표현합니다.
- DTO: HTTP 요청/응답의 입력 계약을 표현합니다.
- Mapper: Entity를 외부에 공개 가능한 형태로 바꿉니다.

Entity를 그대로 응답해도 동작은 하지만, 운영 프로젝트에서는 조심해야 합니다.
비밀번호, 내부 상태, 관계 객체가 의도치 않게 노출될 수 있기 때문입니다.

이 저장소에서는 사용자 응답에 대해 `PublicUser` mapper를 먼저 적용했습니다. Music
응답도 확장된다면 같은 방식으로 response DTO/mapper를 추가하는 것이 다음 단계입니다.

## 13. 의존성 정리의 의미

이번 개편에서는 직접 사용하지 않는 의존성을 제거했습니다.

- Prisma 관련 패키지
- argon2
- mysql
- 직접 uuid 의존성

운영 안정성 관점에서 의존성이 적다는 것은 다음 의미가 있습니다.

- 설치 시간이 짧아집니다.
- 보안 취약점 표면이 줄어듭니다.
- “이 프로젝트가 실제로 무엇을 쓰는지” 이해하기 쉬워집니다.
- lockfile 변경과 배포 이미지 크기를 줄일 수 있습니다.

TypeORM 내부 transitive dependency로 lockfile에 남는 항목은 있을 수 있습니다. 중요한
것은 `package.json`의 직접 의존성과 코드 import가 현재 기술 선택과 일치하는지입니다.

## 14. 품질 게이트

현재 최소 검증 명령은 세 가지입니다.

```bash
npm test -- --runInBand
npm run build
npx eslint "src/**/*.ts" "test/**/*.ts"
```

각각의 역할은 다릅니다.

- test: 기능이 기대대로 동작하는지 확인합니다.
- build: TypeScript/NestJS 컴파일이 가능한지 확인합니다.
- lint: 포맷, 타입 안정성, 위험한 코드 패턴을 확인합니다.

특히 이번 개편 전에는 test와 build는 통과했지만 비수정 ESLint는 실패했습니다.
운영 안정성을 높이려면 “테스트만 통과”보다 “테스트 + 빌드 + lint 통과”를 기본
완료 조건으로 잡는 편이 좋습니다.

## 15. 추천 학습 순서

처음부터 모든 파일을 읽으려고 하면 흐름이 흐려질 수 있습니다. 아래 순서로 읽어보세요.

1. `src/main.ts`
2. `src/app.module.ts`
3. `src/config/app-env.ts`
4. `src/common/request-id/request-id.interceptor.ts`
5. `src/auth/google/interface/auth-google.controller.ts`
6. `src/auth/google/interface/google-auth-exception.filter.ts`
7. `src/auth/google/application/use-cases/google-login.use-case.ts`
8. `src/users/dto/public-user.dto.ts`
9. `src/music/music.service.ts`
10. `src/music/services/*.ts`

각 파일을 읽을 때 질문을 하나씩 던지면 좋습니다.

- 이 파일의 책임은 한 문장으로 무엇인가?
- NestJS DI가 어디에서 쓰이는가?
- 이 코드가 직접 알아야 하는 것과 몰라도 되는 것은 무엇인가?
- 테스트는 이 책임을 어떻게 검증하는가?

## 16. 실습 과제

아래 과제는 현재 구조를 더 익히는 데 도움이 됩니다.

### 과제 1: 환경변수 검증 추가

`JWT_EXPIRES_IN`이 빈 문자열이 아니고 `1h`, `3600`, `15m` 같은 형태만 허용되도록
검증을 추가해보세요. 그리고 spec에 실패/성공 케이스를 추가하세요.

### 과제 2: Music 응답 DTO 추가

`getTracksOfPlaylist` 응답을 별도 response DTO 또는 mapper로 분리해보세요.
현재는 service 안에서 응답 shape를 직접 만들고 있습니다.

### 과제 3: Google Redirect URI 테스트

`GoogleOAuthClientAdapter`의 redirect URI allow-list 검증을 단위 테스트로 분리해보세요.
외부 Google 호출을 직접 하지 않도록 mock boundary를 어디에 둘지 고민해보는 과제입니다.

### 과제 4: E2E 테스트 보강

`/health`, `/auth/login`, `/users/register`의 e2e 테스트를 추가해보세요. 실제 DB가
필요한 테스트와 mock으로 충분한 테스트의 차이를 구분하는 연습이 됩니다.

## 17. 기억할 원칙

- Controller는 얇게 유지합니다.
- 설정은 앱 시작 시 검증합니다.
- 비밀번호와 토큰은 응답/로그에 노출하지 않습니다.
- 외부 API는 port/adapter로 경계를 만듭니다.
- 공통 관심사는 interceptor/filter/module로 분리합니다.
- 기존 API를 유지하면서 내부 구조를 개선할 수 있습니다.
- 완료 조건은 test, build, lint 통과까지 포함합니다.
