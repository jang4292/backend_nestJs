# Phase별 실행 프롬프트

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 사용자 요청에서 명시한 산출물 예외로 저장합니다. 일반적인 에이전트 프롬프트는 이 파일에 추가하지 않습니다.

## 공통 규칙 (모든 Phase에 적용)

```text
이 저장소는 현재 NestJS 음악/API 서비스를 포함합니다. 기능 범위를 승인 없이 대체·삭제하지 마세요.
요청된 Phase 범위 밖 코드를 변경하지 말고, 운영 host, PROD DB, secret 파일을 추측/출력하지 마세요.
변경 전 git status를 확인하고 사용자 변경을 보존하세요. PROD deploy, 운영 DB 변경/마이그레이션, 삭제, 비밀정보 교체는 명시적 승인 없이는 금지합니다.
테스트를 실제 실행하지 않았다면 PASS라고 쓰지 마세요. 접근하지 못한 host/resource는 UNVERIFIED로 표시하세요.
완료 보고: 변경 파일, 요구사항별 구현, 실행 명령/실제 결과, 데이터 영향, 남은 결정/위험, rollback/다음 단계.
```

## Phase 0 — Inventory & Audit (read-only)

```text
목표: 저장소와 승인된 개발/운영 환경의 AS-IS를 증거 기반으로 기록한다.
선행조건: 저장소 읽기 권한. EC2/HP t620/NAS 접근은 별도 승인 및 read-only 권한.
확인 대상: package.json/lockfile/.nvmrc, src/ 및 Migration, .github/workflows, deploy, Nginx/process manager, docs, GitHub settings, MariaDB metadata, HP/NAS 자원.
수정 대상: docs/architecture/AS_IS.md, docs/architecture/INFRASTRUCTURE.md (문서만).
금지: .env/.env.production/secret 출력, 운영 DB 쓰기, migration, 서비스 재시작, deploy, 패키지 변경, 파일 삭제.
검증: 각 사실에 repo 경로 또는 승인된 명령 증거; 외부 접근 실패는 UNVERIFIED와 필요한 권한/명령을 기록.
완료 기준: 제품 범위 충돌(음악 vs 사전), 실제 runtime/topology, 데이터/backup/보안 상태, 미확인 항목과 의사결정 질문을 분리.
```

## Phase 1 — System Architecture

```text
목표: 승인된 제품 경계에 대해 LOCAL/DEV/PROD, Admin/Live, DB/worker/backup을 설계한다.
선행조건: Phase 0 결과 검토 및 P0 사업/라이선스/장비/인증 결정.
확인 대상: docs/architecture/AS_IS.md, 기존 README.md, docs/deployment/, docs/product/, docs/music/decisions.md.
수정 대상: docs/architecture/TO_BE.md, ENVIRONMENTS.md, INFRASTRUCTURE.md, ADMIN_LIVE_API.md; 필요 시 docs/database/ERD.md.
금지: 코드/host/DB 변경, 확인 전 AWS/NAS 지원 가정, licensing advice를 최종 법률 판단으로 제시.
검증: option 비교, trust boundary, 장애 영향, network/secret/data flow, 결정/미결정 owner 확인.
완료 기준: 사용자가 architecture와 비용·운영 부담·Admin 경계를 승인하고 Phase 2 범위가 구체적.
```

## Phase 2 — Foundation

```text
목표: 승인된 설계대로 dictionary module 기반, 설정, 공통 관측성, readiness, CI 계약 검증을 추가한다.
선행조건: Phase 1 승인.
확인 대상: src/main.ts, src/app.module.ts, src/config/, src/common/, src/database/, package.json, .github/workflows/ci.yml.
수정 대상: 승인된 src/dictionary/**, additive app module wiring, config/env templates, focused tests/CI.
절대 변경 금지: 기존 음악/auth route·DTO·Migration의 semantics, production host config, secret 값.
환경변수: 기존 config conventions 준수; 새 key는 validator/runtime-env lists/templates/test를 함께 갱신. default/fail-closed behavior 명시.
테스트: 기존 full targeted checks 및 기존 route/contract regression, new module bootstrap, env validation.
완료 기준: 기존 API behavior 유지, 신규 module은 DB migration 없이 시작, CI green; DB/운영 배포 없음.
```

## Phase 3 — Database & Domain

```text
목표: 승인된 ERD에 따라 domain, MariaDB entity/repository, additive versioned Migration을 설계·구현한다.
선행조건: Phase 2 완료, 샘플 fixture/locale/license/versioning 정책 승인.
확인 대상: docs/database/ERD.md, src/database/data-source.ts, database-options.ts, migrations/, src/users/entities/, music/catalog/entities/.
수정 대상: 승인된 dictionary domain/entity/adapter와 신규 migration, CI fixture.
절대 변경 금지: 기존 production schema/table/data, 기존 Migration 내용, synchronize=true, 자동 startup migration.
환경변수: 필요한 DB charset/connection 설정만 추가하고 dev/test/prod values 분리.
테스트: 빈 MariaDB 전체 migration, up/down/constraint, Unicode/normalization fixtures, idempotent revision/provenance, EXPLAIN.
완료 기준: CI DB에서 재현 가능하고 기존 table/data untouched, migration이 production 적용되지 않음.
```

## Phase 4 — Admin Backend

```text
목표: 승인된 editor/reviewer/admin 권한에 따라 draft CRUD, source provenance, import staging review, audit, publication을 구현한다.
선행조건: Phase 3 schema 완료, role matrix/network policy/license allow-list 승인.
확인 대상: docs/architecture/ADMIN_LIVE_API.md, docs/api/API_SPEC.md, src/auth/session/, src/users/, src/common/http/, DTO validation patterns.
수정 대상: src/dictionary/application/admin/**, interface/admin/**, repositories, tests, OpenAPI.
절대 변경 금지: live endpoint에서 draft 노출, body 기반 actor/role, 승인 없는 자동 publish, external worker의 direct PROD DB connection.
환경변수: import storage path/size/timeout 등; secret은 local template placeholder만.
테스트: role matrix, unauthorized/forbidden, revision conflict, idempotency, source license required, audit write, publish snapshot.
완료 기준: 공개 데이터는 승인·게시 후에만 변하고 모든 admin mutation이 감사되며 DEV/PROD deploy 없음.
```

## Phase 5 — Live Backend

```text
목표: publication read API, dictionary/character lookup, authenticated study progress/review를 구현한다.
선행조건: Phase 3 data contract, Phase 4 publication workflow/API 계약 승인.
확인 대상: docs/api/API_SPEC.md, docs/database/ERD.md, publication/read-model implementations.
수정 대상: src/dictionary/interface/live/**, application/read/study/**, tests, Swagger.
절대 변경 금지: draft direct reads, 다른 user의 study data, study history의 content revision을 조용히 교체.
환경변수: rate limit/search limits/cache TTL은 approved defaults; secret 없음.
테스트: language/script/cursor, no unpublished data, ownership, answer scoring/revision pinning, MariaDB CJK fixtures.
완료 기준: API contract/OpenAPI와 test evidence 정합; 실제 검색 benchmark 결과를 별도 보고.
```

## Phase 6 — Web Client Integration

```text
목표: 승인된 OpenAPI 계약으로 Admin/Live UI의 API integration을 검증한다.
선행조건: Phase 4/5 API contract 안정, 실제 frontend repository·framework·design system 확인.
확인 대상: OpenAPI JSON, existing frontend source (없으면 새 앱을 생성하지 말고 질문/미확정 기록).
수정 대상: 사용자가 지정한 frontend repository/path 내 client integration tests/generated types only.
절대 변경 금지: 이 NestJS repo에 승인 없이 frontend app/framework 추가, server API semantics 임의 변경.
검증: type generation, auth/CORS, pagination/error states, Admin role denial, user-flow tests.
완료 기준: integration evidence와 미완료 UI requirement 목록; 별도 frontend가 없으면 blocker 보고.
```

## Phase 7 — Data Pipeline

```text
목표: 승인된 source별 download/parse/normalize/dedupe/checkpoint/retry/import-to-staging pipeline을 구현한다.
선행조건: source별 license/attribution/commercial/reuse review, Phase 3 schema, Phase 4 staging/review.
확인 대상: approved data_sources registry, official source docs, sample fixture licenses, storage policy.
수정 대상: isolated parser/worker packages or src/dictionary/import/**, tests, license notices.
절대 변경 금지: live request thread에서 bulk import, PROD DB direct credentials, publish without review, license metadata removal.
환경변수: source endpoint allow-list, worker storage/limits, credential only if official API requires it.
테스트: corrupted/oversized input, retry/checkpoint, same job idempotency, provenance, attribution/license compliance.
완료 기준: staging-only output, reproducible source version/checksum, no production data publication.
```

## Phase 8 — Deployment & Operations

```text
목표: 승인된 topology에서 CI/CD, backup/restore, monitoring, runbook을 검증한다.
선행조건: Phase 0 host evidence, Phase 1 architecture approval, prior implementation phases complete, explicit deployment approval.
확인 대상: docs/operations/DEPLOYMENT.md, SECURITY.md, BACKUP_RECOVERY.md, deploy/, .github/workflows/, AWS IAM/Nginx configuration.
수정 대상: approved CI workflow/infra repository and docs only; host changes require separate operator plan.
절대 변경 금지: unapproved prod migration/deploy, Nginx overwrite, port changes, destructive restore, credential exposure.
검증: off-host backup restore in isolated environment, smoke/readiness, admin network deny/allow, reboot/restart, rollback.
완료 기준: exact command + evidence + RPO/RTO result, approved operator, rollback route; otherwise BLOCKED with reason.
```

