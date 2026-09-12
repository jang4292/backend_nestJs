# MariaDB 운영 가이드

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
DB_POOL_SIZE=10
DB_CONNECT_TIMEOUT_MS=10000
DB_LOGGING=false
DB_SYNCHRONIZE=false
DB_SSL=false
```

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
mariadb-dump -u <user> -p music_db > music_db_$(date +%Y%m%d_%H%M%S).sql
mariadb -u <user> -p music_db < music_db_backup.sql
```

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
SELECT playlistId, seq, COUNT(*)
FROM playlist_track
GROUP BY playlistId, seq
HAVING COUNT(*) > 1;

SELECT playlistId, trackId, COUNT(*)
FROM playlist_track
GROUP BY playlistId, trackId
HAVING COUNT(*) > 1;
```

위반 데이터는 자동 삭제하지 않습니다. 제품 정책과 정리 절차를 확정한 뒤 별도 migration 또는 운영 작업으로 처리합니다.
