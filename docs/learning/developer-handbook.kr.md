# 개발자가 혼자 이어서 작업하기 위한 실무 안내서

> 최신화 기준: 2026-11-17 · develop `82bb4f1` + 주석·문서 작업 트리
> 기준은 저장소의 코드와 설정입니다. 실제 서버의 배포 상태, DB 내용, 백업 성공 여부는 확인하지 않았습니다.

이 문서는 프로젝트를 처음 인수한 담당자가 **환경을 준비하고, 요청을 추적하고, 기능을 변경하고, 검증·배포·복구하는 순서**를 설명합니다. 세부 API와 운영 명령은 링크한 문서를 함께 읽습니다. 계획이나 과거 감사에서 제안한 기능이 현재 구현되었다고 가정하지 마세요.

## 1. 먼저 알아야 할 범위

| 기능 | 현재 구현 | 자세한 설명 |
| --- | --- | --- |
| 계정 | 로컬 가입·로그인, JWT, 프로필, `user`/`admin` | [기능 명세](../product/features.kr.md), [보안 가이드](api-security-guide.kr.md) |
| SNS | Google·Apple·Kakao·Naver·Facebook 코드가 있으나 기본 비활성 | [재활성화 체크리스트](../auth/sns-reenable-checklist.kr.md) |
| 음악 | Legacy와 Catalog가 공존, 관리자 업로드·사용 기록, 공개 재생 | [음악 실습](../music/implementation-workbook.kr.md), [음악 API](../music/api.kr.md) |
| 사전 | 초안·검수·게시 및 게시된 어휘 검색 | [사전 실습](dictionary-implementation-workbook.kr.md), [사전 API](../api/API_SPEC.md) |
| 제공하지 않는 것 | refresh token, 사전 import·학습, S3 재생, Legacy 자동 이관 등 | 각 기능 문서의 미구현 범위 |

Node 버전은 [`.nvmrc`](../../.nvmrc), 실제 의존성과 명령은 [`package.json`](../../package.json), DB의 변경 이력은 [`migrations/`](../../src/database/migrations/)이 기준입니다. 현재 `.nvmrc`는 Node 24, `engines`는 Node 22.13 이상, CI의 MariaDB는 10.11입니다. 운영 서버도 같은 버전이라는 뜻은 아닙니다.

## 2. 소스 지도를 읽는 법

| 경로 | 책임 | 변경 시 같이 확인할 곳 |
| --- | --- | --- |
| [`main.ts`](../../src/main.ts) | HTTP 서버, 보안 헤더, CORS, 입력 검증, Swagger | 프록시 설정, DTO, 클라이언트 origin |
| [`app.module.ts`](../../src/app.module.ts) | 설정·DB·기능 모듈과 전역 guard/filter/interceptor 조립 | 새 모듈 등록, 공통 동작 테스트 |
| [`config/`](../../src/config/) | env 파일 선택, 파싱, 설정 검증 | [환경변수 목록](../../scripts/runtime-env-keys.cjs), 예제 파일, 설정 테스트 |
| [`common/`](../../src/common/) | 오류 매핑, 요청 ID, provider 활성화 검사 | 오류 응답과 로그의 민감정보 마스킹 |
| [`users/`](../../src/users/) | 사용자, 비밀번호, SNS 계정 연결 | 사용자 DTO, DB unique, 세션 무효화 |
| [`auth/`](../../src/auth/) | 로컬/SNS 로그인과 공통 JWT·역할 검사 | provider 설정, guard, 비활성 경로 |
| [`database/`](../../src/database/) | TypeORM 설정, DB 점검, migration | entity, `APP_TABLES`, 환경별 명령 |
| [`music/`](../../src/music/) | Legacy와 Catalog, 저장 파일, 사용 통계 | 공개 presenter, 접근 권한, 파일 백업 |
| [`dictionary/`](../../src/dictionary/) | 사전 관리와 공개 조회 | revision·publication·감사 기록의 일관성 |
| [`test/`](../../test/) | 실제 MariaDB가 필요한 E2E | 격리 DB와 테스트의 쓰기 범위 |
| [`admin-prototype/`](../../admin-prototype/) | 음악 관리자 웹 초안 | API 주소, CORS, 브라우저 메모리의 토큰 |

### 계층과 의존성

Users와 Legacy Music은 대체로 `interface → application → port ← infrastructure`입니다. Controller는 HTTP와 DTO를 처리하고, use-case는 업무 규칙을 실행하며, adapter는 TypeORM이나 bcrypt를 사용합니다. 예를 들어 [`UsersModule`](../../src/users/users.module.ts)은 `USER_REPOSITORY_PORT`를 기존 `UserTypeOrmRepository` 인스턴스에 연결합니다. 테스트에서는 포트 구현을 교체할 수 있습니다.

모든 모듈이 같은 구조는 아닙니다. 사전 서비스는 `DataSource`와 `EntityManager`를 직접 사용하고, Catalog Music은 일부 repository port와 TypeORM repository를 함께 사용합니다. 새 작업을 할 때 실제 모듈의 경계를 먼저 확인하고, 모든 코드를 같은 계층으로 포장했다고 가정하지 않습니다.

## 3. 요청 한 건을 끝까지 추적하기

일반적인 컨트롤러 요청의 순서는 다음과 같습니다.

```text
Express/Helmet/CORS
 → 전역 ThrottlerGuard, ProviderReadinessGuard
 → 라우트의 JwtAuthGuard → RolesGuard(필요한 경우)
 → RequestIdInterceptor 진입 → ValidationPipe → Controller
 → service/use-case → repository/adapter → MariaDB
 → Controller 응답 → interceptor 복귀 → HTTP 응답

실패 → 해당 예외 필터 → HTTP 오류 응답과 x-request-id
```

Guard는 interceptor보다 먼저 실행됩니다. 따라서 guard가 거부한 요청은 [`GlobalExceptionFilter`](../../src/common/filters/global-exception.filter.ts)가 요청 ID를 직접 해석합니다. 유효한 `x-request-id`는 재사용하고, 유효하지 않으면 새 UUID를 만듭니다.

`ValidationPipe`는 DTO에 없는 필드를 400으로 거부합니다. `transform: true`는 DTO 인스턴스를 만들지만 모든 문자열이 자동으로 원하는 타입이 된다는 뜻은 아닙니다. 예를 들어 query 숫자는 DTO의 `@Type(() => Number)`를 확인합니다.

**성공 응답은 전 API에서 동일하지 않습니다.** 사전 API는 `{ ok, requestId, data }`를 명시적으로 만들고, 계정·음악 API는 각 컨트롤러의 객체 또는 배열을 반환합니다. 오류는 공통 필터 또는 SNS 전용 필터가 `{ ok: false, requestId, errorCode, message }`로 변환합니다. 음악 파일 응답은 JSON이 아니라 스트림입니다. 응답 형태를 바꾸기 전에 해당 API 문서와 클라이언트를 함께 확인하세요.

### 직접 추적할 예: 프로필 비밀번호 변경

1. [`UsersController`](../../src/users/interface/users.controller.ts)의 `PATCH /users/profile`과 `@Authenticated()`를 찾습니다.
2. [`JwtStrategy`](../../src/auth/session/interface/jwt.strategy.ts)가 토큰 서명·만료를 검증한 뒤 DB에서 사용자를 다시 읽고 `sv`를 비교합니다.
3. [`UpdateUserUseCase`](../../src/users/application/use-cases/update-user.use-case.ts)는 기존 비밀번호가 있는 계정에 `currentPassword`를 요구합니다. SNS 전용 계정의 최초 설정은 예외입니다.
4. 새 비밀번호를 bcrypt로 해시하고 `sessionVersion`을 올립니다. **현재 요청의 토큰을 포함한 이전 토큰은 다음 요청부터 거부**됩니다.
5. [`PublicUser` presenter](../../src/users/interface/presenters/public-user.presenter.ts)가 반환 필드를 선택합니다. 해시는 응답에 넣지 않습니다.
6. [use-case 테스트](../../src/users/application/use-cases/update-user.use-case.spec.ts)와 [JWT 테스트](../../src/auth/session/interface/jwt.strategy.spec.ts)에서 성공·실패 조건을 확인합니다.

## 4. 안전하게 개발 환경 만들기

### 4.1 설치와 설정

1. 별도의 개발 작업 디렉터리와 승인된 **전용 개발 DB**를 준비합니다. 기존 운영·공유 DB를 테스트 대상으로 사용하지 않습니다.
2. Node 버전을 맞추고 `npm ci`를 실행합니다. `npm ci`는 `node_modules`를 다시 설치하므로 다른 실행 프로세스와 공유하지 않는 작업 디렉터리에서 실행합니다.
3. [`.env.example`](../../.env.example)을 참고해 `.env`를 만들고 권한을 제한합니다. 이미 파일이 있으면 덮어쓰지 않습니다. 실제 비밀번호와 JWT secret은 문서·터미널 기록·커밋에 남기지 않습니다.
4. [`환경별 DB 안내`](../deployment/database-environments.kr.md)의 권한, TLS, DB 이름과 설정을 확인합니다. 환경에 필요한 키를 기입하고, 개발·테스트·운영 계정과 DB를 분리합니다.
5. **대상 확인 후** `npm run db:check`로 연결·권한·소유·적용 대기 migration을 읽습니다. 개발 DB가 이 앱 전용인지 별도로 확인한 뒤에만 `npm run db:setup`을 실행합니다. 이 명령은 DB 생성 및 migration 적용을 수행합니다.
6. `npm run start:dev`로 실행합니다. 개발 템플릿에서 Swagger를 켰다면 `/api-docs`를 사용합니다. Swagger는 명시적으로 켜야 하며 production에서는 켤 수 없습니다.

환경 선택은 [`env-files.ts`](../../src/config/env-files.ts)의 규칙을 따릅니다.

| 명령 환경 | 기본 파일 | 중요한 조건 |
| --- | --- | --- |
| development | `.env` | 기본값 |
| test | `.env.test.local` | 기본 파일이 없으면 실패 |
| production | `.env.production` | production 비밀값·CORS 등 추가 검증 |

`ENV_FILE`은 읽을 파일을 교체하고 **셸에 이미 있는 환경변수가 파일보다 우선**합니다. `DATABASE_URL`이 있으면 실제 연결의 host·DB 등이 개별 DB 값보다 우선합니다. 특히 `DB_DATABASE` 이름만 보고 안전한 대상이라고 판단하지 마세요. 설정의 유효 값은 비밀을 출력하지 않는 방법으로 운영자가 확인합니다.

`DB_SYNCHRONIZE=true`는 모든 환경에서 거부됩니다. `APP_TABLES` 기반 소유 검사는 **DB 계정에 보이는 객체만** 검사하므로, 전용 DB 여부와 계정 권한을 대신 보증하지 않습니다. Role로 부여된 권한은 점검기가 정확히 판정하지 못할 수 있습니다.

### 4.2 테스트 DB는 별도로 격리

[`test/e2e-env.ts`](../../test/e2e-env.ts)는 `NODE_ENV=test`를 설정하고 테스트 파일을 읽지만, E2E는 실제 DB에 연결합니다. 사전·음악 관리·동시성 테스트는 사용자와 콘텐츠를 만들고 publication을 바꾸며 자동 정리하지 않습니다. `ISOLATED_DATABASE_E2E=true`를 지정하지 않으면 이 세 묶음은 **skip**됩니다.

1. 개인용 일회성 로컬 MariaDB와 다른 작업자가 쓰지 않는 `*_test` DB를 준비합니다. 이름이 `*_test`이거나 host가 `localhost`인 것만으로 일회성이라는 증거는 아닙니다.
2. 별도 env 파일을 안전하게 만들고 `DB_*`뿐 아니라 `DATABASE_URL` 및 상속된 셸 환경변수를 확인합니다. 프로세스에 다른 대상 설정이 남아 있으면 우선 적용될 수 있습니다.
3. 아래 경로는 **준비한 파일의 절대 경로로 바꾼 뒤**, 대상과 권한을 재확인하고 실행합니다.

```bash
ENV_FILE=/absolute/path/to/isolated-test.env npm run db:check:test
ENV_FILE=/absolute/path/to/isolated-test.env npm run db:setup:test
ENV_FILE=/absolute/path/to/isolated-test.env ISOLATED_DATABASE_E2E=true npm run test:e2e -- --runInBand
```

`db:setup:test`은 스키마를 변경합니다. `db:reset:test`는 대상 DB를 **삭제 후 재생성**하므로 버려도 되는 DB임을 확인하기 전에는 실행하지 않습니다. `test/app.e2e-spec.ts`는 opt-in 여부와 관계없이 DB 연결이 필요합니다. 테스트가 skip되었는지와 실제 실행 건수를 결과에서 확인하세요.

## 5. 인증과 권한을 변경할 때

- 가입: [`CreateUserUseCase`](../../src/users/application/use-cases/create-user.use-case.ts)가 예약된 SNS username 접두사와 중복을 검사합니다. 경쟁 요청은 DB unique 제약도 확인합니다.
- 비밀번호: 새 비밀번호는 최소 8자, UTF-8 72바이트 이하입니다. bcrypt가 그 이후 바이트를 무시하기 때문입니다. 로그인 실패 시 계정 유무와 무관하게 bcrypt 비교를 수행합니다.
- 로그인: IP 제한과 계정별 실패 제한은 별개입니다. 계정 제한은 현재 프로세스 메모리의 15분 고정 창에 10회이며, 재시작 또는 여러 인스턴스에 공유되지 않습니다.
- JWT: 서명 알고리즘은 HS256으로 제한됩니다. 역할은 토큰의 주장에 의존하지 않고 매 요청 DB에서 다시 읽습니다. `@Authenticated()`는 인증, `@AdminOnly()`는 인증 뒤 `admin` 역할까지 검사합니다.
- SNS: provider 플래그가 꺼져 있으면 경로 문자열이 아니라 컨트롤러 메타데이터로 503을 반환합니다. 같은 이메일만으로 로컬 계정과 SNS 계정을 합치지 않습니다. `state` 검증을 서버의 클라이언트 제공 값 비교에만 맡기지 말고 클라이언트 세션에서도 수행합니다.
- 프록시: `TRUST_PROXY`는 **실제로 신뢰하는 프록시 경로**에 맞춰 지정합니다. 잘못 신뢰하면 클라이언트 IP와 IP 기반 제한이 왜곡됩니다.

실제 경계와 부정 사례는 [API 보안 가이드](api-security-guide.kr.md)와 [SNS 운영 가이드](sns-login-operational-guide.kr.md)를 참고합니다.

## 6. 스키마를 포함한 기능 변경 절차

예를 들어 관리자만 편집하는 새 데이터를 추가할 때:

1. 먼저 공개/관리자 API, 필수 여부, 기존 데이터 처리, 권한, 오류, 롤백을 정합니다. 기존 사용자에게 보이는 응답이나 권한을 임의로 바꾸지 않습니다.
2. Controller의 DTO·Swagger 응답과 입력 검증을 정하고, 필요한 guard를 적용합니다. 민감한 필드는 entity를 그대로 반환하지 말고 presenter에서 허용된 필드만 선택합니다.
3. 기존 모듈의 service/use-case와 adapter를 따라 규칙을 구현합니다. 동시 수정이 가능한 경우 DB 제약, 트랜잭션, 잠금 및 실패 응답을 함께 설계합니다.
4. Entity와 **새 migration**을 작성합니다. 기존에 배포된 migration을 편집하지 않습니다. 새 테이블은 [`APP_TABLES`](../../src/database/database-admin.ts)에도 추가합니다.
5. `migration:generate`는 현재 DB와 entity의 차이 전체를 제안합니다. 현재 알려진 drift가 있으므로 생성 결과를 무조건 적용하지 말고 의도한 변경만 남겼는지 SQL을 검토합니다. 삭제/이름 변경은 expand → 배포 → contract로 나눕니다.
6. 단위 테스트에 정상·실패·경합 등 새 규칙을 추가합니다. DB 제약·트랜잭션이 핵심이면 격리 MariaDB E2E에서도 검증합니다. Swagger, API 문서, 환경 템플릿, 예제와 호출자도 함께 갱신합니다.
7. 개발·테스트에서 기존 데이터와 빈 DB 양쪽을 확인합니다. 운영에서는 백업과 복원 방법을 확인하고, pending 확인 → migration → 앱 배포 → health/API 확인 순서로 진행합니다.

새 환경변수를 도입할 때는 [`AppEnv`](../../src/config/app-env.ts)의 타입과 파싱·검증, 예제 env 파일, [`runtime-env-keys.cjs`](../../scripts/runtime-env-keys.cjs), 관련 테스트와 배포 문서를 함께 수정합니다. 단, 기존 `MUSIC_STORAGE_DIR`은 이 경로에서 빠져 있는 예외이므로 [음악 실습의 설정 주의](../music/implementation-workbook.kr.md)를 먼저 읽으세요.

## 7. 검증 명령과 결과 해석

코드만 확인하는 명령은 보통 DB 접속이 필요하지 않습니다. 다른 프로세스와 공유하지 않는 작업 디렉터리에서 실행합니다.

```bash
npm run lint:check
npm run format:check
npm run typecheck
npx jest --ci --runInBand
npm run docs:html:verify
npm run build
```

`build`는 `dist/`를 갱신하므로 실행 중인 서비스가 같은 디렉터리를 사용한다면 별도 체크아웃에서 실행합니다. `lint`와 `format`은 파일을 수정하고, 위의 `:check` 명령은 검사만 합니다. 테스트 결과의 실패·skip 수를 모두 확인합니다.

CI의 `verify` job은 위 검사와 production 의존성 critical audit를 실행합니다. `database` job은 빈 MariaDB에 migration을 적용하고 최신 migration을 revert한 뒤 재적용하도록 작성되어 있습니다. **현재 최신 `AddMusicManagement1768000000000.down()`은 항상 실패하도록 구현되어 있어 이 단계와 양립하지 않습니다.** 따라서 해당 job이 끝까지 통과했다고 가정하지 말고 CI 결과를 확인하며, 담당자가 백업 복원 정책과 CI 검증 방식을 결정해야 합니다. Drift 검사는 현재 `continue-on-error`입니다.

## 8. 배포·장애·복구

1. [배포 가이드](../deployment/mariadb-systemd.kr.md)의 대상·환경·권한을 확인하고, DB와 로컬 음원 파일을 같은 복구 시점으로 백업합니다.
2. 백업을 별도 저장소에 보관하고 **격리된 환경에서 복원**해 schema/migration 상태, 사전 publication, 사용자 접근, 음악 메타데이터와 파일 재생을 검증합니다. 복원 성공은 백업 파일이 존재한다는 사실만으로 증명되지 않습니다.
3. 배포 전에 `env:check:prod`, `db:check:prod`, `migration:show:prod`로 설정과 pending을 확인합니다. 변경 승인과 백업 확인 후 migration을 실행하고 앱을 재시작합니다.
4. `/health`와 `/api/v1/health/ready`는 DB 연결을 확인하며, `/api/v1/health/live`는 프로세스 생존만 확인합니다. 새 API의 정상·권한 거부·오류 응답도 점검합니다.
5. 장애가 나면 추가 쓰기를 멈추고 로그의 request ID로 추적합니다. **최신 음악 관리 migration은 revert할 수 없습니다.** 무조건 `migration:revert:prod`를 실행하지 말고 이전 앱과 DB의 호환성, 복원 대상과 승인 절차를 확인합니다.

복구 시점 목표와 실제 백업 인프라는 미확정입니다. [백업·복구 계획](../operations/BACKUP_RECOVERY.md)은 제안과 운영 검증 항목을 구분합니다.

## 9. 자주 만나는 용어와 점검 질문

| 용어 | 뜻 |
| --- | --- |
| Port / adapter | 업무 코드가 필요로 하는 기능의 약속 / TypeORM·외부 API 등 실제 구현 |
| Migration / drift | 스키마 변경 이력 / entity 정의와 실제 스키마의 차이 |
| Authentication / authorization | 누구인지 확인 / 그 사용자가 작업할 권한이 있는지 확인 |
| Revision / publication | 사전 어휘의 버전 / 공개할 revision들의 스냅샷 |
| Snapshot | 나중에 원본이 바뀌어도 당시 내용을 확인하기 위한 복사본 |
| Pessimistic lock | 트랜잭션이 특정 행을 잠가 경쟁 작업을 기다리게 하는 방식 |
| Cursor | 다음 페이지를 이어 읽기 위한 불투명 값. 서명이나 권한 증명은 아님 |

혼자 확인해 보세요.

1. 일반 사용자가 음악 쓰기 요청을 했을 때 어떤 guard가 401과 403을 각각 결정하나요?
2. 비밀번호 변경 직후 기존 JWT와 이후 새 JWT는 어떻게 달라지나요?
3. 사전 초안을 수정해도 공개 데이터가 바로 바뀌지 않는 이유는 무엇인가요?
4. 공유 DB의 이름이 `*_test`여도 `db:reset:test`를 실행하면 안 되는 이유는 무엇인가요?
5. 음악 DB만 복원하고 파일 디렉터리를 복원하지 않으면 어떤 요청이 실패하나요?

답을 코드와 [사전 실습](dictionary-implementation-workbook.kr.md), [음악 실습](../music/implementation-workbook.kr.md)에서 찾고, 실제 서버에서 실행하기 전에는 대상과 권한을 별도로 확인하세요.
