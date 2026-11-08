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

```bash
mariadb-dump --single-transaction --routines --triggers -u <user> -p music_db > music_db_$(date +%Y%m%d_%H%M%S).sql
mariadb -u <user> -p music_db < music_db_backup.sql
```

- MariaDB DDL은 암묵적으로 커밋되므로, migration 도중 실패하면 트랜잭션 rollback으로 되돌릴 수 없습니다.
- `ArchiveLegacyMusicSchema`·`RepairLegacyMariaDbSchema`처럼 down이 없는 migration이 있으므로 **배포 전 백업은 필수**입니다.

backup 위치, 보존 기간, restore 리허설 결과를 운영 기록으로 남깁니다.

## 문자셋과 시간

- DB/table/문자열 컬럼은 `utf8mb4`를 기본으로 합니다.
- 새 데이터의 저장 시간은 UTC를 기준으로 합니다.
- API 시간 값은 ISO 8601로 반환합니다.
- 사용자 화면의 timezone 변환은 client 책임으로 둡니다.
- 기존 운영 DB의 collation/timezone은 영향도 확인 없이 일괄 변경하지 않습니다.

## 사전 데이터 점검

새 constraint를 적용하기 전에 다음 데이터를 확인합니다.

```sql
-- Legacy (1764000000000 migration 이후 legacy_* 테이블)
SELECT playlistId, seq, COUNT(*)
FROM legacy_playlist_track
GROUP BY playlistId, seq
HAVING COUNT(*) > 1;

-- Catalog: (playlistId, position)은 UNIQUE로 강제됨. Track 중복은 정책 미확정이라 점검만 합니다.
SELECT playlistId, trackId, COUNT(*)
FROM playlist_track
GROUP BY playlistId, trackId
HAVING COUNT(*) > 1;
```

위반 데이터는 자동 삭제하지 않습니다. 제품 정책과 정리 절차를 확정한 뒤 별도 migration 또는 운영 작업으로 처리합니다.

## 권한(role) 관리

`users.role`(user|admin)은 `1765000000000-AddRoleToUsers` migration으로 추가되었습니다.

- 음악 카탈로그와 legacy 데이터의 쓰기 API는 admin만 호출할 수 있습니다.
- admin 지정과 해제는 운영 DB에서 수동으로 하고, 작업 기록을 남깁니다.

```sql
UPDATE users SET role = 'admin' WHERE username = '<admin-username>';
UPDATE users SET role = 'user'  WHERE username = '<former-admin>';
```
