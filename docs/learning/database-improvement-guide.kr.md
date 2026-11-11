# DB 개선 가이드: 남은 과제와 진행 방법

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 개념(생성, migration, 검증, 롤백)은 [DB·스키마 관리 학습 가이드](database-schema-management.kr.md)에, 환경별 명령은 [환경별 DB·설정 가이드](../deployment/database-environments.kr.md)에 있습니다. 이 문서는 **앞으로 무엇을 어떤 순서로 고칠지**를 다룹니다.

## 1. 현재 상태

| 영역 | 갖춰진 것 | 비어 있는 것 |
| --- | --- | --- |
| 스키마 변경 | migration 10개, 명령으로만 적용, `synchronize` 금지 | entity와 migration 결과가 다름(DB-12) |
| 검증 | CI `database` job(빈 DB 전체 체인, pending 없음, 최신 revert/재적용, e2e) | drift 단계가 보고만 함 |
| 안전장치 | 권한 사전 점검, 소유 판정(`inspectOwnership`), 운영 DB 생성 금지 | 런타임 계정이 DDL 권한을 가짐(DB-18) |
| 전송 | 운영은 localhost | 개발 서버 TLS 없음(DB-19) |
| 백업 | 배포 전 수동 `mysqldump` | 자동화, 암호화, 복원 훈련 |
| 쿼리 | 페이지네이션 상한, FK·중복 오류 매핑, LIKE 이스케이프 | 재정렬 트랜잭션(DB-8), 검색 구조(DB-9), count(DB-10) |
| 세션 | `users.sessionVersion`(2026-11-09) | refresh token 테이블 |

## 2. 우선순위

| 순위 | ID | 과제 | DB 변경 | 작업량 |
| --- | --- | --- | --- | --- |
| P1 | [DB-12](#db-12-entity와-migration-drift-해소) | entity와 migration drift 해소 | 없음(entity만) | 중 |
| P1 | [DB-18](#db-18-migration-계정과-런타임-계정-분리) | migration 계정과 런타임 계정 분리 | 계정·GRANT | 소 |
| P1 | [백업](#백업-자동화와-복원-훈련) | 백업 자동화, 암호화, 복원 훈련 | 없음 | 소 |
| P1 | [DB-19](#db-19-전송-구간-보호) | 개발 서버 전송 구간 보호 | 서버 설정 | 소 |
| P1 | [DB-8](#db-8-플레이리스트-재정렬-트랜잭션) | 플레이리스트 재정렬 트랜잭션 | 없음 | 소 |
| P1 | [refresh token](#refresh-token-테이블-설계) | refresh token 테이블 | 새 테이블 | 중 |
| P2 | [DB-9](#db-9-검색-쿼리) | 검색 쿼리 구조 | 인덱스 | 중 |
| P2 | [DB-10, DB-11](#db-10-db-11-count-쿼리와-풀-설정) | count 쿼리, `DB_POOL_MIN` | 없음 | 소 |
| P2 | [legacy·데이터 이전](#legacy-스키마-폐기와-postgresql-데이터-이전) | legacy 폐기, PostgreSQL → MariaDB 데이터 이전 결정 | 테이블 삭제 | 대 |
| P2 | [모니터링](#모니터링) | slow query, 연결 수 | 서버 설정 | 소 |

각 과제는 **현상 → 위험 → 실무 방식 → 권장 → 단계 → 검증 → 롤백** 순서로 적었습니다.

---

## DB-12: entity와 migration drift 해소

**현상:** `npm run migration:check:test`(실제 DB와 entity를 비교하는 dry-run)가 2026-11-09 기준으로 **49개 문장**을 제안합니다.

| 종류 | 개수 | 예 |
| --- | --- | --- |
| 시간 컬럼 정밀도 | 20 | DB는 `datetime`(초), entity 기본값은 `datetime(6)` |
| 인덱스 이름·유무 | 삭제 10, 생성 3 | DB의 `UQ_users_email`을 지우고 `IDX_97672…`를 만들려 함. `IDX_playlist_track_trackId` 같은 DB 인덱스가 entity에 없음 |
| FK 이름 | 삭제·생성 7쌍 | DB의 `FK_track_artist`를 지우고 `FK_2014e…`(해시 이름)를 만들려 함 |
| 타입·collation | 2 | `legacy_artist.name` collation, `playlist.anonymousPlayable` `tinyint` 표기 |

`sessionVersion`(1766)은 entity와 migration을 같게 작성해 **새 drift가 없음**을 확인했습니다.

**위험**

- 지금 `migration:generate`를 하면 의도한 변경 외에 FK 재생성, 인덱스 삭제가 섞인 초안이 만들어집니다. 검토하다 놓치면 운영 DDL이 됩니다.
- CI drift 단계가 `continue-on-error`라 새 drift가 생겨도 막지 못합니다.

**실무 방식**

| 방향 | 방법 | 장단점 |
| --- | --- | --- |
| **코드를 DB에 맞춤** | entity에 실제 이름·정밀도를 선언 | DB 변경 없음. 운영 위험 0. entity가 조금 장황해짐 |
| DB를 코드에 맞춤 | 보정 migration으로 이름·정밀도 변경 | entity가 단순. 운영 DDL(FK 재생성은 테이블 잠금)이 필요 |

**권장:** 코드를 DB에 맞춥니다. 운영 데이터가 있는 테이블에 이름만 바꾸는 DDL을 실행할 이유가 없습니다.

**단계**

1. dry-run 결과를 파일로 저장합니다(DB 변경 없음).
   ```bash
   npm run migration:check:test 2>&1 | grep -v '^query' > drift-before.txt
   ```
2. **시간 컬럼:** DB의 실제 정밀도(초)를 선언합니다.
   ```ts
   @CreateDateColumn({ type: 'datetime', precision: 0, default: () => 'CURRENT_TIMESTAMP' })
   createdAt: Date;

   @UpdateDateColumn({
     type: 'datetime', precision: 0,
     default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP',
   })
   updatedAt: Date;
   ```
3. **unique·인덱스:** `@Column({ unique: true })` 대신 DB의 실제 이름으로 선언합니다.
   ```ts
   @Entity('users')
   @Index('UQ_users_email', ['email'], { unique: true })
   export class User { … }
   ```
   DB에만 있는 인덱스(`IDX_playlist_track_trackId` 등)도 `@Index('이름', ['컬럼'])`으로 선언합니다.
4. **FK:** `@JoinColumn`에 실제 제약 이름을 적습니다.
   ```ts
   @ManyToOne(() => Artist, { onDelete: 'RESTRICT' })
   @JoinColumn({ name: 'artistId', foreignKeyConstraintName: 'FK_track_artist' })
   artist: Artist;
   ```
   `ON UPDATE` 동작(`RESTRICT`와 `NO ACTION`)도 dry-run 결과와 맞춥니다.
5. 2~4를 테이블 하나씩 반복하고, 매번 dry-run 문장 수가 줄어드는지 확인합니다.
6. dry-run이 `No changes in database schema were found`가 되면 `.github/workflows/ci.yml`의 drift 단계에서 `continue-on-error: true`를 지웁니다.

**검증:** 로컬 dry-run 0문, CI drift 단계 필수 통과, 유닛·e2e 통과

**롤백:** entity만 바뀌므로 커밋을 되돌리면 됩니다. DB는 처음부터 바뀌지 않습니다.

---

## DB-18: migration 계정과 런타임 계정 분리

**현상:** 운영 앱 계정이 `SELECT, INSERT, UPDATE, DELETE`뿐 아니라 `CREATE, ALTER, DROP, INDEX`까지 갖고 있습니다. migration을 같은 계정으로 실행하기 때문입니다.

**위험:** 앱이 탈취되거나 SQL 주입이 생기면 공격자가 테이블을 지우거나 바꿀 수 있습니다. 런타임에는 DDL이 필요 없습니다.

**실무 방식:** 계정을 둘로 나눕니다.

| 계정 | 권한 | 쓰는 곳 |
| --- | --- | --- |
| `<app>_migrator` | 8개 권한(DDL 포함), 앱 DB 단위 | `migration:run:prod`를 실행할 때만. 비밀번호는 서버 파일에 두지 않음 |
| `<app>_runtime` | `SELECT, INSERT, UPDATE, DELETE`만, 앱 DB 단위 | `.env.production`(PM2로 실행되는 앱) |

**권장 단계** (운영 MariaDB에서 관리자로)

1. 계정을 만듭니다. 두 계정 모두 `localhost`에서만 접속하게 합니다.
   ```sql
   CREATE USER '<app>_runtime'@'localhost' IDENTIFIED BY '<runtime-password>';
   GRANT SELECT, INSERT, UPDATE, DELETE ON `<prod_db>`.* TO '<app>_runtime'@'localhost';

   CREATE USER '<app>_migrator'@'localhost' IDENTIFIED BY '<migrator-password>';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX
     ON `<prod_db>`.* TO '<app>_migrator'@'localhost';
   ```
2. `.env.production`의 `DB_USERNAME`·`DB_PASSWORD`를 runtime 계정으로 바꾸고 `npm run pm2:reload` 후 `/health`를 확인합니다.
3. migration은 migrator 계정을 **셸 환경변수로 잠깐만** 넘겨 실행합니다. 셸 값이 env 파일보다 우선하므로 코드 변경이 필요 없습니다.
   ```bash
   read -rp 'migrator user: ' MIG_USER; read -rsp 'migrator password: ' MIG_PASS; echo
   DB_USERNAME="$MIG_USER" DB_PASSWORD="$MIG_PASS" npm run db:check:prod
   DB_USERNAME="$MIG_USER" DB_PASSWORD="$MIG_PASS" npm run migration:run:prod
   unset MIG_USER MIG_PASS
   ```
4. 기존 계정의 DDL 권한을 회수하거나 계정을 지웁니다.
   ```sql
   REVOKE CREATE, ALTER, DROP, INDEX ON `<prod_db>`.* FROM '<app>'@'localhost';
   ```

**주의**

- runtime 계정으로 `db:check:prod`를 실행하면 DDL 권한이 없다고 표시됩니다. migration을 실행할 계정이 아니므로 정상입니다. 배포 전 점검은 migrator 계정으로 합니다.
- 앱 기동 시 pending 확인(`MigrationStatusService`)은 `migrations` 테이블을 읽기만 하므로 runtime 계정으로 동작합니다.

**검증:** 앱 정상 동작(`/health` 200, 로그인), runtime 계정으로 `DROP TABLE` 시도 시 1142 오류, migrator 계정으로 migration 성공

**롤백:** `.env.production`을 이전 계정으로 되돌리고 `pm2:reload`

---

## 백업 자동화와 복원 훈련

**현상:** 배포 전에 손으로 `mysqldump`를 실행합니다. 덤프에는 사용자 데이터와 비밀번호 해시가 들어 있는데, 문서 예시가 프로젝트 루트에 기본 권한으로 파일을 만들었습니다(DB-20, 2026-11-09 수정).

**위험:** 백업을 잊거나, 복원해 본 적 없는 백업에 의존하거나, 덤프 파일이 유출됩니다.

**실무 방식:** 정기 백업 + 보관 기간 + 암호화 + 다른 위치 보관 + **복원 훈련**. "복원해 본 적 없는 백업은 백업이 아니다"라고 봅니다.

**권장 단계**

1. 저장소 밖의 전용 디렉터리를 만들고 권한을 막습니다.
   ```bash
   sudo install -d -m 700 -o <deploy-user> /var/backups/backend-nestjs
   ```
2. 백업 명령을 정합니다. `umask 077`로 파일을 본인만 읽게 만듭니다.
   ```bash
   umask 077
   mysqldump --single-transaction --routines --triggers <prod_db> \
     | gzip > /var/backups/backend-nestjs/<prod_db>-$(date +%Y%m%d%H%M).sql.gz
   ```
   - 비밀번호는 명령줄에 쓰지 않습니다. `~/.my.cnf`(chmod 600)의 `[mysqldump]` 절에 둡니다.
3. cron이나 systemd timer로 매일 실행하고, 14일이 지난 파일은 지웁니다.
   ```bash
   find /var/backups/backend-nestjs -name '*.sql.gz' -mtime +14 -delete
   ```
4. 다른 위치에 보관합니다. 예: S3 버킷(서버 측 암호화, 버전 관리, 수명 주기 규칙)
5. **복원 훈련(월 1회):** 운영 서버가 아닌 곳에서 합니다. 예를 들어 Test 서버의 새 DB에 복원하고 `db:check`로 테이블 수와 migration 상태를 확인합니다. **같은 서버의 다른 DB에 복원하지 않습니다.**

**검증:** 백업 파일 권한(`-rw-------`), 최근 백업 시각, 복원 훈련 기록

---

## DB-19: 전송 구간 보호

**현상:** 개발 DB 서버(MariaDB 10.11)가 TLS를 지원하지 않습니다. `db:check`가 `tls: off (credentials and data are sent in plaintext)`를 표시합니다.

**위험:** 같은 네트워크에 있는 사람이 DB 계정과 데이터를 볼 수 있습니다.

**권장(둘 중 하나)**

- **SSH 터널(설정 변경 최소):** DB 포트를 외부에 열지 않고 SSH로만 접속합니다.
  ```bash
  ssh -N -L 13306:127.0.0.1:3306 <ssh-user>@<dev-db-host>
  # .env / .env.test.local
  DB_HOST=127.0.0.1
  DB_PORT=13306
  ```
- **서버 TLS:** MariaDB에 인증서(`ssl_cert`, `ssl_key`, `ssl_ca`)를 설정하고 `require_secure_transport=ON`으로 둡니다. 앱은 `DB_SSL=true`, `DB_SSL_CA=<CA 경로>`를 씁니다.

**검증:** `db:check`의 `tls` 항목이 `on`이 되거나, 서버 포트가 외부에서 닫힌 것을 확인합니다.

---

## DB-8: 플레이리스트 재정렬 트랜잭션

**현상:** 재정렬이 트랜잭션 밖에서 항목을 읽고, 항목마다 UPDATE를 2번씩(임시 위치 → 최종 위치) 실행합니다. 항목 수 상한이 없습니다.

**위험:** 두 관리자가 동시에 재정렬하면 서로의 결과가 섞이거나 `(playlistId, position)` UNIQUE 위반으로 500이 납니다. 항목이 많으면 요청 하나가 오래 걸립니다.

**권장**

1. 트랜잭션 안에서 플레이리스트 행을 먼저 잠급니다(`SELECT … FOR UPDATE`). 같은 플레이리스트의 재정렬이 순서대로 실행됩니다.
2. 잠근 뒤에 항목을 읽고, 요청이 기존 항목 전체와 일치하는지 검사합니다.
3. UPDATE를 `CASE` 한 문장으로 줄입니다. UNIQUE 충돌은 "모두 음수로 옮긴 뒤 최종 위치로" 2문장으로 피합니다.
4. 항목 수 상한(예: 500)을 DTO(`@ArrayMaxSize`)에 둡니다.

**검증:** 동시 재정렬 2건을 보내는 e2e. 둘 다 성공하거나 하나가 409여야 하고, 500은 없어야 합니다.

---

## refresh token 테이블 설계

지금은 access token(JWT) 하나만 있습니다. 2026-11-09에 `sessionVersion`을 넣어 **사용자 단위 취소**는 가능해졌지만, 기기별 로그아웃과 짧은 access token 운영은 아직 할 수 없습니다.

**권장 스키마(초안)**

```sql
CREATE TABLE refresh_tokens (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId      INT NOT NULL,
  tokenHash   CHAR(64) NOT NULL,          -- SHA-256(원문). 원문은 저장하지 않음
  familyId    CHAR(36) NOT NULL,          -- 같은 로그인에서 rotation으로 이어진 토큰 묶음
  expiresAt   DATETIME NOT NULL,
  revokedAt   DATETIME NULL,
  createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY UQ_refresh_tokens_tokenHash (tokenHash),
  KEY IDX_refresh_tokens_userId (userId),
  CONSTRAINT FK_refresh_tokens_user FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);
```

- **rotation:** refresh할 때마다 새 토큰을 발급하고 이전 토큰을 폐기합니다.
- **재사용 탐지:** 이미 폐기된 토큰이 다시 오면 탈취로 보고 같은 `familyId` 전체를 폐기합니다.
- **access token:** 5~15분으로 줄입니다.
- **정리:** 만료된 행은 주기적으로 지웁니다.
- 테이블을 추가하면 `APP_TABLES`(`src/database/database-admin.ts`)에도 넣어야 합니다. 빠지면 소유 판정 spec이 실패합니다.

---

## DB-9: 검색 쿼리

**현상:** legacy 트랙 검색이 `LOWER(title) LIKE '%term%'`입니다. 2026-11-09에 100자 상한과 와일드카드 이스케이프를 넣었지만, 쿼리 구조는 그대로입니다.

**위험:** 앞에 `%`가 있는 LIKE와 컬럼에 함수(`LOWER`)를 씌운 비교는 인덱스를 쓰지 못합니다. 데이터가 늘면 공개 API 하나로 전체 테이블을 매번 읽습니다.

**선택지**

| 방법 | 장점 | 한계 |
| --- | --- | --- |
| `LOWER()` 제거 | collation(`utf8mb4_unicode_ci`)이 이미 대소문자를 구분하지 않음. 바로 적용 가능 | `%term%`이면 여전히 인덱스 불가 |
| 접두사 검색 `term%` + 인덱스 | B-tree 인덱스 사용 | 중간 일치 불가 |
| InnoDB FULLTEXT | 단어 검색이 빠름 | MariaDB에는 MySQL의 ngram 파서가 없어 한국어 부분 일치에 약함 |
| 별도 검색 엔진(OpenSearch 등) | 형태소 분석, 오타 허용 | 운영 부담 |

**권장:** 먼저 `LOWER()`를 제거하고 `EXPLAIN`으로 실행 계획을 확인합니다. 데이터가 수만 건을 넘기 전에 제품 요구(중간 일치가 필요한가)를 정하고 방법을 고릅니다.

---

## DB-10, DB-11: count 쿼리와 풀 설정

- **DB-10:** 공개 플레이리스트 목록이 개수를 세려고 모든 항목을 로드합니다. `COUNT(*)` 서브쿼리나 `loadRelationCountAndMap`으로 바꿉니다.
- **DB-11:** `DB_POOL_MIN`을 검증만 하고 쓰지 않습니다. mysql2 풀에는 최솟값 개념이 없습니다(`maxIdle`, `idleTimeout`이 비슷한 역할). 설정을 지우거나 `maxIdle`로 매핑합니다.

---

## legacy 스키마 폐기와 PostgreSQL 데이터 이전

**legacy(`legacy_*` 테이블, `/music/legacy` 라우트)**

폐기는 expand → contract 순서로 진행합니다([DB·스키마 관리 가이드 6장](database-schema-management.kr.md#6-하위-호환-변경-expand--contract)).

1. 쓰기를 멈춥니다(라우트를 읽기 전용으로).
2. 필요한 데이터를 catalog 테이블로 옮기는 migration을 만들고 검증합니다.
3. 클라이언트가 legacy 라우트를 쓰지 않는지 접근 로그로 확인합니다.
4. 라우트를 제거합니다.
5. 백업 후 `DROP TABLE` migration을 실행합니다. `APP_TABLES`에서도 지웁니다.

**PostgreSQL → MariaDB(main 릴리스)**

main의 운영 DB가 PostgreSQL이었다면 데이터 이전이 필요합니다(11-08 감사 P0).

1. 운영에 실제 사용자 데이터가 있는지 확인합니다.
2. 없으면 MariaDB에 migration만 적용하고 시작합니다.
3. 있으면 `users`를 CSV로 내보내고(`\copy`), MariaDB에 넣는 일회성 스크립트를 작성합니다. 비밀번호 해시(bcrypt)는 그대로 옮길 수 있습니다. 옮긴 뒤 건수와 표본 로그인을 확인합니다.

---

## 모니터링

| 항목 | 방법 |
| --- | --- |
| 느린 쿼리 | `slow_query_log=ON`, `long_query_time=1`. 주기적으로 상위 쿼리를 `EXPLAIN` |
| 연결 수 | `SHOW STATUS LIKE 'Threads_connected'`와 `DB_POOL_MAX` 비교 |
| 오류 | 앱 로그의 `QueryFailedError`, 5xx 비율 |
| 디스크 | 데이터 디렉터리와 백업 디렉터리 사용량 |

---

## 3. migration 작성 규칙 (체크리스트)

- [ ] 이미 적용된 migration은 고치지 않습니다. 예외는 대상 DB에서 **실행 자체가 불가능한** 경우뿐입니다(DB-13).
- [ ] FK·인덱스·unique에 **이름을 명시**하고, entity에도 같은 이름을 선언합니다(DB-12 재발 방지).
- [ ] 컬럼 타입, 길이, 정밀도, 기본값을 entity와 같게 씁니다.
- [ ] `down()`을 작성합니다. 되돌릴 수 없으면 이유를 주석으로 남기고 백업 복원을 롤백 방법으로 문서화합니다.
- [ ] 큰 변경은 expand → (배포) → contract로 나눕니다. 컬럼 삭제·이름 변경은 한 번에 하지 않습니다.
- [ ] 새 테이블은 `APP_TABLES`에 추가합니다.
- [ ] 로컬에서 `migration:show:test` → `db:setup:test` → `migration:revert:test` → `migration:run:test` → `migration:check:test`(새 drift 없음) → `test:e2e`를 실행합니다.
- [ ] 운영 적용 전에 백업하고, PR 본문에 "migration 있음"과 롤백 방법을 적습니다.

## 4. 결정 기록 (2026-11-09)

| 결정 | 이유 |
| --- | --- |
| `sessionVersion`은 `INT UNSIGNED NOT NULL DEFAULT 0` | 기존 행을 바꾸지 않는 추가 전용(expand) 변경. entity와 같게 써서 drift 없음 |
| DB-12는 "코드를 DB에 맞춤" 권장 | 운영 DDL 없이 해결 가능 |
| 계정 분리는 코드 변경 없이 셸 환경변수로 | 이미 셸 값이 파일보다 우선하는 규칙이 있음 |

## 5. 자가 점검 질문

1. drift가 있는 상태에서 `migration:generate`를 실행하면 어떤 위험이 있나요?
2. DB-12를 "DB를 코드에 맞추는" 방식으로 해결하지 않는 이유는 무엇인가요?
3. 런타임 계정에 DDL 권한이 없으면 어떤 공격의 피해가 줄어드나요?
4. 백업을 같은 서버에만 두면 어떤 상황에서 함께 잃나요?
5. `LOWER(title) LIKE '%term%'`이 인덱스를 쓰지 못하는 이유 두 가지는 무엇인가요?
6. refresh token 원문 대신 해시를 저장하는 이유는 무엇인가요?

## 6. 실습 과제

1. **DB-12 한 테이블:** `users` 테이블만 골라 단계 2~4를 적용하고, dry-run 문장 수가 얼마나 줄었는지 기록하세요.
2. **계정 분리 리허설:** Test 서버에서 runtime 계정과 migrator 계정을 만들어 DB-18 단계를 따라 해 보세요(앱 전용 테스트 DB에서만).
3. **복원 훈련:** `app_db_test`를 덤프하고, 새 이름의 테스트 DB에 복원한 뒤 `db:check`로 비교해 보세요. 끝나면 그 테스트 DB만 지웁니다.
4. **재정렬 동시성:** DB-8의 e2e 시나리오를 작성해 현재 코드에서 실패하는지 확인하세요.
