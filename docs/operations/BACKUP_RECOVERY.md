# 백업·복구 계획

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 운영 DB·NAS·AWS backup 설정과 복원 기록을 조회하지 못했습니다. 현재 백업 성공 여부는 **UNVERIFIED**입니다.

## 1. 보호 대상과 위험

- MariaDB 전체 데이터 및 schema/Migration state.
- Admin audit trail, data-source/license registry, import job/staging 필요한 보존분.
- Immutable publication metadata 및 사용자 study state.
- 승인된 외부 source raw snapshot/checksum (재수집이 불가능하거나 license 검수 증거가 필요한 범위).
- 배포 artifact, Nginx/app configuration은 secret을 제외해 재구성 가능하도록 버전 관리.

EC2 로컬 dump, 같은 volume 복사, 동기 NAS mount 한 곳만으로는 호스트/계정/암호화 손실 또는 랜섬웨어에 대비한 독립 backup으로 보지 않습니다.

## 2. 권장 저장 구조

1. **Primary:** 운영 EC2 MariaDB. DB 포트는 private/localhost only.
2. **Off-host copy:** 별도 권한과 삭제 보호가 적용된 암호화 object storage(예: AWS S3 versioning + lifecycle + SSE-KMS) 또는 동등한 독립 저장소.
3. **Secondary copy:** Synology NAS에는 검증된 암호화 archive를 별도 계정/공유 폴더로 복사. NAS는 primary와 동일한 관리자 credential을 공유하지 않고, 외부 공개하지 않습니다.
4. Backup 키는 backup과 같은 위치에 보관하지 않습니다. 복호화 권한은 최소 관리자만 갖고, key recovery를 테스트합니다.

## 3. 일정·보존·RPO/RTO

| 설정 | 초안 | 확정 방법 |
|---|---|---|
| DB backup | 최소 매일 full logical dump; 실제 쓰기량/복구 목표에 따라 더 자주 또는 binlog PITR | DB 크기, change rate, AWS 비용 측정 |
| Retention | daily 30일 + monthly 12개월은 **초기 제안**, 개인정보/법적 정책 및 비용 승인 후 확정 | 데이터 책임자/법무 |
| RPO / RTO | 현재 **미정**. 24h/4h를 임시 계획값으로 삼을 수 있으나 SLA로 선언 금지 | 제품 영향/운영 인력 승인 |
| Integrity | checksum, 압축 종료/파일 크기 확인, 업로드 완료 기록 | 자동화 |
| Restore drill | 첫 운영 전, 이후 분기별 제안 | 주기/소유자 확정 |

`mysqldump --single-transaction`은 InnoDB 데이터 일관성을 위한 구성 예시일 뿐 point-in-time recovery 대체가 아닙니다. DDL/MariaDB feature/비-InnoDB table 여부는 실제 schema에서 확인합니다.

## 4. 백업 작업 절차

1. 백업 job은 전용 최소권한 read account와 서비스 계정으로 실행하고, `umask 077`/권한 제한을 적용합니다.
2. DB 이름·시각·schema version·publication ID·dump checksum·암호화 key version·job ID만 metadata로 기록합니다. password/secret/raw user content는 로그하지 않습니다.
3. 암호화 후 remote upload가 완료되고 checksum이 일치하기 전에는 성공 처리하지 않습니다.
4. Upload/검증 실패는 알림을 내고 이전 성공 backup을 덮어쓰지 않습니다.
5. NAS 복사는 별도 제한 계정/쓰기 전용 경로를 사용합니다. NAS에서 EC2로 inbound DB 접속을 허용하지 않습니다.

## 5. 복원 훈련

1. 격리된 restore host/account/database에서 백업을 복원합니다. PROD DB를 덮어쓰지 않습니다.
2. 암호화 키 복구, checksum, MariaDB version compatibility, Migration state, FK/row-count sanity를 확인합니다.
3. API를 격리된 private endpoint로 시작해 `/health/ready`, dictionary lookup, publication consistency, study history/revision link를 검증합니다.
4. RTO/RPO 측정 및 누락 데이터 범위를 기록하고 승인된 보고서만 공유합니다.
5. 테스트 결과를 바탕으로 retention, 비용, runbook, 담당자를 업데이트합니다.

복원 검증 명령은 실제 운영 권한·dump 경로·DB version을 확인하기 전까지 실행하지 않습니다.

## 6. 장애 시 복구 우선순위

1. 더 이상 쓰기/파괴가 발생하지 않도록 affected deployment/import를 중지하고 incident owner를 호출.
2. 마지막 정상 backup/binlog 시각 및 문제 migration을 확인. 임의로 `migration:revert` 하지 않음.
3. 복구 대상이 PROD인지, 별도 host인지, 사용자에게 고지할 영향인지 승인.
4. 새 DB에 복원 → 검증 → 승인 → app endpoint 전환.
5. 전환 후 write path, Admin audit, publication id, user progress를 확인.
6. 원본 DB를 조사 전 삭제하지 않고 incident evidence로 보존.

