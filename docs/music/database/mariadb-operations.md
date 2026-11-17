# MariaDB 운영 가이드

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`

## 운영 토폴로지

```text
Client -> NestJS API -> MariaDB
```

NestJS와 MariaDB가 같은 EC2에 있으면 애플리케이션은 가능한 한 `127.0.0.1:3306`으로 연결합니다. 별도 EC2를 사용하는 경우 private network와 Security Group 제한을 우선합니다. MariaDB의 3306 포트를 인터넷 전체에 공개하지 않습니다.

## 환경 변수

운영 환경에서는 다음 값을 secret manager 또는 안전한 배포 환경 변수로 주입합니다.

```env
DB_TYPE=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=music_app
DB_PASSWORD=<secret>
DB_DATABASE=music_db
DB_POOL_MAX=10
DB_CONNECT_TIMEOUT_MS=10000
DB_SYNCHRONIZE=false
DB_SSL=false
```

- 실제 키 목록은 `src/config/app-env.ts`와 `scripts/runtime-env-keys.cjs`를 기준으로 합니다.
- 쿼리 로그는 `NODE_ENV=development`일 때만 켜집니다.
- `DB_POOL_MIN`은 검증만 하고 mysql2 풀에는 적용하지 않습니다.

비밀번호, connection URL, signed URL을 소스 코드나 로그에 기록하지 않습니다.

## DB 생성

DB 생성은 명시적인 provisioning 단계에서만 실행합니다. NestJS `start` 또는 `start:prod`가 DB를 생성하지 않습니다.

```sql
CREATE DATABASE IF NOT EXISTS music_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

애플리케이션 런타임 계정과 migration 실행 계정은 가능하면 분리합니다. 실제 계정 비밀번호는 SQL 파일에 기록하지 않습니다.

## Migration 및 배포 순서

배포 명령과 체크리스트는 [EC2 + MariaDB 배포 가이드](../../deployment/mariadb-systemd.kr.md)를 기준으로 합니다.

1. 현재 운영 DB를 백업합니다.
2. 애플리케이션을 build합니다.
3. migration 상태를 확인합니다.
4. 명시적으로 migration을 실행합니다.
5. migration 실패 시 API를 재시작하지 않고 배포를 중단합니다.
6. API 프로세스를 restart/reload합니다.
7. readiness와 API smoke test를 실행합니다.
8. 애플리케이션 로그와 MariaDB 상태를 확인합니다.

애플리케이션 시작 시 migration을 자동 실행하지 않습니다.

## Backup 및 Restore

비밀번호가 shell history에 남지 않는 방법을 사용합니다. 아래 명령은 예시이며 실제 운영 계정과 경로로 대체합니다.

덤프에는 사용자 데이터와 비밀번호 해시가 들어 있습니다. **저장소 밖의 권한이 막힌 디렉터리**에 만들고(`umask 077`), 프로젝트 루트에 두지 않습니다. `*.sql`, `*.sql.gz`는 `.gitignore`에 있습니다.

```bash
set -o pipefail
umask 077
mkdir -p ~/backups
mariadb-dump --single-transaction --routines --triggers -u backup_user -p music_db \
  | gzip > ~/backups/music_db_$(date +%Y%m%d_%H%M%S).sql.gz
```

복원은 먼저 운영과 분리된 일회성 DB에서 연습합니다. 아래는 **이미 준비하고 대상과 권한을 확인한** 격리 DB의 예시입니다. 파일명과 계정·DB를 실제 격리 대상으로 바꾸고, 운영 또는 공유 DB에는 실행하지 마세요.

```bash
set -o pipefail
gunzip -c ~/backups/music_db_YYYYMMDD_HHMMSS.sql.gz \
  | mariadb -h 127.0.0.1 -u isolated_restore_user -p music_restore_test
```

- 로컬 음원 파일은 DB dump에 포함되지 않습니다. DB와 파일을 같은 복구 시점으로 백업하고 격리 환경에 함께 복원합니다. 경로 설정과 재생 검증은 [음악 구현 실습](../implementation-workbook.kr.md)을 참고합니다.
- MariaDB DDL은 암묵적으로 커밋되므로, migration 도중 실패하면 트랜잭션 rollback으로 되돌릴 수 없습니다.
- `ArchiveLegacyMusicSchema`·`RepairLegacyMariaDbSchema`처럼 down이 없는 migration이 있으므로 **배포 전 백업은 필수**입니다.
- 최신 `AddMusicManagement`의 `down()`도 항상 실패합니다. 무작정 revert하지 말고 [백업·복구 계획](../../operations/BACKUP_RECOVERY.md)에 따라 복원을 검증합니다.

backup 위치, 보존 기간, restore 리허설 결과를 운영 기록으로 남깁니다. 자동화와 복원 훈련 방법은 [DB 개선 가이드](../../learning/database-improvement-guide.kr.md#백업-자동화와-복원-훈련)에 있습니다.

## 문자셋과 시간

- DB/table/문자열 컬럼은 `utf8mb4`를 기본으로 합니다.
- UTC 사용을 권장하지만 실제 Node·DB 연결과 서버의 timezone 설정을 확인해야 합니다. 사용 회차의 `usedAt`은 timezone을 포함해 입력받지만 DB의 `datetime`에는 timezone 정보가 저장되지 않습니다.
- 통계 API의 시간 범위는 ISO 8601과 timezone을 포함해야 합니다. 날짜만 표현하는 `recordingDate`와 구분하고, 화면 시간대 변환과 일광절약시간 경계도 격리 환경에서 검증합니다.
- 기존 운영 DB의 collation/timezone은 영향도 확인 없이 일괄 변경하지 않습니다.

## 사전 데이터 점검

새 constraint를 적용하기 전에 다음 데이터를 확인합니다.

```sql
-- Legacy (1764000000000 migration 이후 legacy_* 테이블)
SELECT playlistId, seq, COUNT(*)
FROM legacy_playlist_track
GROUP BY playlistId, seq
HAVING COUNT(*) > 1;

-- Catalog: (playlistId, position)은 UNIQUE입니다. 같은 Track의 반복은 허용되며 아래는 현황 조회입니다.
SELECT playlistId, trackId, COUNT(*)
FROM playlist_track
GROUP BY playlistId, trackId
HAVING COUNT(*) > 1;
```

위 쿼리는 현황 조회이며 Catalog의 같은 Track 반복은 위반이 아닙니다. 데이터는 자동 삭제하지 않고, 정리가 필요하면 제품 정책과 절차를 확정한 뒤 별도 migration 또는 운영 작업으로 처리합니다.

## 권한(role) 관리

`users.role`(user|admin)은 `1765000000000-AddRoleToUsers` migration으로 추가되었습니다.

- 음악 카탈로그와 legacy 데이터의 쓰기 API는 admin만 호출할 수 있습니다.
- admin 지정과 해제는 운영 DB에서 수동으로 하고, 작업 기록을 남깁니다.

```sql
UPDATE users SET role = 'admin' WHERE username = '<admin-username>';
UPDATE users SET role = 'user'  WHERE username = '<former-admin>';
```
