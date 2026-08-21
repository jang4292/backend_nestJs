# 배포/시크릿 운영 체크리스트 (EC2 + RDS + Secrets Manager)

이 문서는 현재 프로젝트를 기준으로, 로컬 개발과 운영 배포에서 시크릿을 어떻게 다루는지 체크리스트 형태로 정리한 문서입니다.

## 1) 로컬 개발 체크리스트

1. 현재 코드 기준 기본 환경 파일은 `.env`입니다.
2. `.env`에는 로컬 개발에 필요한 최소값만 둡니다.
3. 실제 운영 시크릿 값은 로컬 파일에 복사하지 않습니다.
4. `.env`는 Git 추적 대상이 아니어야 합니다.
5. 로컬 점검 순서:
   - `npm run migration:show`
   - `npm run migration:run`
   - `npm test -- --runInBand`
   - `npm run build`

## 2) 운영 배포 체크리스트 (Secrets Manager 기반)

1. EC2 IAM Role에 최소 권한을 부여합니다.
   - `secretsmanager:GetSecretValue`
   - 필요 시 `kms:Decrypt`
2. 운영 시크릿은 AWS Secrets Manager에만 저장합니다.
3. 애플리케이션 시작 직전에 시크릿을 조회해 환경변수로 주입합니다.
4. 같은 환경변수 컨텍스트에서 migration과 app 시작을 모두 수행합니다.
5. 운영에서는 `DB_SYNCHRONIZE=false`를 유지합니다.

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
- `CORS_ORIGIN`

## 4) 배포 실행 순서 (권장)

1. 배포 서버에서 최신 코드 배치
2. Secrets Manager에서 시크릿 조회
3. 환경변수 export
4. `npm run migration:run`
5. `npm run start:prod`
6. `/health` 확인
7. 로그인/보호 API 최소 스모크 테스트

## 5) 비밀번호 회전(runbook) 체크리스트

1. Secrets Manager에서 RDS password 회전
2. 애플리케이션 재배포(또는 재시작) 수행
3. 재시작 직전 최신 secret 재조회
4. migration 필요 시 먼저 실행
5. `/health`와 DB 연결 상태 확인
6. 실패 시 즉시 롤백 절차 실행

## 6) 검증 체크리스트

1. `GET /health`에서 상태 확인
2. 로그에 시크릿 노출이 없는지 확인
   - `DB_PASSWORD`, `JWT_SECRET`, OAuth secret 출력 금지
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

- RDS 연결 가이드: `docs/learning/postgresql-rds-nestjs-guide.kr.md`
- 보안 가이드: `docs/learning/security-guide.kr.md`
