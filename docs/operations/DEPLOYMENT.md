# 배포·운영 설계

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 현재 저장소는 PM2 배포 문서와 CI 검증 workflow를 갖고 있습니다. 실제 운영 설정 및 배포 성공 여부는 **UNVERIFIED**입니다.

## 1. 구성 권고

- **MVP:** Nginx → NestJS 단일 앱 → MariaDB. Production EC2에서 DB 3306은 localhost/private only.
- **기존 프로세스 매니저:** PM2를 당분간 표준으로 유지합니다. 이유는 `ecosystem.config.cjs`, `npm run pm2:reload`, 현재 운영 문서와 연속성이 가장 높고 systemd/PM2 전환을 서버 확인 없이 하면 위험하기 때문입니다.
- **systemd 대안:** 호스트가 앱 하나뿐이고 운영 단순화를 결정한 뒤, 승인된 점검·롤백 계획으로 이전합니다. 두 관리자가 동시에 같은 앱을 실행하지 않습니다.
- Nginx는 TLS, Admin ingress allow-list, proxy headers, request size/time limit, rate-limit를 담당합니다. API 내부 Guard는 별도 fail-closed로 유지합니다.

## 2. CI → DEV → PROD 단계

### PR / CI

1. `npm ci`
2. lint, format, typecheck, unit tests, build
3. disposable MariaDB에서 모든 migration을 빈 DB에 적용
4. pending migration/drift check 및 E2E
5. npm audit, OpenAPI/contract diff, 문서 링크 확인
6. PROD credentials 없이 실행

현재 CI에 이미 포함된 부분은 [AS-IS](../architecture/AS_IS.md)를 참고하십시오. 새 단계는 필요한 dependency/feature를 추가할 때만 도입합니다.

### LOCAL → DEV

1. branch/PR에 migration·OpenAPI·source license 변경을 같이 검토.
2. PR CI 통과, `npm run db:check:test`/E2E 확인.
3. DEV DB backup 또는 복원 가능한 스냅샷 확인; 해당 환경 전용 secret으로 배포.
4. Migration을 명시적으로 적용한 뒤 API 배포.
5. `/health/live`, `/health/ready`, 사용자/권한, Admin 접근 제한, publication smoke test.
6. DEV 데이터가 운영 source로 승인되지 않으면 PROD로 가져가지 않음.

### DEV → PROD

1. release/tag의 변경 목록·Migration SQL·OpenAPI diff·source license·롤백 계획 승인.
2. 외부 저장소 backup 성공 및 가장 최근 복원 결과 확인.
3. expand/contract Migration을 별도 단계로 준비; destructive DDL은 사용 중지 및 승인 계획 포함.
4. 승인된 운영 DB 계정으로 Migration 적용; app startup auto-migration 금지.
5. artifact를 배포하고 health/readiness + 제한된 smoke test 실행.
6. Admin 접근 및 public read, 이전 publication 안정성 검증.
7. 이상 시 앱 코드 rollback. Schema rollback은 자동으로 하지 말고 호환성·백업에 근거해 별도 승인.

## 3. 자동화와 secret 관리

- CI는 `develop/main` branch protection과 required checks를 사용합니다(설정 상태는 repo code만으로 확인 불가).
- PROD deployment workflow는 tag/release + environment approval을 요구하고, GitHub OIDC로 최소권한 AWS role을 얻는 방식 우선 검토.
- AWS access key/SSH private key를 source, workflow log, app artifact에 넣지 않습니다. 현재 EC2 SSH 배포를 유지할 경우 deploy-only 계정, 제한 명령, key rotation 기록을 둡니다.
- DB migration 전용 credential과 app runtime credential을 분리합니다. 운영 credential을 LOCAL/DEV/test/CI에 복사하지 않습니다.
- deploy artifact는 `npm ci`로 lockfile 기준 재현하고 `.env*`, `*.sql`, backup, test fixtures의 PII를 포함하지 않습니다.

## 4. 롤백·장애 대응

- API와 migration은 롤백을 독립적으로 판단합니다. DB DDL은 암묵적 commit/비가역 변경을 고려합니다.
- `expand → dual compatible app → backfill/verify → contract` 순서로 schema를 바꿉니다.
- 실패 시 우선 트래픽/배포를 멈추고 로그·request ID·migration status를 보존합니다. 데이터 손실 가능성이 있으면 임의 재시도하지 않습니다.
- Runbook에 담당자, AWS/SSH 경로, 서비스 재기동, DB 복구 승인자, 사용자 공지 조건을 기록합니다. 이 값들은 **UNVERIFIED / 결정 필요**입니다.

## 5. 테스트 게이트

CI에서 자동화: unit, DTO/auth contract, MariaDB migration, Unicode fixture, e2e, openapi diff, dependency audit.

DEV/운영 승인 게이트: admin network deny/allow, DB port externally closed, restart recovery, new publication and revoke, backup restore, import retry/idempotency, old study card content consistency.

