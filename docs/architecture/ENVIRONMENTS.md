# LOCAL / DEV / PROD 환경 설계

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 실제 현재 연결은 [AS-IS](AS_IS.md)와 저장소의 [환경별 DB 가이드](../deployment/database-environments.kr.md)를 참고하십시오. 아래 DEV 물리 배치는 제안이며 확정 사실이 아닙니다.

## 1. 환경 분리표

| 구분 | LOCAL | DEV | PROD |
|---|---|---|---|
| 목적 | 개발·Migration 작성·테스트·샘플 데이터 | 통합·배포·네트워크 검증, 비실데이터 import | 사용자 Live/Admin 운영 |
| API | 개발자 Mac/PC `localhost` | 초기에는 Mini PC 검토, 검증이 안 되면 저비용 EC2 DEV | AWS EC2, 별도 도메인/인증서 |
| DB | 개발 PC 로컬 MariaDB 또는 격리된 테스트 인스턴스 | 전용 `dictionary_dev` DB | 전용 `dictionary_prod` DB, 운영 API만 접근 |
| 데이터 | 가짜·샘플·가명화 데이터 | 합성/검수 데이터; PROD 사용자 데이터 금지 | 승인 콘텐츠 및 PROD 사용자 정보 |
| 인증/시크릿 | 개발 전용 `.env` | DEV 전용 key/DB 계정 | Secret Manager 또는 제한 권한 파일 |
| DB 권한 | 개인 로컬 계정 | DEV 전용 런타임과 migrator | 별도 runtime 계정(read/write 필요한 최소 권한)과 migrator(DDL) |
| 로그 | debug 허용, 민감정보 금지 | 운영과 유사한 구조, 비식별화 | 최소한의 구조화 로그, 접근·보존 통제 |
| 배포 | 로컬 직접 실행 | CI 통과 후 수동/자동 배포 | 승인된 tag/release + 배포 승인 |

현 [README](../../README.md)의 LOCAL은 현재 공유 DEV MariaDB를 연결합니다. 목표 LOCAL 요구와 상충하므로 Phase 2에서 로컬 MariaDB 기본을 도입하거나, 연결이 필요한 개발자에게 SSH tunnel 기반 DEV 접근을 별도로 제공해야 합니다.

## 2. 환경변수와 자격 증명

- 환경변수 이름은 공통으로 유지하고 값/secret manager namespace는 환경별로 분리합니다.
- DB 접속, JWT signing key, OAuth credentials, import source key, backup encryption key를 환경 간 공유하지 않습니다.
- `.env.example`은 자리표시자만 포함하며 실제 `.env`, `.env.production`, dump, PEM, private key는 저장소 밖에 둡니다.
- CI는 disposable DB/user/secret만 사용합니다. 운영 secret을 테스트 job에 노출하지 않습니다.
- `ENVIRONMENT`와 `NODE_ENV`의 동기화 기준을 하나로 정하고(현 프로젝트는 `NODE_ENV`), 시스템마다 서로 다른 파일을 자동 fallback하지 않도록 합니다.

필수 신규 설정 후보:

| 변수 | 목적 | 기본 원칙 |
|---|---|---|
| `APP_ENV` 또는 기존 `NODE_ENV` | environment 식별 | 불일치 거부 |
| `DATABASE_URL` 또는 `DB_*` | 해당 환경 전용 DB | `DB_SYNCHRONIZE=false` |
| `JWT_SECRET` / session signing key | 인증 | 환경 간 재사용 금지 |
| `CORS_ORIGIN` | UI allow-list | `*` 금지, Admin UI origin 분리 검토 |
| `TRUST_PROXY` | reverse proxy 신뢰 | 실제 topology에 맞는 hop/IP만 |
| `ADMIN_ALLOWED_NETWORKS` (ingress 설정 권장) | Admin 네트워크 접근 | 앱 설정보다 Nginx/Security Group에서 우선 적용 |
| `IMPORT_STORAGE_ROOT` 또는 object storage config | 승인된 원본/작업 파일 | web root 밖, 환경별 경로/권한 분리 |
| `LOG_LEVEL`, `REQUEST_TIMEOUT_MS` | 운영 조정 | secret/개인정보를 log하지 않음 |

## 3. Migration / 콘텐츠 반영 정책

1. Schema Migration은 CI에서 빈 MariaDB에 전체 적용하고, 스키마 drift 및 backward compatibility를 검증합니다.
2. DEV에서 migration과 롤백/복구 절차를 확인한 후 PROD 승인 배포에 포함합니다.
3. 코드 배포와 migration은 분리된 단계로 기록합니다. 파괴적 변경은 expand/contract로 나눕니다.
4. Seed는 LOCAL/CI 전용입니다. DEV 콘텐츠는 import batch + approval 절차를 거치며 PROD 데이터베이스 전체 복제는 금지합니다.
5. 콘텐츠 데이터는 schema migration과 분리된, 버전·라이선스·source checksum·승인자·작업 ID를 가진 publish/import operation으로 반영합니다.
6. 되돌릴 수 없는 Migration 전에는 외부 저장소 backup과 복원 검증 여부를 확인합니다.

## 4. 격리·실패 영향 범위

- 개발자 로컬 API/DB 장애는 개인 개발에만 영향.
- DEV API/DB/Worker는 PROD credential 및 운영 네트워크 권한이 없어야 합니다.
- NAS는 별도 backup destination 및 제한된 원본 archive로 사용하고, Live 요청 경로에 마운트하지 않습니다.
- DEV와 PROD를 같은 EC2에 두는 구조는 CPU/RAM/disk, 계정, 포트, DB, 장애 영역을 공유합니다. 비용 절감 대신 동시 자원 고갈·잘못된 배포·호스트 장애의 공통 영향이 생기므로 기본안으로 권장하지 않습니다.
- EC2 단일 호스트의 API와 DB는 인스턴스 장애가 둘 다에 영향을 줍니다. Multi-AZ/managed DB로 옮길지 비용과 복구 목표를 비교해야 합니다.

