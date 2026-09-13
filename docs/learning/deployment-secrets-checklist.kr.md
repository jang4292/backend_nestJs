# 배포/시크릿 운영 체크리스트 (EC2 + MariaDB + Secrets Manager)

이 문서는 현재 프로젝트를 기준으로, 로컬 개발과 운영 배포에서 시크릿을 어떻게 다루는지 체크리스트 형태로 정리한 문서입니다.

## 1) 로컬 개발 체크리스트

1. 현재 코드 기준 기본 환경 파일은 `.env`입니다.
2. 이 프로젝트의 공식 DB 경로는 MariaDB이며, EC2에서는 기본적으로 `localhost:3306`을 사용합니다.
3. `.env`에는 로컬 개발에 필요한 최소값만 둡니다.
4. MariaDB endpoint, DB 계정명, DB 이름은 `.env`처럼 Git에서 제외된 파일이나 EC2 환경변수에만 둡니다.
5. 실제 운영 시크릿 값은 로컬 파일에 복사하지 않습니다.
6. `.env`는 Git 추적 대상이 아니어야 합니다.
7. 원격 MariaDB에 연결할 때는 방화벽과 네트워크 경계가 애플리케이션 실행 위치의 접근을 허용해야 합니다.
8. 로컬 점검 순서:
   - `npm run migration:show`
   - `npm run migration:run`
   - `npm test -- --runInBand`
   - `npm run build`
9. 개발/운영 MariaDB에서도 `DB_SYNCHRONIZE=false`를 유지하고 migration으로 스키마를 맞춥니다.
10. 현재 E2E는 테스트 계정 권한 문제로 `app_db`를 임시 사용합니다.
11. [ ] `app_db_test` 생성 및 테스트 계정 권한 부여 후 `.env.test.local`을 `app_db_test`로 복구합니다.

현재 MariaDB 연결이 없으면 `migration:show`와 `npm run test:e2e`는 DB 연결 단계에서 실패합니다. 이 경우 단위 테스트와 build로 코드 상태를 먼저 확인하고, DB 접근 경로를 준비한 뒤 e2e를 실행합니다.

## 2) 운영 배포 체크리스트 (Secrets Manager 기반)

1. EC2 IAM Role에 최소 권한을 부여합니다.
   - `secretsmanager:GetSecretValue`
   - 필요 시 `kms:Decrypt`
2. 운영 시크릿은 AWS Secrets Manager에만 저장합니다.
3. 애플리케이션 시작 직전에 시크릿을 조회해 환경변수로 주입합니다.
4. 같은 환경변수 컨텍스트에서 migration과 app 시작을 모두 수행합니다.
5. 운영에서는 `DB_SYNCHRONIZE=false`를 유지합니다.
6. 운영 DB 연결은 `DB_SSL=true`와 `DB_SSL_REJECT_UNAUTHORIZED=true`를 기본값으로 둡니다.
7. `DB_SSL_REJECT_UNAUTHORIZED=false`는 인증서 문제를 확인하는 임시 진단용으로만 사용합니다.

Secrets Manager secret 형식은 아래 세 가지를 지원합니다.

```json
{ "DB_PASSWORD": "...", "JWT_SECRET": "..." }
```

```json
{
  "username": "app_user",
  "password": "...",
  "host": "...",
   "port": 3306,
  "dbname": "nestjs_db"
}
```

```text
password-only-secret
```

실무에서는 DB password rotation이 필요하면 RDS managed JSON을 DB secret으로 두고, `JWT_SECRET`과 OAuth secret은 별도 app secret으로 분리하는 구성이 좋습니다. 이 프로젝트의 helper는 작은 운영 흐름을 위해 env-key JSON과 RDS managed JSON을 모두 처리합니다.

## 3) 운영 시크릿 예시 키

아래 키 이름은 코드에서 사용하는 변수명과 동일하게 유지합니다.

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_DATABASE`
- `DB_SSL`
- `DB_SSL_REJECT_UNAUTHORIZED`
- `DB_SSL_CA`
- `DB_POOL_MIN`
- `DB_POOL_MAX`
- `DB_CONNECT_TIMEOUT_MS`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `GOOGLE_ALLOWED_AUDIENCES`
- `GOOGLE_ALLOWED_ISSUERS`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URIS`
- `AUTH_GOOGLE_ENABLED`
- `AUTH_APPLE_ENABLED`
- `AUTH_KAKAO_ENABLED`
- `AUTH_NAVER_ENABLED`
- `AUTH_FACEBOOK_ENABLED`
- `APPLE_ALLOWED_AUDIENCES`
- `APPLE_SERVICE_ID`
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- `APPLE_REDIRECT_URIS`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_REDIRECT_URIS`
- `FACEBOOK_GRAPH_API_VERSION`
- `KAKAO_REST_API_KEY`
- `KAKAO_CLIENT_SECRET`
- `KAKAO_REDIRECT_URIS`
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `NAVER_REDIRECT_URIS`
- `CORS_ORIGIN`

## 4) 배포 실행 순서 (권장)

1. EC2에 접속합니다.
2. 저장소 디렉터리에서 최신 코드를 가져옵니다.
   ```bash
   git pull --ff-only
   ```
3. 의존성과 build를 준비합니다.
   ```bash
   npm ci
   npm run build
   ```
4. Secrets Manager 값을 같은 shell에 export합니다.
   ```bash
   eval "$(AWS_SECRET_ID=<secret-id> AWS_REGION=ap-northeast-2 npm run -s secrets:export)"
   ```
5. migration을 먼저 실행합니다.
   ```bash
   npm run migration:show
   npm run migration:run
   ```
6. PM2에 최신 환경변수와 build 결과를 반영합니다.
   ```bash
   npm run pm2:reload
   ```
7. `/health`와 로그인/보호 API 최소 스모크 테스트를 실행합니다.
8. `AUTH_*_ENABLED=false` provider가 외부 호출 없이 `503`을 반환하는지 확인합니다.
9. 활성 provider의 code flow를 사용하는 경우 등록된 redirect URI와 credential이 모두 주입됐는지 확인합니다.

## 5) 비밀번호 회전(runbook) 체크리스트

1. Secrets Manager에서 RDS password 회전
2. 애플리케이션 재배포(또는 재시작) 수행
3. 재시작 직전 최신 secret 재조회
4. migration 필요 시 먼저 실행
5. `/health`와 DB 연결 상태 확인
6. 실패 시 즉시 롤백 절차 실행

## 6) 검증 체크리스트

1. `GET /health`에서 상태 확인
   - `database`가 `up`인지 확인
2. 로그에 시크릿 노출이 없는지 확인
   - `DB_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`, OAuth secret 출력 금지
3. 인증 없는 쓰기 API가 차단되는지 확인
4. migration 상태가 기대값인지 확인

## 7) 장애/롤백 체크리스트

1. migration 실패 시 즉시 앱 시작 중단
2. 원인 분리
   - 네트워크(Security Group/VPC)
   - 시크릿 주입 실패
   - SSL CA 경로 오류
3. 필요 시 이전 애플리케이션 버전으로 롤백
4. 필요 시 RDS 스냅샷/백업 기준 복구 절차 실행

## 8) 참고

- 과거 PostgreSQL 참고: `docs/learning/postgresql-rds-nestjs-guide.kr.md`
- 보안 가이드: `docs/learning/security-guide.kr.md`
- SNS 로그인 운영·학습 가이드: `docs/learning/sns-login-operational-guide.kr.md`
