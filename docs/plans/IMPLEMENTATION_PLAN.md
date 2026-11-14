# 다국어 플랫폼 구현 로드맵

> 최신화 기준: 2026-11-14 · develop `a38e885`
> Phase 0은 읽기 전용 조사이며 완료되지 않았습니다. 모든 크기/기간은 개발자 수·운영 접근·데이터 라이선스가 미확정이라 산정하지 않습니다.

## 1. 선결 결정

- 음악 API 유지/분리/폐기 범위.
- 프로덕션 콘텐츠 배포 라이선스·출처 규칙.
- 지원 언어 표기, 사용자 인증/MFA 및 관리자 역할.
- DEV/PREPROD/PROD host, DB, 비용 상한, RPO/RTO.
- 초기 데이터 범위와 검색·학습 MVP 수용 조건.

## 2. Phase별 계획

| Phase | 범위·산출물 | 주요 대상/환경변수·데이터 변경 | 선행·검증·완료 조건 | 난이도/리스크/병렬 |
|---|---|---|---|---|
| 0 Inventory & Audit | [AS-IS](../architecture/AS_IS.md), host inventory, 결정 질문 | 읽기 전용. repo 소스/문서, 승인된 EC2/HP/Synology 점검; env 출력 금지 | 서버·DB·backup/network 증거 또는 UNVERIFIED 이유 기록, 기존 앱 영향/owner 확인. 구현·Migration 없음 | 중; 접근/운영자 대기 위험; 저장소/장비 점검은 병렬 가능 |
| 1 System Architecture | [TO-BE](../architecture/TO_BE.md), [ENVIRONMENTS](../architecture/ENVIRONMENTS.md), [INFRASTRUCTURE](../architecture/INFRASTRUCTURE.md), [ADMIN_LIVE_API](../architecture/ADMIN_LIVE_API.md) 확정 | 아키텍처 문서, 서비스 경계, Admin policy, 데이터 출처 license matrix | Phase 0 및 사용자 결정 필요. threat/network/data flow/backup 경계 승인되어야 Phase 2 진행 | 중; 사업 scope/라이선스/장비 사양이 위험; API/infra 모델링은 병렬 가능 |
| 2 Foundation | 사전 module skeleton, env/config, logging, readiness, CI/Swagger contract | `src/dictionary/**`, `src/app.module.ts`, env templates, `.github/workflows/ci.yml`; 필요시 `DICTIONARY_*` config | Phase 1 승인. lint/typecheck/unit/build; 기존 55 route 및 기존 Migration unchanged 검증. production deploy 불필요 | 중; 기존 API 회귀 위험; readiness/observability와 module skeleton 병렬 가능 |
| 3 Database & Domain | normalized schema, Migration, source/revision/publication/Unicode 정책 | `src/dictionary/domain/**`, `src/database/migrations/**`, Entity/repository, [ERD](../database/ERD.md) | Phase 2. MariaDB 10.11 CI에서 empty DB apply/revert/constraints; multi-script fixture; sample scale EXPLAIN. 운영 DB Migration 금지 | 높음; 다국어 데이터 정합성/라이선스/스키마 drift; schema/domain 별도 구현 가능 |
| 4 Admin Backend | editorial CRUD, review, import staging, publish workflow, audit | `src/dictionary/interface/admin/**`, application use cases, DTO, permission, source registry | Phase 3. role matrix, failed validation, idempotent import, approval-only publication, audit tests. DB seed는 DEV에 승인 데이터만 | 높음; 관리자 권한/불변 스냅샷; CRUD와 audit/integration은 승인 경계 후 병렬 |
| 5 Live Backend | published lookup/search, character readings, study sessions/review | `src/dictionary/interface/live/**`, read model, progress/review entities | Phase 3 publication contracts. public cannot read draft, owner authorization, version-stable answer/review, CJK search fixture | 높음; search quality·pagination·정답 drift; read API와 study는 publication contract 이후 병렬 |
| 6 Web Client Integration | Admin/Live OpenAPI 계약 검증 및 연동 테스트 | OpenAPI DTO/response, API contract tests; frontend 별도 저장소/경로 확인 전 생성 금지 | Phase 4/5 안정 contract. generated client typecheck, error/auth/pagination compatibility. UI coding은 사용자 승인/프런트 repo 확인 필요 | 중; frontend 미확인; Admin/Live UI는 계약 승인 후 분리 가능 |
| 7 Data Pipeline | source adapter, parser, provenance, normalize, dedupe, checkpoint/retry | `src/dictionary/import/**` 또는 별도 worker package, raw staging storage config | Phase 1 license approval + 3 schema + 4 review. checksum/idempotency/retry/license attribution tests, no direct PROD DB worker | 높음; source마다 schema/license/volume 차이; 각 source adapter 병렬 가능 |
| 8 Deployment & Operations | DEV/PROD release, backup/restore, monitoring, CI/CD, runbook | `.github/workflows/**`, `deploy/**`, ops docs; AWS IAM/Nginx/secret config는 승인된 infra repo/host | Phase 0/1 host/access facts + all release gates. restore drill, Admin network deny, restart, migration rollback plan, smoke evidence | 높음; 실제 운영 영향/비용; CI/backup 계획은 병렬, production rollout은 승인 단계 |

## 3. 작업 순서·parallelism

```text
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
                                  └────→ Phase 7 (source license 승인 이후)
Phase 0/1 + Phase 2/3/4/5/7 완료 게이트 → Phase 8
```

Phase 4와 5는 published content contract가 고정된 뒤 병렬로 작업할 수 있습니다. Phase 7의 서로 다른 source parser는 provenance/normalization 계약이 고정된 뒤 병렬화할 수 있습니다. Phase 6 frontend 코드/폴더는 이 저장소에 없으므로 대상 repository 확인 전 구현하지 않습니다.

## 4. 품질 게이트

- 매 Phase 종료 시 `파일/설정 변경, env key, data effect, 검증 명령과 실제 결과, 미확정·위험, rollback`을 보고합니다.
- 테스트를 실행하지 않았으면 PASS라고 표시하지 않습니다. 외부 장비/운영 설정을 못 본 경우 UNVERIFIED를 유지합니다.
- 현재 API/DB와 신규 dictionary schema는 additive-only로 시작합니다. 음악 서비스 기능 제거·기존 DB 데이터 정리·prod deploy는 별도 승인 대상입니다.
- 모델·검색에 쓰는 모든 외부 source는 source/version/license/attribution이 확인될 때까지 publication에 포함하지 않습니다.

