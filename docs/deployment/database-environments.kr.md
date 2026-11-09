# 환경별 DB·설정 가이드 (Local / Test / Prod)

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 개념과 이유(직접 SQL / 명령 / 자동 실행 비교, 검증 계층, 삭제 방지)는 [DB·스키마 관리 학습 가이드](../learning/database-schema-management.kr.md)를 보세요. 이 문서는 실행 절차입니다.

모든 환경은 **env 파일 하나**로 설정합니다. 다음이 모두 같은 규칙(`src/config/env-files.ts`)으로 파일을 고릅니다.

- 앱(`npm run start*`)
- migration CLI
- DB 도구(`db:*`)
- e2e

## 1. 환경 구분

| 환경 | 무엇인가 | `NODE_ENV` | env 파일 (템플릿) | DB |
| --- | --- | --- | --- | --- |
| **Local** | 개발 PC에서 앱을 실행(`start:dev`)하고 NAS 개발 DB 서버에 접속 | `development`(기본) | `.env` (`.env.example`) | 개발 서버의 **앱 전용 DB** `app_db_dev` |
| **Test** | Local 안에서 실행하는 e2e와 migration 검증 | `test` | `.env.test.local` (`.env.test.example`), **필수** | 개발 서버의 **앱 전용 DB** `app_db_test` (**`*_test`만 허용**) |
| **Prod** | EC2에서 build 후 PM2로 실행 | `production` | `.env.production` (`.env.production.example`) | 같은 EC2의 MariaDB(`127.0.0.1:3306`) 운영 DB |

| 작업 | Local | Test | Prod (EC2, `npm run build` 후) |
| --- | --- | --- | --- |
| 설정 검증(DB 접속 없음, build 필요) | `npm run env:check` | `npm run env:check:test` | `npm run env:check:prod` |
| **연결·권한·소유·상태 점검(읽기 전용)** | `npm run db:check` | `npm run db:check:test` | `npm run db:check:prod` |
| **DB 생성 + 테이블 적용** | `npm run db:setup` | `npm run db:setup:test` | 관리자 SQL(5.1) → `migration:run:prod` |
| migration 상태 / 적용 | `migration:show` / `migration:run` | `migration:show:test` / `migration:run:test` | `migration:show:prod` / `migration:run:prod` |
| 빈 DB에서 전체 재검증 | — | `npm run db:reset:test` | — |
| 앱 실행 | `npm run start:dev` | `npm run test:e2e` | `npm run pm2:reload` |
| SNS 로그인 | 전부 off | 전부 off | 전부 off(로컬 로그인만) |

- **Local·Test와 Prod는 다른 서버**입니다. 개발·테스트 작업이 운영 데이터에 닿지 않습니다.
- **Local과 Test는 같은 개발 서버, 같은 계정을 쓰고 DB 이름으로 분리합니다.**
  - `NODE_ENV=test`에서는 `*_test`가 아닌 DB를 지정하면 기동이 실패합니다(`src/config/app-env.ts`).
- **개발 서버의 다른 DB는 쓰지 않습니다.** 이 앱은 `app_db_dev`와 `app_db_test`만 사용합니다(2장).
- **테이블은 항상 migration으로만 만듭니다.**
  - `DB_SYNCHRONIZE=true`는 모든 환경에서 기동이 거부됩니다. entity와 다른 컬럼을 자동으로 삭제할 수 있기 때문입니다.
  - 콘솔에서 직접 `CREATE TABLE`하지 않습니다.
- **Prod 명령은 `dist` 기반**입니다(`--dist`). ts-node와 `src`가 필요 없으며, 먼저 `npm run build`를 실행합니다.
- 앱은 기동할 때 적용되지 않은 migration이 있으면 로그로 경고합니다(`Migrations` 로그, Prod는 error). 기동을 막지는 않습니다.

### 명령과 env 파일

**명령마다 읽는 파일이 다릅니다.** 비밀번호를 넣은 파일과 실행한 명령이 맞는지 먼저 확인하세요.

| 명령 | 읽는 파일 |
| --- | --- |
| `db:check`, `db:setup`, `migration:show/run/revert`, `start:dev`, `env:check` | `.env` (Local) |
| `db:check:test`, `db:setup:test`, `db:reset:test`, `migration:*:test`, `test:e2e`, `env:check:test` | `.env.test.local` (Test) |
| `*:prod`, `pm2:reload` | `.env.production` (Prod) |

값이 빠지면 오류가 읽은 파일을 함께 알려 줍니다. 다른 파일에 그 키가 있으면 `Hint:`도 출력합니다(값은 출력하지 않음).

```text
FAIL DB_PASSWORD is required. (env file: .env, NODE_ENV=development)
Hint: .env.test.local has DB_PASSWORD, but that file is read only with NODE_ENV=test (npm run db:check:test, db:setup:test, test:e2e). This command read .env.
```

### 우선순위와 재지정

1. 이미 export된 셸 환경변수가 파일 값보다 우선합니다. PM2 `--update-env`, Secrets Manager export, CI job env가 여기에 해당합니다.
2. `ENV_FILE=<경로>`를 지정하면 NODE_ENV 규칙 대신 그 파일 하나만 읽습니다. 예: `ENV_FILE=/etc/backend-nestjs/app.env`
3. 파일이 없을 때
   - Test는 기동하지 않습니다(개발 DB 오사용 방지).
   - Local과 Prod는 환경변수만으로도 기동할 수 있습니다. 필수 값이 빠지면 검증 단계에서 어떤 키가 빠졌는지 알려 줍니다.

> ⚠ EC2 셸에 예전 `eval "$(… secrets:export)"`로 export한 값이 남아 있으면 `.env.production`보다 우선합니다. `.env.production` 방식으로 바꿨다면 새 셸에서 `pm2:reload`하세요. 남은 값은 키 이름만 확인합니다: `env | cut -d= -f1 | grep -E '^(DB_|JWT_)'`

## 2. DB 삭제 안전 원칙

DB 서버에는 다른 앱이나 예전에 쓰던 DB가 있을 수 있습니다. **이 앱의 명령은 자기 전용 DB 하나만 다루고, 그 밖의 DB와 객체는 절대 지우거나 바꾸지 않습니다.**

| 명령 | 바꿀 수 있는 범위 | 안전장치 |
| --- | --- | --- |
| `db:check*` | 없음(읽기 전용) | `SELECT`·`SHOW`만 실행합니다 |
| `db:setup`, `db:setup:test` | 대상 DB(`DB_DATABASE`) 하나: 없으면 생성, 이후 migration | 다음 경우 **아무것도 바꾸지 않고** 멈춥니다<br>대상 DB에 앱이 관리하지 않는 객체(테이블, 뷰, 시퀀스, 루틴, 이벤트)가 있을 때<br>migration 권한이 부족할 때 |
| `db:reset:test` | 대상 `*_test` DB 하나: 지우고 다시 생성 | `NODE_ENV=test`이고 이름이 `*_test`이며, **앱 소유 테이블만 있을 때만** 동작합니다 |
| `migration:run*` | 대상 DB 안의 앱 테이블 | `CREATE`·`ALTER`·`RENAME`은 앱 테이블에만 실행합니다. `DROP TABLE`은 revert에만 있습니다 |
| `migration:revert*` | 대상 DB 안의 앱 테이블(마지막 1개) | Prod에서는 백업 후에만 실행합니다 |
| Prod | DB 생성·삭제 명령 없음 | `db:ensure`·`db:reset`은 거부됩니다. 운영 DB는 관리자가 만듭니다 |
| 앱 기동 | 없음 | `synchronize` 금지, migration 자동 실행 없음, pending 경고만 |

- **"앱 소유"의 기준:** `APP_TABLES`(`src/database/database-admin.ts`)는 migration이 만들거나 이름을 바꾸는 테이블 목록입니다. 대상 DB의 모든 객체가 이 목록 안에 있어야 앱 소유입니다. spec이 entity와 migration 소스를 이 목록과 대조합니다.
- **`db:check`의 `ownership` 줄**
  - `dedicated (N app tables)`: 앱 전용 DB입니다.
  - `shared — N object(s) not managed by this app: …`: 다른 객체가 섞여 있습니다. `db:setup`·`db:reset`이 거부하므로 전용 DB를 쓰세요.
- **GRANT는 앱 전용 DB 단위로만 줍니다.** `ON *.*`(전역)나 다른 DB에는 권한을 주지 않습니다. `DROP` 권한도 그 DB 안에서만 유효합니다.
- 다른 DB에 대한 권한은 이 앱에 필요 없습니다. 예전에 받은 권한은 회수해도 됩니다(선택).

## 3. Local: 개발 PC + 개발 서버의 `app_db_dev`

### 3.1 최초 1회: 앱 전용 DB 권한 (서버 관리자)

서버 관리자(root)로 실행합니다. Synology라면 phpMyAdmin이나 MariaDB CLI를 씁니다. **다른 DB는 건드리지 않습니다.** DB 단위 `CREATE` 권한이 있으면 `db:setup`이 그 이름의 DB를 직접 만들 수 있습니다.

```sql
-- '%'는 가능하면 개발자 IP 대역으로 좁힙니다(예: '203.0.113.%').
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX
  ON `app_db_dev`.* TO '<dev-user>'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX
  ON `app_db_test`.* TO '<dev-user>'@'%';
```

| 권한 | 필요한 이유 | 없으면 |
| --- | --- | --- |
| `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `migrations` 기록, 데이터 보정(`INSERT … SELECT`, `UPDATE … JOIN`) | 첫 migration부터 실패 |
| `CREATE` | `CREATE TABLE`. DB 단위로 주면 그 이름의 `CREATE DATABASE`도 가능 | 테이블이나 DB 생성 불가 |
| `ALTER` | 컬럼·FK·제약 변경, `RENAME TABLE` | 컬럼 추가에서 실패 |
| `DROP` | `RENAME TABLE`의 원본(`ArchiveLegacyMusicSchema`), revert의 `DROP TABLE`, `db:reset:test` | **9개 중 6번째에서 중간 실패** |
| `INDEX` | `CREATE/DROP INDEX` | 인덱스 생성에서 실패 |

- `REFERENCES`는 MariaDB에서 사용하지 않는 권한이라 필요 없습니다(FK 생성에도 불필요).
- 권한은 부여 즉시 반영됩니다. `db:check`에서 `privilege: ok`를 확인합니다.
- 일부만 있다면 `db:check`가 출력한 **빠진 권한만** 추가합니다.

### 3.2 연결과 생성

```bash
cp .env.example .env      # 이미 있으면 생략
chmod 600 .env
vi .env                   # DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE=app_db_dev
npm run db:check          # 읽기 전용: 접속, TLS, 권한, DB 존재, 소유, pending migration
npm run db:setup          # app_db_dev가 없으면 utf8mb4로 생성 → migration으로 테이블 생성
npm run start:dev
```

- **비밀번호는 `DB_PASSWORD=` 줄에 직접 입력합니다.**
  - `.env`는 Git에 올라가지 않습니다(`.gitignore`). 채팅, 문서, 커밋에는 남기지 않습니다.
  - 값에 `#`이나 공백이 있으면 큰따옴표로 감쌉니다(`DB_PASSWORD="a#b c"`).
- **포트:** 공유기나 NAS에서 포트포워딩했다면 3306이 아닐 수 있습니다. `DB_PORT`에 외부 포트를 적습니다.
- **DB 이름**
  - 앱 전용 이름(`app_db_dev`)을 씁니다. 영문, 숫자, `_`, `-`를 쓸 수 있습니다.
  - 다른 객체가 있는 DB를 지정하면 `db:setup`이 거부합니다(2장).
- **`db:setup`은 여러 번 실행해도 안전합니다.** DB가 있으면 만들지 않고, 적용된 migration은 다시 실행하지 않습니다.
- **`db:check` 출력 예**(권한 부여 전)
  ```text
  db:check  NODE_ENV=development  env=.env  <dev-user>@<dev-db-host>:<port>/app_db_dev
  OK  connected as <dev-user>@%
      server   : MariaDB 10.11.x
      tls      : off (credentials and data are sent in plaintext)
      privilege: missing SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX on `app_db_dev` — migrations would fail midway
        fix (DB admin): GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX ON `app_db_dev`.* TO '<dev-user>'@'%';
      database : app_db_dev — missing (or not visible to this account)
      visible  : <other-db>
      grants   : …

  Next: ask a DB admin to run the GRANT above, then npm run db:setup
  ```
- **`db:check` 출력 예**(적용 후)
  ```text
      privilege: ok for migrations on `app_db_dev`
      database : app_db_dev (utf8mb4/utf8mb4_unicode_ci, 11 tables)
      ownership: dedicated (11 app tables)
      migration: 9 applied, 0 pending (9 in this build)
  ```
- **개발 서버 MariaDB는 TLS를 지원하지 않습니다**(`tls: off`). 인터넷 구간에서 계정 정보가 평문으로 오갑니다. 다음 중 하나를 적용하세요.
  - 서버 방화벽이나 공유기에서 DB 포트를 개발자 IP로 제한합니다.
  - SSH 터널로만 접속합니다.
    ```bash
    ssh -N -L 13306:127.0.0.1:3306 <user>@<dev-server>   # .env: DB_HOST=127.0.0.1, DB_PORT=13306
    ```

## 4. Test: 개발 서버의 `app_db_test`

```bash
cp .env.test.example .env.test.local   # DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD 입력(Local과 같은 계정)
chmod 600 .env.test.local
npm run db:setup:test                  # app_db_test가 없으면 생성 → migration 적용
npm run db:check:test -- --strict      # 권한·소유·pending 모두 OK면 종료 코드 0
npm run test:e2e
```

- **계정:** Local 계정을 같이 씁니다(3.1의 `app_db_test` GRANT). 테스트 전용 계정을 따로 만들어도 됩니다.
- **빈 DB에서 전체 migration 재검증:** `npm run db:reset:test`
  - `app_db_test`를 지우고 다시 만든 뒤 모든 migration을 적용합니다. CI가 매번 하는 것과 같습니다.
  - 앱 소유 테이블만 있을 때만 동작하고, 다른 객체가 있으면 목록을 보여 주고 거부합니다.
- **최신 migration 되돌리기 확인:** `npm run migration:revert:test` 후 `npm run migration:run:test`
- **entity와 migration의 차이(drift):** `npm run migration:check:test`. 현재는 차이가 보고됩니다(감사 DB-12).

## 5. Prod: EC2 + PM2 + localhost MariaDB

### 5.1 최초 1회: 운영 DB와 계정 (관리자)

운영에서는 앱이 DB를 만들거나 지우지 않습니다(`db:ensure`·`db:reset` 거부). EC2의 MariaDB에서 관리자로 실행합니다. 운영 계정은 `localhost`에서만 접속할 수 있게 만들어, 계정 정보가 유출되어도 외부에서 쓸 수 없게 합니다.

```sql
CREATE DATABASE IF NOT EXISTS <prod_db>
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '<app>'@'localhost' IDENTIFIED BY '<prod-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX
  ON <prod_db>.* TO '<app>'@'localhost';
FLUSH PRIVILEGES;
```

`bind-address=127.0.0.1`과 보안그룹으로 3306이 외부에 열려 있지 않은지 확인합니다.

```bash
sudo ss -ltnp | grep 3306    # 127.0.0.1:3306 이어야 함
```

### 5.2 `.env.production` 작성 (서버에서만)

```bash
cd /opt/backend-nestjs           # 프로젝트 루트(ecosystem.config.cjs가 있는 위치)
cp .env.production.example .env.production
chmod 600 .env.production
vi .env.production               # DB_USERNAME/PASSWORD/DATABASE, JWT_SECRET 입력
```

- **`JWT_SECRET`**은 `openssl rand -base64 48`처럼 32자 이상으로 만듭니다. placeholder를 그대로 두면 기동이 **의도적으로 실패**합니다.
- **`CORS_ORIGIN`:** 브라우저 프론트엔드가 없으면 `none`, 웹이 생기면 `https://app.example.com` 같은 origin 목록으로 바꿉니다.
- **`TRUST_PROXY=loopback`**은 같은 호스트의 nginx만 신뢰합니다. nginx가 없어도 안전합니다.

### 5.3 배포 (스키마 변경 포함)

```bash
git pull --ff-only
npm ci
npm run build
npm run env:check:prod           # DB 접속 없이 설정만 검증. FAIL이면 중단
npm run db:check:prod            # 읽기 전용: 접속, 권한, 소유, pending migration 확인
umask 077; mkdir -p ~/backups  # 덤프는 저장소 밖, 본인만 읽기(사용자 데이터·비밀번호 해시 포함)
mysqldump --single-transaction --routines --triggers <prod_db> | gzip > ~/backups/<prod_db>-$(date +%Y%m%d%H%M).sql.gz   # pending이 있으면 반드시
npm run migration:show:prod      # 적용될 목록 확인([ ] 표시)
npm run migration:run:prod       # 실패하면 재시작하지 말고 중단(이전 버전이 계속 동작)
npm run pm2:reload               # ecosystem.config.cjs: cwd=프로젝트 루트, NODE_ENV=production
curl -fsS http://127.0.0.1:3000/health
pm2 logs backend-nestjs --lines 50 | grep -i migration   # pending 경고가 없어야 함
```

admin 지정, 스모크 테스트, 롤백은 [EC2 배포 가이드](mariadb-systemd.kr.md)를 따릅니다.

### 5.4 운영 앞단 확인 방법 (nginx 유무)

EC2에서 실행해 보고, 결과에 따라 `TRUST_PROXY`와 `CORS_ORIGIN`을 조정합니다.

```bash
sudo ss -ltnp | grep -E ':(80|443|3000)\b'                # 80/443을 nginx가 듣는지, 3000을 node가 듣는지
ls /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
sudo nginx -T 2>/dev/null | grep -E 'server_name|listen|proxy_pass'
pm2 ls
```

| 결과 | 설정 |
| --- | --- |
| nginx가 같은 서버에서 `proxy_pass http://127.0.0.1:3000` | `TRUST_PROXY=loopback`(기본값) |
| proxy 없음, node가 직접 노출 | `loopback` 그대로 사용(클라이언트 헤더 무시) |
| ALB/CloudFront 등 다른 호스트의 proxy | `TRUST_PROXY=1`(hop 수) 또는 proxy IP/CIDR |

## 6. 스키마 변경 체크리스트

개념과 이유는 [학습 가이드 5~8장](../learning/database-schema-management.kr.md#5-test에서-되던-것이-localprod에-없으면)을 보세요.

1. entity를 변경하고, `npm run migration:generate -- src/database/migrations/<Name>`으로 초안을 만든 뒤 SQL을 리뷰합니다.
2. **하위 호환을 확인합니다.** 삭제와 이름 변경은 다음 릴리스로 나눕니다(expand → contract). 새 NOT NULL 컬럼에는 default를 둡니다.
3. 새 테이블을 만들었다면 `APP_TABLES`에 추가합니다. spec이 누락을 알려 줍니다.
4. Test에서 확인합니다: `npm run db:reset:test` → `npm run migration:check:test` → `npm run test:e2e`
5. PR을 올리고 CI `database` job이 통과하는지 확인합니다: 빈 DB 전체 체인 → pending 없음 → 최신 revert/재적용 → drift → e2e
6. Local에 적용합니다: `npm run db:check` → `npm run db:setup`. 기존 데이터 위에서 적용되는지 확인합니다.
7. Prod에 적용합니다: 5.3 순서대로 진행하고, 백업 없이 migration을 실행하지 않습니다.

migration을 작성할 때의 규칙(이름 명시, entity와 같은 타입, `down()`, expand → contract)은 [DB 개선 가이드 3장](../learning/database-improvement-guide.kr.md#3-migration-작성-규칙-체크리스트)에 체크리스트로 있습니다. 운영 계정을 migration용과 런타임용으로 나누는 방법은 [DB-18](../learning/database-improvement-guide.kr.md#db-18-migration-계정과-런타임-계정-분리)을 봅니다.

## 7. 자주 나는 오류

| 메시지 | 원인 · 해결 |
| --- | --- |
| `DB_PASSWORD is required. (env file: …)` | **그 파일**의 `DB_PASSWORD`가 비어 있습니다. `Hint:`가 나오면 다른 파일에 넣은 것입니다. 명령과 파일의 대응은 1장 표를 봅니다 |
| `Access denied for '<user>' (1045)` | 아이디나 비밀번호가 틀렸습니다. 특수문자가 있으면 큰따옴표로 감쌉니다 |
| `does not allow '<user>' from this host (1130)` | 계정의 접속 허용 host에 내 IP가 없습니다. 관리자가 `'<user>'@'<ip>'`를 허용해야 합니다 |
| `blocked after too many failed connections (1129)` | 연결 실패가 반복되어 서버가 내 IP를 차단했습니다. 관리자가 `FLUSH HOSTS`를 실행합니다 |
| `lacks privileges on \`<db>\`` (1044/1227) | DB 생성이나 변경 권한이 없습니다. 출력된 GRANT SQL을 관리자에게 요청합니다(3.1) |
| `privilege: missing …` / `is missing … Stopped before changing anything` | migration에 필요한 권한이 부족합니다. 아무것도 바뀌지 않았습니다. 출력된 GRANT를 실행한 뒤 다시 실행합니다(3.1) |
| `ownership: shared` / `contains N object(s) not managed by this app` | 대상 DB에 다른 앱의 객체가 있습니다. 아무것도 바뀌지 않았습니다. `DB_DATABASE`를 앱 전용 DB로 바꿉니다(2장) |
| `DB_SYNCHRONIZE must be false.` | 어떤 환경에서도 `synchronize`를 켤 수 없습니다. 스키마는 migration으로 바꿉니다 |
| `Connection refused` / `Timed out` | 주소, 포트, 방화벽, 포트포워딩을 확인합니다 |
| `does not support TLS` | 서버가 TLS를 지원하지 않습니다. `DB_SSL=false`로 둡니다 |
| `Missing .env.test.local` | Test 환경 파일이 없습니다. 4장을 따라 만듭니다 |
| `DB_DATABASE must end with _test when NODE_ENV=test.` | Test에서 다른 DB를 지정했습니다. `app_db_test`를 사용합니다 |
| `db:ensure is disabled for NODE_ENV=production` | 운영 DB는 관리자 SQL로 만듭니다(5.1) |
| `JWT_SECRET must be a strong production secret.` / `at least 32 characters` | 운영 secret이 placeholder이거나 너무 짧습니다 |
| `CORS_ORIGIN is required when NODE_ENV=production` | 운영 파일에 `CORS_ORIGIN`(origin 목록 또는 `none`)이 없습니다 |
| `DB_USERNAME is required.` (운영) | `.env.production`이 없거나 cwd가 다릅니다. PM2는 `ecosystem.config.cjs`로 실행합니다 |
| `Unknown column 'User.role'` / 기동 로그 `pending migration(s)` | 새 migration이 적용되지 않았습니다. 해당 환경의 `db:setup*` 또는 `migration:run*`을 실행합니다 |
| `MySql does not support unique constraints` | MariaDB에서 `createUniqueConstraint`를 썼습니다. migration에서는 `TableIndex({ isUnique: true })`를 씁니다 |
| `dist/database/data-source.js not found` | Prod 명령 전에 `npm run build`가 필요합니다 |
