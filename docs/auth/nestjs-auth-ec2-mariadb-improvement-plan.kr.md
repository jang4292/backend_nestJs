# NestJS 로그인 API 서버 + AWS EC2 MariaDB 개선 작업용 GitHub Copilot Prompt

> 문서 상태: 현재 저장소에 맞게 보완한 실행 계획입니다. 이 문서의 원본은
> `docs/nestjs-auth-ec2-mariadb-github-copilot-prompt.md`에서 이동했습니다.

## 현재 저장소 기준 보정 사항

- TypeORM migration 체계가 이미 `src/database/migrations/`에 있으므로 migration을 새로 도입하는 대신 기존 migration과 entity의 일치 여부를 검증한다.
- provider identity는 `users`의 provider별 컬럼이 아니라 `social_accounts`의 `(provider, providerUserId)` 복합 unique와 `users.id` foreign key로 관리한다.
- 공용 JWT access session은 `src/auth/session/`에서 이미 제공한다. refresh token/session table은 별도 단계로 추가한다.
- 전역 예외 필터와 provider별 exception filter가 이미 있으므로 DB 오류 매핑은 기존 response envelope과 충돌하지 않도록 보강한다.
- provider disabled 정책은 route를 유지하고 외부 provider 호출 전에 `503`을 반환하는 방식으로 구현한다.
- production에서 enabled provider의 필수 설정이 누락되면 startup을 실패시키고, disabled provider는 secret 없이 build/start할 수 있도록 한다.
- OAuth state는 이번 단계에서 서버 DB transaction으로 저장하지 않는다. 클라이언트가 전달한 state/expectedState 검증, PKCE, redirect URI allowlist를 먼저 강화하며 서버 관리 OAuth transaction은 후속 단계로 둔다.

## 구현 진행 기록

### 완료

- social user 생성과 social account 생성/갱신을 하나의 TypeORM transaction으로 묶었다.
- 기존 `social_accounts` unique/FK migration과 entity 구조를 유지한다.
- 이 문서를 `docs/auth/`로 이동했다.
- `AUTH_{PROVIDER}_ENABLED` flag와 전역 provider readiness guard를 추가했다.
- 비활성 provider route는 외부 호출 없이 `503`을 반환하도록 했다.
- production에서 enabled provider의 최소 설정 누락을 startup validation으로 검사한다.
- Google을 제외한 provider는 기존 설정 존재 여부를 flag 미지정 시 활성화 추론값으로 사용해 기존 환경과 호환한다.
- 모든 provider code flow에서 state와 expectedState 중 하나만 전달되는 경우를 거부한다.
- provider flag와 readiness guard에 대한 단위 테스트를 추가했다.
- production에서 활성 provider의 선택된 code-flow 설정이 부분 입력되면 startup validation이 실패하도록 보강했다.
- local `/auth/login`이 SNS provider readiness guard에 의해 차단되지 않도록 provider path 매칭을 제한했다.
- 다섯 provider의 disabled route `503` 계약과 SNS 빌드·운영·학습 가이드를 문서화했다.

### 검증 결과

- `npm run build`: 통과
- `npm test -- --runInBand`: 28 suites, 145 tests 통과
- 변경 파일 대상 ESLint: 통과
- 전체 ESLint: 기존 music/legacy 파일의 unrelated formatting 및 규칙 오류가 남아 있어 전체 통과하지 않음
- `npm run test:e2e`: 전용 `.env.test.local`과 MariaDB 테스트 DB가 필요하므로 별도 환경에서 실행해야 함
- 추가 검증: `src/config/app-env.spec.ts` 18개, `src/common/auth/provider-readiness.guard.spec.ts` 8개 통과

### 다음 구현 순서

1. route별 token/code flow readiness와 public health 상태 노출을 검토한다.
2. disabled provider HTTP 수준 e2e에서 외부 호출 미수행과 request ID envelope을 고정한다.
3. production redirect URI allowlist와 실제 provider staging 연동을 검증한다.
4. MariaDB/TypeORM 오류의 HTTP 매핑과 transaction rollback 통합 테스트를 보강한다.
5. refresh session, logout, revoke를 별도 migration 단계로 구현한다.

## 현재 구현과 계획의 차이

이 문서의 아래 항목은 현재 코드에 이미 적용되어 있으므로 중복 구현하지 않는다.

- `DB_SYNCHRONIZE=false` production 보호
- TypeORM migration 명령
- `social_accounts` 복합 unique constraint
- `social_accounts.userId` foreign key
- password hash 및 public user 변환
- request ID 기반 전역 오류 응답
- global throttler 및 `/health` DB probe

> 목적: VSCode GitHub Copilot Chat / Agent에서 현재 NestJS 백엔드 프로젝트를 전체 점검하고,  
> AWS EC2 내부 MariaDB 운영을 전제로 DB/인증/세션/보안/예외처리/테스트를 단계적으로 수정·보완한다.
>
> 중요: 이 프롬프트는 "처음부터 새 프로젝트 생성"이 아니라 **현재 프로젝트 구조와 기존 코드를 우선 분석한 뒤 최소 변경으로 개선**하는 작업을 지시한다.

---

## 0. 작업 기본 원칙

현재 프로젝트를 먼저 분석한 뒤 수정한다.

다음 원칙을 반드시 지킨다.

1. 기존 Controller / Service / UseCase / Port / Adapter / Module 구조를 먼저 파악한다.
2. 이미 정상 동작하는 코드를 불필요하게 재작성하지 않는다.
3. 기존 로그인 Provider 구조와 공용 Session / Users 구조를 최대한 유지한다.
4. 변경이 필요한 이유를 먼저 설명하고 수정한다.
5. 한 번에 대규모 리팩터링하지 않는다.
6. 컴파일 오류를 만들지 않는다.
7. 기존 테스트를 깨뜨리지 않는다.
8. DB schema 변경은 migration 기준으로 관리한다.
9. 운영 DB에 직접 DDL을 수동 실행하는 구조를 만들지 않는다.
10. Secret / Token / Password / OAuth Code 등 민감정보를 로그에 남기지 않는다.
11. Build와 Provider Secret 유무를 분리한다.
12. Google/Apple/Kakao/Naver/Facebook 등의 키가 없어도 프로젝트 Build 자체는 성공해야 한다.
13. Provider가 비활성화된 상태에서는 해당 Provider만 정상적으로 사용할 수 없도록 처리한다.
14. JWT / DB처럼 애플리케이션 실행 자체에 필수인 설정과 SNS Provider별 선택 설정을 구분한다.
15. TypeScript strict 환경을 유지하고 `any` 사용은 최소화한다.
16. 기존 ESLint / Prettier / Jest / e2e 규칙을 유지한다.
17. 보안 관련 처리는 편의성보다 안전성을 우선한다.
18. 프로젝트 내 기존 Naming Convention을 우선 사용한다.

---

# 1. 현재 프로젝트 분석부터 진행

수정 전에 아래 내용을 조사하고 요약한다.

## 1.1 프로젝트 구조 확인

다음을 찾아 정리한다.

- NestJS 버전
- Node.js 버전
- package manager
- TypeORM / Prisma / Sequelize 등 ORM 종류
- MariaDB/MySQL Driver
- ConfigModule 구조
- 환경 변수 validation 구조
- DB Module 구조
- Entity 위치
- Migration 위치
- Repository 패턴 사용 여부
- Transaction 사용 여부
- Exception Filter 구조
- Global Exception Filter 존재 여부
- Health Check 구조
- Logger 구조
- Swagger 구조
- Auth Module
- Users Module
- Session Module
- Provider별 Module
- Provider별 Controller
- Provider별 UseCase
- Provider별 Adapter
- 테스트 구조

분석 결과를 먼저 출력한다.

예:

```text
[현재 구조 분석]

ORM:
DB Module:
Migration:
Auth:
Session:
Users:
Google:
Apple:
Kakao:
Naver:
Facebook:
Local:
Exception:
Health:
Test:
```

---

# 2. AWS EC2 내부 MariaDB 운영 전제

DB는 별도 AWS RDS가 아니라 **AWS EC2 인스턴스 내부 MariaDB**를 사용할 계획이다.

예상 구조:

```text
Internet / Client
        |
        v
Nginx / HTTPS
        |
        v
NestJS API
        |
        v
MariaDB
(동일 EC2 또는 내부 전용 EC2)
```

DB 접근은 외부에 직접 공개하지 않는 방향을 기본으로 한다.

---

# 3. MariaDB 연결 설정 점검

현재 DB 설정을 분석한다.

확인 대상:

```text
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_DATABASE
DB_CONNECTION_LIMIT
DB_CONNECT_TIMEOUT
```

운영 예:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=app_user
DB_PASSWORD=...
DB_DATABASE=login_api
```

같은 EC2에서 MariaDB를 실행한다면 가능하면:

```text
127.0.0.1:3306
```

기준으로 접근한다.

외부 접근이 필요하지 않다면:

```text
0.0.0.0:3306 공개 금지
Security Group 3306 전체 공개 금지
```

를 기본 정책으로 한다.

---

# 4. DB 환경 설정 검증

현재 Config Validation을 점검하고 DB 필수값을 검증한다.

DB 설정은 애플리케이션 필수 설정으로 분류한다.

다음 값 누락 시 Production에서는 서버 시작을 실패시키는 방향을 검토한다.

```text
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_DATABASE
JWT_SECRET
```

단:

```text
GOOGLE_CLIENT_ID
APPLE_TEAM_ID
KAKAO_REST_API_KEY
NAVER_CLIENT_ID
FACEBOOK_APP_ID
```

등 Provider 설정은 서버 전체 시작을 막지 않도록 한다.

---

# 5. Database 존재 여부와 관리 정책

먼저 현재 프로젝트가 DB Database 자체 생성 책임을 가지고 있는지 확인한다.

다음 두 개념을 분리한다.

```text
MariaDB Server
    ↓
Database
    ↓
Tables / Index / Constraint
```

권장 정책:

## Production

MariaDB Server 및 Database 생성은 운영/배포 단계에서 진행한다.

예:

```sql
CREATE DATABASE login_api
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

NestJS 애플리케이션이 Production에서 자동으로 DB 자체를 생성하는 구조는 기본적으로 만들지 않는다.

대신:

```text
MariaDB Server 존재
Database 존재
DB User 존재
권한 존재
```

를 배포 전 체크한다.

NestJS에서는:

```text
Database 연결
Migration 실행
Schema 상태 확인
```

을 담당한다.

## Development / Test

필요하다면 별도 스크립트로:

```text
db:create
db:migrate
db:seed
db:reset
```

기능을 제공한다.

현재 프로젝트에 없다면 추가를 검토한다.

예:

```json
{
  "scripts": {
    "db:migrate": "...",
    "db:migrate:revert": "...",
    "db:migration:generate": "...",
    "db:seed": "..."
  }
}
```

현재 ORM에 맞게 실제 명령어를 적용한다.

---

# 6. synchronize 사용 여부 확인

TypeORM을 사용한다면 다음을 확인한다.

```ts
synchronize: true
```

Production에서는 금지한다.

권장:

```ts
synchronize: false
migrationsRun: false 또는 배포 정책에 따라 별도 실행
```

Schema 변경은 migration으로 관리한다.

Development에서도 migration 학습 목적이라면 synchronize에 의존하지 않는다.

---

# 7. Migration 체계가 없다면 추가

다음 항목에 대한 migration 관리 구조를 만든다.

```text
users
auth_identities 또는 social_accounts
local_credentials
auth_sessions
oauth_transactions
auth_login_events
```

단, 기존 `social_accounts` 구조가 이미 안정적으로 사용되고 있다면 무조건 rename하지 않는다.

먼저 비교한다.

```text
현재 social_accounts
vs
권장 auth_identities
```

변경 비용이 크면 기존 이름을 유지해도 된다.

핵심은 Table 이름보다 책임과 제약조건이다.

---

# 8. Users 테이블 점검

현재 users Entity / Table을 분석한다.

최소한 다음 개념을 고려한다.

```text
id
status
display_name
primary_email
created_at
updated_at
deleted_at
```

모든 필드를 억지로 추가하지 않는다.

현재 서비스 요구사항 기준으로 필요한 필드만 추가한다.

중요:

```text
google_id
apple_id
kakao_id
naver_id
facebook_id
```

를 users 테이블에 Provider별 컬럼으로 계속 추가하는 구조는 피한다.

---

# 9. Social Identity 모델 점검

현재 `social_accounts`가 있다면 구조를 점검한다.

권장 개념:

```text
social_accounts / auth_identities

id
user_id
provider
provider_user_id 또는 provider_subject
email
email_verified
display_name
avatar_url
created_at
updated_at
last_login_at
```

핵심 Unique:

```sql
UNIQUE(provider, provider_user_id)
```

또는:

```sql
UNIQUE(provider, provider_subject)
```

현재 Naming Convention에 맞춘다.

Provider 사용자 식별은 이메일보다 다음을 우선한다.

```text
(provider, providerUserId)
```

또는 OIDC:

```text
(provider, sub)
```

---

# 10. Foreign Key 점검

예:

```text
social_accounts.user_id
        ↓
users.id
```

Foreign Key가 없다면 추가를 검토한다.

확인:

```text
ON DELETE
ON UPDATE
```

Account 삭제 정책에 맞게 설정한다.

무조건 CASCADE를 적용하지 않는다.

사용자 탈퇴 / Soft Delete 정책과 충돌하지 않는지 확인한다.

---

# 11. Index 점검

실제 조회 패턴을 분석해서 필요한 Index를 확인한다.

후보:

```text
users.primary_email
social_accounts(provider, provider_user_id)
social_accounts.user_id
auth_sessions.user_id
auth_sessions.expires_at
auth_sessions.refresh_token_hash
oauth_transactions.expires_at
oauth_transactions.state_hash
auth_login_events.user_id
auth_login_events.created_at
```

불필요한 Index는 만들지 않는다.

Migration으로 관리한다.

---

# 12. Local Login Credential 분리 점검

현재 users 테이블 안에 password hash가 있는지 확인한다.

가능하면:

```text
local_credentials

user_id
username
password_hash
password_changed_at
created_at
updated_at
```

형태로 인증 credential 책임을 분리하는 방향을 검토한다.

하지만 현재 구조 변경 비용이 크면 강제로 분리하지 않는다.

그 경우 최소한 다음을 보장한다.

```text
password 원문 저장 금지
bcrypt 또는 현재 안전한 password hashing 사용
PublicUser 변환 시 password 제거
로그에서 password 제거
```

---

# 13. Transaction 보강

가장 중요한 DB 개선 사항이다.

Social Login 최초 가입 과정이 다음과 같다면:

```text
User 생성
    ↓
Social Account 생성
```

반드시 하나의 DB Transaction으로 묶는다.

예:

```text
BEGIN

1. social identity 조회
2. user 생성
3. social account 생성
4. 필요 정보 업데이트

COMMIT
```

중간 실패:

```text
ROLLBACK
```

을 보장한다.

현재 Repository / Adapter / Service 구조에서 Transaction 경계가 어디에 있어야 가장 자연스러운지 분석한다.

가능하면 Application UseCase가 DB implementation detail에 직접 의존하지 않도록 한다.

필요하면 Transaction Port / UnitOfWork 패턴을 검토한다.

과도한 추상화는 하지 않는다.

---

# 14. Race Condition 방어

같은 SNS 계정으로 거의 동시에 로그인 요청이 들어오는 상황을 고려한다.

다음 코드만으로 보호하지 않는다.

```ts
const account = await findAccount();

if (!account) {
  await createAccount();
}
```

반드시 DB Unique Constraint를 최종 방어선으로 사용한다.

예:

```text
UNIQUE(provider, provider_user_id)
```

Duplicate Key 발생 시:

- 예상 가능한 동시성 충돌인지
- 실제 데이터 오류인지

구분한다.

필요하면 재조회 후 정상 로그인 처리하는 로직을 검토한다.

---

# 15. DB 공통 예외 처리 추가

MariaDB / ORM에서 발생하는 DB 예외를 Controller까지 Raw Error 형태로 그대로 노출하지 않는다.

현재 ORM Driver의 실제 error object 구조를 확인한다.

다음 종류를 구분할 수 있는지 확인한다.

```text
Connection Refused
Connection Timeout
Pool Exhausted
Deadlock
Lock Wait Timeout
Duplicate Key
Foreign Key Violation
Not Null Violation
Data Too Long
Invalid Data
Query Syntax Error
Transaction Error
Migration Error
Unknown Database
Access Denied
Too Many Connections
```

공통 DB Exception Mapper 또는 Infrastructure Error Mapper 도입을 검토한다.

예:

```text
ER_DUP_ENTRY
ER_NO_REFERENCED_ROW_2
ER_ROW_IS_REFERENCED_2
ER_LOCK_DEADLOCK
ER_LOCK_WAIT_TIMEOUT
ER_ACCESS_DENIED_ERROR
ER_BAD_DB_ERROR
ECONNREFUSED
ETIMEDOUT
```

실제 사용중인 MariaDB Driver / MySQL Driver에 존재하는 코드만 적용한다.

---

# 16. DB 오류를 Domain Error로 변환

예:

```text
Duplicate Provider Account
    ↓
AuthIdentityAlreadyExistsError

DB unavailable
    ↓
DatabaseUnavailableError

Transaction failure
    ↓
PersistenceError
```

하지만 내부 DB error message를 사용자에게 그대로 반환하지 않는다.

예:

```json
{
  "success": false,
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Service temporarily unavailable"
  },
  "requestId": "..."
}
```

Production Response에서 다음을 노출하지 않는다.

```text
SQL query
table name
column name
DB host
DB username
stack trace
driver internal message
```

---

# 17. HTTP Status 정책 점검

권장 예:

```text
DB 일시 장애                 -> 503
Provider 설정 비활성         -> 503
Duplicate business request   -> 409
잘못된 로그인 입력           -> 400
인증 실패                    -> 401
권한 없음                    -> 403
리소스 없음                  -> 404
예상하지 못한 서버 오류      -> 500
```

기존 Exception Filter와 충돌하지 않는지 확인한다.

특히:

```text
Provider Exception Filter
Global Exception Filter
DB Exception Filter
```

우선순위를 점검한다.

---

# 18. DB Retry 정책

모든 DB 오류를 자동 Retry하지 않는다.

Retry 가능한 오류 후보:

```text
Deadlock
일부 transient connection error
```

Retry하면 위험한 케이스:

```text
이미 transaction 일부가 commit된 상황
중복 결제
authorization code 소비
refresh token rotation
```

현재 로그인 API에서는 Retry가 필요한 지점을 신중히 제한한다.

Deadlock Retry를 넣는다면:

```text
최대 retry 횟수
backoff
logging
idempotency
```

를 함께 고려한다.

---

# 19. Connection Pool 점검

현재 MariaDB Connection Pool 설정을 확인한다.

검토:

```text
connectionLimit
acquireTimeout
connectTimeout
idle timeout
queue
```

Node/NestJS process 수와 PM2 cluster 수를 고려한다.

예:

```text
PM2 4 process
x
DB pool 20
=
최대 80 connection
```

이 될 수 있다는 점을 고려한다.

MariaDB:

```text
max_connections
```

와 함께 설계한다.

무조건 큰 Pool을 설정하지 않는다.

---

# 20. DB Health Check

현재 `/health` 또는 `/readyz`가 있다면 DB 상태를 포함한다.

예:

```json
{
  "status": "ok",
  "database": "up"
}
```

구분 권장:

```text
/livez
```

프로세스 생존 여부.

```text
/readyz
```

DB 등 필수 dependency 사용 가능 여부.

DB 장애라면 readiness는 실패하도록 검토한다.

단 Public endpoint에서 다음 정보는 숨긴다.

```text
DB_HOST
DB_DATABASE
DB_USERNAME
SQL Error
```

---

# 21. Graceful Shutdown 점검

EC2 / PM2 / systemd / Docker 여부에 따라 서버 종료 시:

```text
HTTP 요청 정리
DB Connection Pool 종료
Logger flush
```

를 처리하는지 확인한다.

NestJS:

```ts
app.enableShutdownHooks();
```

사용 여부를 확인한다.

---

# 22. Provider Readiness 정책

현재 Provider별 설정 상태를 중앙에서 계산하는 구조를 만든다.

예:

```ts
type ProviderReadiness = {
  enabled: boolean;
  tokenFlowEnabled?: boolean;
  codeFlowEnabled?: boolean;
  missingKeys?: string[];
};
```

예상 개념:

```text
google
apple
kakao
naver
facebook
```

각 Provider마다:

```text
Provider Enabled
Token Flow Ready
Authorization Code Flow Ready
```

를 분리할 수 있도록 한다.

---

# 23. Provider Feature Flag

명시적인 설정을 추가한다.

예:

```env
AUTH_GOOGLE_ENABLED=false
AUTH_APPLE_ENABLED=false
AUTH_KAKAO_ENABLED=false
AUTH_NAVER_ENABLED=false
AUTH_FACEBOOK_ENABLED=false
```

권장 동작:

## Provider Disabled

```text
Key 없어도 Build 성공
Key 없어도 Start 성공
Endpoint 요청 -> 503 Provider Disabled
외부 Provider 호출 안 함
```

## Provider Enabled + Config 정상

```text
정상 동작
```

## Provider Enabled + Config 누락

Development:

```text
명확한 Warning
해당 Provider 비활성
```

또는 현재 프로젝트 정책에 맞는 Fail Fast를 적용한다.

Production:

가능하면 설정 오류로 판단하여 Startup 실패 또는 매우 명확한 readiness 실패 정책을 검토한다.

어떤 방식을 적용했는지 문서화한다.

---

# 24. Secret 파일 관리

Secret은 Git에 Commit하지 않는다.

확인:

```text
.env
.env.local
.env.*.local
secrets/
*.p8
```

`.gitignore`를 점검한다.

Git에는 다음만 둔다.

```text
.env.example
```

예:

```env
AUTH_GOOGLE_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

AUTH_APPLE_ENABLED=false
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_SERVICE_ID=
APPLE_PRIVATE_KEY_PATH=

AUTH_KAKAO_ENABLED=false
KAKAO_REST_API_KEY=

AUTH_NAVER_ENABLED=false
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

실제 Secret 값은 작성하지 않는다.

---

# 25. Apple Private Key

Apple `.p8` Private Key를 Repository 안에 직접 두지 않는 방향을 우선한다.

예:

```env
APPLE_PRIVATE_KEY_PATH=/secure/path/AuthKey_xxx.p8
```

파일이 존재하지 않을 때:

```text
Apple code flow disabled
```

또는 활성 설정에 따라 Startup Validation Error를 발생시킨다.

Private Key 내용은 로그에 절대 출력하지 않는다.

---

# 26. 장기적인 AWS Secret 관리 확장 가능성

현재 단계에서는 `.env.local` 또는 외부 Secret 파일을 사용할 수 있다.

하지만 구조는 다음으로 교체 가능하게 만든다.

```text
AWS Systems Manager Parameter Store
AWS Secrets Manager
```

Secret Source를 Domain Logic에 직접 결합하지 않는다.

ConfigService 또는 별도 Secret Provider Layer를 통해 읽는다.

이번 작업에서는 AWS Secret Manager를 반드시 구현할 필요는 없다.

---

# 27. Provider별 로그인 공통 Identity Model

Provider Adapter가 각각 다른 데이터를 반환하지 않도록 공통 모델을 검토한다.

예:

```ts
export interface VerifiedSocialIdentity {
  provider: AuthProvider;
  subject: string;

  email?: string;
  emailVerified?: boolean;

  displayName?: string;
  avatarUrl?: string;
}
```

Provider:

```text
Google
Apple
Kakao
Naver
Facebook
```

모두 이 형태로 Application Layer에 전달한다.

---

# 28. 이메일 자동 계정 병합 금지

다음 두 계정이 같은 email을 준다고 해서 자동으로 하나로 합치지 않는다.

```text
Local jay@example.com
Google jay@example.com
```

기본 식별자는:

```text
(provider, providerUserId)
```

를 사용한다.

계정 연결은 별도 명시적 Account Linking UseCase로 구현할 수 있도록 구조를 만든다.

---

# 29. Login과 Account Link 분리

다음 UseCase를 혼동하지 않는다.

```text
Social Login
```

vs

```text
Link Social Account
```

예:

```text
POST /auth/google/login

POST /auth/accounts/google/link
```

실제 API Naming은 현재 프로젝트 규칙을 따른다.

---

# 30. Session 구조 점검

현재 JWT Access Token만 있다면 Session 정책을 검토한다.

권장 확장:

```text
Access Token
Refresh Token
```

DB:

```text
auth_sessions
```

후보 필드:

```text
id
user_id
refresh_token_hash
expires_at
revoked_at
created_at
last_used_at
device_info
```

모든 필드를 강제로 추가하지 않는다.

현재 요구사항 기준으로 설계한다.

---

# 31. Refresh Token 원문 저장 금지

DB에는 가능한 한:

```text
refresh_token
```

원문 대신:

```text
refresh_token_hash
```

를 저장한다.

Access Token도 일반적으로 DB에 저장할 필요가 없다.

---

# 32. Refresh Token Rotation

가능하면 후속 단계로 지원한다.

```text
Refresh Token A
        ↓
Refresh
        ↓
Access Token B
Refresh Token B

A -> revoked
```

이미 사용된 Refresh Token 재사용 탐지 정책도 검토한다.

현재 구현 범위가 과도하면 TODO와 설계 문서로 남긴다.

---

# 33. Logout / Revoke

다음 기능을 점검한다.

```text
POST /auth/logout
POST /auth/refresh
```

Logout:

```text
Session revoke
```

를 수행할 수 있도록 한다.

모든 JWT Access Token을 서버에서 즉시 blacklist하는 복잡한 구조는 당장 도입하지 않아도 된다.

---

# 34. OAuth State

Authorization Code Flow에 대해 state 검증 책임을 명확히 한다.

현재 다음 형태라면 문제를 점검한다.

```text
state와 expectedState 둘 다 있을 때만 비교
```

서버가 State를 관리한다면:

```text
state 생성
state 저장
redirect
callback 검증
사용 후 폐기
TTL
```

가 필요하다.

---

# 35. OAuth Transaction 저장

필요하다면 다음 개념을 도입한다.

```text
oauth_transactions
```

후보:

```text
id
provider
state_hash
nonce_hash
code_verifier
redirect_uri
expires_at
consumed_at
```

DB 대신 Redis가 더 적합할 수 있다.

하지만 현재 EC2 MariaDB 우선 학습 단계라면 DB 기반으로 먼저 구현하거나 TODO로 둘 수 있다.

과도한 구현을 피한다.

---

# 36. Nonce / PKCE

지원 Provider / Client Flow를 확인한 뒤 적용한다.

특히:

```text
Android
iOS
Cocos Creator Native
SPA
```

Client가 Authorization Code Flow를 직접 수행할 경우 PKCE 필요성을 검토한다.

무조건 모든 Provider에 동일하게 강제하지 않는다.

---

# 37. Redirect URI Allowlist

현재 allowlist가 비어 있으면 모든 redirect URI를 허용하는 구조가 있다면 수정한다.

Production에서 Code Flow Provider가 활성화되어 있다면:

```text
Redirect URI Allowlist required
```

정책을 검토한다.

예:

```env
GOOGLE_REDIRECT_URI_ALLOWLIST=...
KAKAO_REDIRECT_URI_ALLOWLIST=...
NAVER_REDIRECT_URI_ALLOWLIST=...
```

일치하지 않으면 외부 Token Exchange 전에 차단한다.

---

# 38. Provider 외부 호출 Timeout

각 Provider Adapter의 HTTP 요청을 점검한다.

다음 문제를 방지한다.

```text
Provider API 무한 대기
JWKS 요청 무한 대기
Token Exchange 무한 대기
```

적절한 Timeout을 적용한다.

Timeout Error는 Provider-specific domain error로 변환한다.

---

# 39. Provider Retry 주의

Authorization Code는 일회성일 수 있으므로 Token Exchange를 무조건 자동 Retry하지 않는다.

다음 호출별로 정책을 구분한다.

```text
JWKS Fetch
Profile Fetch
Token Exchange
```

---

# 40. JWT 검증

현재 JWT 발급과 검증 설정을 확인한다.

검토:

```text
issuer
audience
subject
expiresIn
algorithm
secret/key
clock tolerance
```

JWT Secret은 충분히 강한 값인지 확인한다.

Secret 자체를 코드에 넣지 않는다.

---

# 41. JWT Payload 최소화

Payload에 다음 민감정보를 넣지 않는다.

```text
password
provider access token
refresh token
secret
private key
```

예:

```json
{
  "sub": "userId",
  "sid": "sessionId",
  "roles": []
}
```

정도의 최소 정보를 검토한다.

---

# 42. Authentication Logging

Auth 전용 Structured Log를 검토한다.

허용 예:

```text
requestId
provider
flow
result
errorCode
elapsedMs
userId
```

금지:

```text
password
authorization code
access token
refresh token
id token
client secret
private key
Authorization header
```

로그인 실패 이유도 공격자에게 너무 상세하게 공개하지 않는다.

---

# 43. DB Query Logging

Production에서 ORM의 전체 Query Logging이 활성화되어 있는지 확인한다.

다음이 로그에 포함될 수 있으므로 주의한다.

```text
email
password hash
OAuth data
token hash
```

Production에서는 필요한 수준으로 제한한다.

---

# 44. Login Audit

서비스 학습 목적상 로그인 이벤트 기록을 추가할 수 있다.

예:

```text
auth_login_events
```

후보:

```text
id
user_id
provider
result
error_code
ip_hash 또는 정책에 맞는 IP 처리
user_agent
request_id
created_at
```

개인정보 수집 최소화 원칙을 적용한다.

당장 필요 없다면 설계만 남겨도 된다.

---

# 45. Rate Limit

로그인 Endpoint에 Rate Limit을 적용할 수 있는지 확인한다.

대상:

```text
/auth/login
/auth/*/login
/auth/refresh
```

IP 단독 제한만으로 충분하지 않을 수 있음을 고려한다.

NestJS Throttler 등을 이미 사용한다면 재사용한다.

새 dependency 추가 전 현재 package 확인.

---

# 46. User Enumeration 방어

Local Login:

```text
"User not found"
"Wrong password"
```

를 외부 응답에서 지나치게 구분하지 않는다.

예:

```text
INVALID_CREDENTIALS
```

내부 로그에서만 원인을 구분할 수 있다.

---

# 47. Password 정책

Local Login / Signup이 있다면:

```text
최소 길이
Hash Algorithm
Salt
Password reset
Brute Force
```

구조를 점검한다.

Signup이 아직 없다면 불필요하게 기능을 확장하지 않는다.

---

# 48. Health / Readiness Provider 상태

Public API:

```text
GET /auth/providers
```

또는 기존 endpoint가 있다면 재사용한다.

응답 예:

```json
{
  "google": {
    "enabled": false
  },
  "apple": {
    "enabled": true
  }
}
```

Public API에는:

```text
missingKeys
secret name
secret path
client id
private key status 상세값
```

등을 노출하지 않는다.

관리용 내부 진단 정보와 Public 상태를 분리한다.

---

# 49. Swagger

Provider 비활성 상태에서도 Endpoint 계약이 유지된다면 Swagger 문서는 유지한다.

다음 응답을 문서화한다.

```text
200
400
401
409
503
```

Secret / 내부 Config는 Swagger Example에 넣지 않는다.

---

# 50. DB Seed

개발/테스트용 seed가 필요하면 Production 데이터와 완전히 분리한다.

예:

```text
test user
local account
```

SNS 실제 Token을 Seed하지 않는다.

---

# 51. Test Database

테스트가 Production/Development DB에 연결되지 않게 한다.

예:

```text
.env.test.local
DB_DATABASE=login_api_test
```

다음 보호장치를 검토한다.

```text
NODE_ENV=test가 아니면 test reset 금지
Production DB reset 금지
```

---

# 52. Unit Test 추가

추가 후보:

```text
Provider readiness
Config validation
VerifiedIdentity mapping
Login use case
Account linker
Session issuer
DB Error Mapper
```

External Provider는 Mock한다.

---

# 53. Integration Test 추가

실제 MariaDB 또는 테스트 DB 기준으로 다음을 검증한다.

```text
User 생성
Social Account 생성
Transaction rollback
Unique Constraint
Foreign Key
Session 저장
Refresh revoke
Migration
```

가능하다면 test container를 사용할 수 있지만, 현재 프로젝트에 Docker가 없다면 강제로 도입하지 않는다.

---

# 54. E2E Test 추가

최소 다음을 검증한다.

## Provider Disabled

```text
POST /auth/google/login
-> 503
-> 외부 Google 호출 없음
```

## Config Missing

정책에 맞게:

```text
Startup 실패
```

또는:

```text
Provider disabled
```

검증.

## DB Down

```text
/readyz -> fail
```

Auth Request:

```text
503
```

## Transaction

Social Account 생성 실패 시:

```text
User도 rollback
```

## Unique

동일 provider/user id 중복 생성 방지.

## Error Envelope

모든 Provider가 같은 응답 구조를 사용.

---

# 55. Build 검증

아래를 반드시 수행한다.

```bash
npm run build
```

Provider Key가 없는 환경에서도 Build가 성공해야 한다.

컴파일 단계에서 Secret을 요구하는 코드가 없어야 한다.

---

# 56. Start 검증

다음 시나리오를 검증한다.

## DB 설정 정상 / Provider 전부 disabled

```text
NestJS Start 성공
Local Login 사용 가능
SNS Provider 503
```

## DB 설정 누락

```text
Start 실패
명확한 Config Error
Secret 값 출력 금지
```

## Provider disabled + Secret 없음

```text
Start 성공
```

## Provider enabled + Secret 없음

정한 정책대로 동작하는지 확인한다.

---

# 57. MariaDB 장애 시나리오

테스트 또는 Mock을 통해 다음을 점검한다.

```text
MariaDB process down
DB restart
Connection timeout
Access denied
Unknown database
Duplicate key
Deadlock
Lock timeout
```

각각 API가 적절한 예외를 반환하는지 확인한다.

---

# 58. EC2 운영 체크 사항 문서화

프로젝트 문서에 다음 항목을 추가한다.

```text
MariaDB 설치 여부
MariaDB service 확인
DB 생성
DB User 생성
권한
bind-address
3306 Security Group
NestJS DB 환경변수
Migration 실행
PM2 / systemd 실행
Nginx reverse proxy
HTTPS
Backup
Log
Monitoring
```

---

# 59. MariaDB 최소 권한 계정

NestJS가 root 계정으로 DB에 접속하지 않도록 한다.

예:

```text
login_api_user
```

필요한 DB에 대해서만 권한을 부여한다.

Migration 실행 계정과 Runtime 계정을 분리할 필요가 있는지는 현재 프로젝트 규모에 맞게 검토한다.

---

# 60. Backup

EC2 내부 MariaDB이므로 RDS 자동 백업이 없다는 점을 고려한다.

현재 작업에서 백업 시스템까지 반드시 구현할 필요는 없지만 문서에는 다음을 TODO로 남긴다.

```text
mysqldump / mariadb-dump
S3 Backup
cron/systemd timer
Retention
Restore Test
```

특히:

```text
Backup 존재
≠
Restore 가능
```

이므로 Restore 테스트 필요성을 문서화한다.

---

# 61. EC2 장애 대비

NestJS와 MariaDB가 동일 EC2라면:

```text
EC2 장애
=
API + DB 동시 장애
```

라는 구조적 위험이 있다.

이번 학습 프로젝트에서는 허용할 수 있지만 README 또는 운영 문서에 명시한다.

향후:

```text
DB 전용 EC2
RDS
Multi-AZ
Replica
```

등으로 이동 가능하도록 DB 설정을 코드에 하드코딩하지 않는다.

---

# 62. 구현 우선순위

다음 순서로 작업한다.

## Phase 1 - 프로젝트 감사

```text
현재 Auth 구조 분석
현재 DB 구조 분석
현재 Entity 분석
현재 Migration 분석
현재 Exception 분석
현재 Config 분석
```

코드 수정 전에 결과 출력.

---

## Phase 2 - DB 기반 안정화

```text
DB Config Validation
Migration 체계
Entity Constraint
Index
Foreign Key
Transaction
DB Exception Mapper
Health
```

---

## Phase 3 - Provider Config 안정화

```text
Feature Flag
Provider Readiness
Secret Loading
Redirect URI Allowlist
503 정책
```

---

## Phase 4 - Auth Domain 정리

```text
VerifiedIdentity
Account Linking
User / Identity Transaction
Email Merge Policy
```

---

## Phase 5 - Session

```text
Access Token
Refresh Token
Session DB
Rotation
Logout
Revoke
```

---

## Phase 6 - OAuth 보안

```text
state
nonce
PKCE
OAuth Transaction
Provider timeout
```

---

## Phase 7 - Tests

```text
Unit
Integration
E2E
Failure Injection
```

---

# 63. 수정 작업 방식

한 Phase마다 다음 형식으로 진행한다.

```text
1. 현재 코드 분석
2. 문제점
3. 수정 대상 파일
4. 수정 이유
5. 코드 변경
6. 테스트
7. 결과
8. 남은 TODO
```

한 번에 모든 Phase를 무리하게 수정하지 않는다.

---

# 64. 파일 생성 시 주의

새로운 파일을 만들기 전에:

```text
현재 동일 역할 파일 존재 여부
현재 Naming Convention
현재 Module Dependency
```

확인.

기존 기능이 있으면 새로 만들지 말고 개선한다.

---

# 65. Dependency 추가 원칙

새 npm package가 필요하다면 먼저 설명한다.

```text
왜 필요한가
기존 dependency로 해결 불가능한가
Production dependency인가
Dev dependency인가
```

불필요한 package 추가 금지.

---

# 66. 코드 품질

다음 원칙 유지.

```text
Controller는 HTTP 처리
UseCase / Service는 Application Logic
Repository는 Persistence
Adapter는 External Provider
Domain은 외부 Framework 의존 최소화
```

단, 현재 구조가 더 단순하다면 과도한 Clean Architecture로 복잡도를 높이지 않는다.

---

# 67. 최종 검증 명령

현재 package.json에 실제 존재하는 command를 먼저 확인하고 수행한다.

후보:

```bash
npm run build
npm test -- --runInBand
npm run test:e2e
npm run lint
```

DB 관련 명령도 실제 설정된 Script 기준으로 수행한다.

없는 command를 임의로 실행하지 않는다.

---

# 68. 작업 완료 후 반드시 작성할 보고서

최종적으로 다음 내용을 Markdown으로 출력한다.

```markdown
# NestJS Auth / MariaDB 개선 결과

## 1. 기존 구조

## 2. 발견된 문제

## 3. DB 변경 사항

## 4. Migration 변경 사항

## 5. Transaction 변경

## 6. DB Exception 처리

## 7. Provider Readiness

## 8. Secret 관리

## 9. Login 변경

## 10. Session 변경

## 11. OAuth 보안 변경

## 12. 테스트 결과

## 13. EC2 MariaDB 운영 주의사항

## 14. 아직 구현하지 않은 TODO

## 15. 다음 작업 권장 순위
```

---

# 69. 반드시 확인할 체크리스트

최종 작업 종료 전에 다음을 하나씩 확인한다.

## Build

- [ ] Provider Key가 없어도 `npm run build` 성공
- [ ] Compile 단계에서 Secret 요구 안 함

## Start

- [ ] DB 필수 설정 누락 시 명확히 실패
- [ ] Provider Disabled 상태에서 Secret 없어도 Start 성공
- [ ] Provider Enabled 설정 오류 정책이 일관됨

## DB

- [ ] Production `synchronize: false`
- [ ] Migration 관리
- [ ] Unique Constraint
- [ ] Foreign Key
- [ ] Index
- [ ] Transaction
- [ ] Race Condition 방어
- [ ] DB Exception Mapper
- [ ] DB Health Check
- [ ] Graceful Shutdown

## Security

- [ ] Password 로그 없음
- [ ] Access Token 로그 없음
- [ ] Refresh Token 로그 없음
- [ ] ID Token 로그 없음
- [ ] Authorization Code 로그 없음
- [ ] Client Secret 로그 없음
- [ ] Apple Private Key 로그 없음
- [ ] Authorization Header 로그 없음

## Provider

- [ ] Google
- [ ] Apple
- [ ] Kakao
- [ ] Naver
- [ ] Facebook
- [ ] Local

## OAuth

- [ ] Redirect URI Allowlist
- [ ] state 정책
- [ ] nonce 정책
- [ ] PKCE 필요성 판단
- [ ] Provider timeout
- [ ] Token Exchange retry 정책

## Session

- [ ] Access Token
- [ ] Refresh Token 구조 검토
- [ ] Refresh Token Hash
- [ ] Rotation
- [ ] Logout
- [ ] Revoke

## Testing

- [ ] Unit
- [ ] Integration
- [ ] E2E
- [ ] Transaction rollback
- [ ] Duplicate key
- [ ] DB down
- [ ] Provider disabled
- [ ] Provider config missing
- [ ] External Provider 호출 미수행 검증

---

# 70. 최종 작업 요청

이제 현재 Repository를 실제로 분석한다.

바로 코드를 대규모 수정하지 말고 먼저 다음을 출력한다.

```text
1. 현재 Auth Architecture
2. 현재 Database Architecture
3. 현재 Entity 목록
4. 현재 Table / Constraint 예상 구조
5. 현재 Migration 상태
6. 현재 Config / Secret 관리
7. 현재 Provider별 설정 상태
8. 현재 Transaction 상태
9. 현재 DB Exception 처리 상태
10. 현재 Session 구조
11. 현재 Test Coverage
12. 발견된 문제
13. Critical / High / Medium / Low 우선순위
14. 실제 수정 계획
```

그 다음 **Critical → High 순서로 수정 작업을 진행한다.**

가장 먼저 우선 적용할 대상은 다음과 같다.

```text
P0

DB 연결/환경 검증
Migration
Unique / FK / Index
Transaction
DB Exception
Provider Readiness
Secret 안전성
Redirect URI
Build / Start 정책

P1

Refresh Session
Logout / Revoke
Account Linking
OAuth state / nonce / PKCE

P2

Audit
Rate Limit
Monitoring
Backup 운영 문서
AWS Secrets Manager 전환 준비
```

각 작업 후 Build / Test를 실행하고 실패하면 원인을 분석하여 수정한다.

기존 코드와 테스트가 충분히 잘 구현되어 있는 항목은 불필요하게 다시 작성하지 않는다.

최종 목표는 다음이다.

```text
NestJS
    +
AWS EC2
    +
MariaDB
    +
Local Login
    +
Google / Apple / Kakao / Naver / Facebook
    +
Provider Optional Configuration
    +
Safe Database Transaction
    +
Access / Refresh Session
    +
Predictable Error Handling
    +
Testable Architecture
```

그리고 아직 외부 Provider Key를 발급받지 못한 상황에서도:

```text
Build 가능
Start 가능
Local 기능 개발 가능
DB 개발 가능
Provider별 Mock/Test 가능
```

상태를 반드시 유지한다.
