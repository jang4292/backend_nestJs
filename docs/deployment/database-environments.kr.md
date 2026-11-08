# 환경별 DB·설정 가이드 (Dev / Test / Prod)

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 개념과 이유(직접 SQL / 명령 / 자동 실행 비교, 검증 계층)는 [DB·스키마 관리 학습 가이드](../learning/database-schema-management.kr.md)를 보세요. 이 문서는 실행 절차입니다.

모든 환경은 **env 파일 하나**로 설정합니다. 다음이 모두 같은 규칙(`src/config/env-files.ts`)으로 파일을 고릅니다.

- 앱(`npm run start*`)
- migration CLI
- DB 도구(`db:*`)
- e2e

## 1. 환경 매트릭스

| | Dev | Test | Prod |
| --- | --- | --- | --- |
| 실행 위치 | 개발 PC | 개발 PC / CI | EC2 (build + PM2) |
| DB 서버 | 외부 개발 서버(`<dev-db-host>:<port>` 직접 접속) | 개발 서버(같은 서버) | 같은 EC2의 MariaDB(`127.0.0.1:3306`) |
| DB 이름 | `app_db` | `app_db_test` (**`*_test`만 허용**) | 운영 DB(예: `app_db`) |
| DB 계정 | 개발 계정 | 개발 계정 또는 테스트 전용 계정 | `'<app>'@'localhost'` 전용 계정 |
| `NODE_ENV` | `development`(기본) | `test` | `production` |
| env 파일 | `.env` | `.env.test.local` (**필수**) | `.env.production` |
| 템플릿 | `.env.example` | `.env.test.example` | `.env.production.example` |
| 설정 검증(DB 접속 없음, `npm run build` 선행) | `npm run env:check` | `npm run env:check:test` | `npm run env:check:prod` |
| **연결·상태 점검(읽기 전용)** | `npm run db:check` | `npm run db:check:test` | `npm run db:check:prod` |
| **DB 생성 + 테이블 적용** | `npm run db:setup` | `npm run db:setup:test` | 관리자 SQL(4.1) → `migration:run:prod` |
| migration 상태 | `npm run migration:show` | `npm run migration:show:test` | `npm run migration:show:prod` |
| migration 적용 | `npm run migration:run` | `npm run migration:run:test` | `npm run migration:run:prod` |
| 빈 DB에서 전체 재검증 | — | `npm run db:reset:test` | — |
| 앱 실행 | `npm run start:dev` | `npm run test:e2e` | `npm run pm2:reload` |
| SNS 로그인 | 전부 off | 전부 off | 전부 off(로컬 로그인만) |

- **Dev/Test와 Prod는 다른 서버**입니다. 개발·테스트 작업이 운영 데이터에 닿지 않습니다.
- **Test는 개발 서버에 있으므로 DB 이름 규칙으로 분리합니다.** `NODE_ENV=test`에서 `*_test`가 아닌 DB를 지정하면 기동이 실패합니다(`src/config/app-env.ts`).
- **테이블은 항상 migration으로 만듭니다.** `DB_SYNCHRONIZE=false`를 유지하고, 콘솔에서 직접 `CREATE TABLE`하지 않습니다.
- **prod 명령은 `dist` 기반**입니다(`--dist`). 빌드 결과를 node로 실행하므로 ts-node와 `src`가 필요 없으며, 먼저 `npm run build`를 실행해야 합니다.
- 앱은 기동할 때 적용되지 않은 migration이 있으면 로그로 경고합니다(`Migrations` 로그, 운영은 error). 기동을 막지는 않습니다.

### 우선순위와 재지정

1. 이미 export된 셸 환경변수가 파일 값보다 우선합니다. PM2 `--update-env`, Secrets Manager export, CI job env가 여기에 해당합니다.
2. `ENV_FILE=<경로>`를 지정하면 NODE_ENV 규칙 대신 그 파일 하나만 읽습니다. 예: `ENV_FILE=/etc/backend-nestjs/app.env`
3. 파일이 없을 때
   - Test는 기동하지 않습니다(개발 DB 오사용 방지).
   - Dev와 Prod는 환경변수만으로도 기동할 수 있습니다. 필수 값이 빠지면 검증 단계에서 어떤 키가 빠졌는지 알려 줍니다.

> ⚠ EC2 셸에 예전 `eval "$(… secrets:export)"`로 export한 값이 남아 있으면 `.env.production`보다 우선합니다. `.env.production` 방식으로 바꿨다면 새 셸에서 `pm2:reload`하세요. 남은 값은 키 이름만 확인합니다: `env | cut -d= -f1 | grep -E '^(DB_|JWT_)'`

## 2. Dev: 외부 개발 DB 처음 연결하기

```bash
cp .env.example .env      # 이미 있으면 생략
chmod 600 .env
vi .env                   # DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD 입력
npm run db:check          # 읽기 전용: 접속, 계정, TLS, DB 존재, pending migration, 권한
npm run db:setup          # DB가 없으면 utf8mb4로 생성 → migration으로 테이블 생성
npm run start:dev
```

- **비밀번호는 `DB_PASSWORD=` 줄에 직접 입력합니다.**
  - `.env`는 Git에 올라가지 않습니다(`.gitignore`). 채팅, 문서, 커밋에는 남기지 않습니다.
  - 비어 있으면 모든 명령이 `DB_PASSWORD is required.`로 멈춥니다.
  - 값에 `#`이나 공백이 있으면 큰따옴표로 감쌉니다(`DB_PASSWORD="a#b c"`).
- **포트**: 공유기나 NAS에서 포트포워딩했다면 3306이 아닐 수 있습니다. `DB_PORT`에 외부 포트를 적습니다.
- **`db:check` 출력 예**
  ```text
  db:check  NODE_ENV=development  env=.env  <dev-user>@<dev-db-host>:<port>/app_db
  OK  connected as <dev-user>@%
      server   : MariaDB 10.11.x
      tls      : off (credentials and data are sent in plaintext)
      database : app_db — missing (or not visible to this account)
  Next: npm run db:setup   # creates the database, then runs migrations
      grants   :
        GRANT … ON `app_db`.* TO `<dev-user>`@`%`
  ```
- **`db:setup`은 여러 번 실행해도 안전합니다.** DB가 있으면 만들지 않고, 적용된 migration은 다시 실행하지 않습니다.
- **개발 서버 MariaDB는 TLS를 지원하지 않습니다**(`tls: off`). 인터넷 구간에서 계정 정보가 평문으로 오갑니다. 다음 중 하나를 적용하세요.
  - 서버 방화벽이나 공유기에서 DB 포트를 개발자 IP로 제한합니다.
  - SSH 터널로만 접속합니다.
    ```bash
    ssh -N -L 13306:127.0.0.1:3306 <user>@<dev-server>   # .env: DB_HOST=127.0.0.1, DB_PORT=13306
    ```

### 2.1 개발 계정 권한 (서버 관리자, 1회)

`db:setup`이 DB를 만들려면 계정에 해당 DB의 `CREATE` 권한이 있어야 합니다. DB 단위로 권한을 주면, 그 이름의 DB만 만들 수 있고 다른 DB는 건드리지 못합니다. 권한이 없으면 `db:setup`이 아래 SQL을 안내합니다.

```sql
-- '%'는 가능하면 개발자 IP 대역으로 좁힙니다(예: '203.0.113.%').
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON `app_db`.* TO '<dev-user>'@'%';
-- 같은 계정으로 e2e도 실행하는 경우
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON `app_db_test`.* TO '<dev-user>'@'%';
FLUSH PRIVILEGES;
```

## 3. Test: `app_db_test`

```bash
cp .env.test.example .env.test.local   # DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD 입력
chmod 600 .env.test.local
npm run db:setup:test                  # app_db_test가 없으면 생성 → migration 적용
npm run test:e2e
```

- **계정은 두 가지 중 하나를 고릅니다.**
  - 개발 계정을 같이 씁니다. 2.1의 `app_db_test` GRANT가 필요합니다.
  - 테스트 전용 계정을 만듭니다(아래 SQL).
- **빈 DB에서 전체 migration을 다시 검증**하려면 `npm run db:reset:test`를 실행합니다.
  - `app_db_test`를 지우고 다시 만든 뒤 모든 migration을 적용합니다. CI가 매번 하는 것과 같습니다.
  - `NODE_ENV=test`이고 이름이 `*_test`인 DB에서만 동작합니다.
- **최신 migration의 되돌리기를 확인**하려면 `npm run migration:revert:test`를 실행한 뒤 `npm run migration:run:test`를 실행합니다.
- **entity와 migration의 차이(drift)**는 `npm run migration:check:test`로 검사합니다. 차이가 없으면 `No changes in database schema were found`가 출력됩니다.

테스트 전용 계정을 만드는 경우(개발 서버 관리자):

```sql
CREATE DATABASE IF NOT EXISTS app_db_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'app_test'@'%' IDENTIFIED BY '<test-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON app_db_test.* TO 'app_test'@'%';
FLUSH PRIVILEGES;
```

## 4. Prod: EC2 + PM2 + localhost MariaDB

### 4.1 최초 1회: 운영 DB와 계정 (관리자)

운영에서는 앱이 DB를 만들지 않습니다. `db:ensure`는 production에서 거부됩니다. EC2의 MariaDB에서 관리자로 실행합니다. 운영 계정은 `localhost`에서만 접속할 수 있게 만들어, 계정 정보가 유출되어도 외부에서 쓸 수 없게 합니다.

```sql
CREATE DATABASE IF NOT EXISTS <prod_db>
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '<app>'@'localhost' IDENTIFIED BY '<prod-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON <prod_db>.* TO '<app>'@'localhost';
FLUSH PRIVILEGES;
```

`bind-address=127.0.0.1`과 보안그룹 설정으로 3306이 외부에 열려 있지 않은지 확인합니다.

```bash
sudo ss -ltnp | grep 3306    # 127.0.0.1:3306 이어야 함
```

### 4.2 `.env.production` 작성 (서버에서만)

```bash
cd /opt/backend-nestjs           # 프로젝트 루트(ecosystem.config.cjs가 있는 위치)
cp .env.production.example .env.production
chmod 600 .env.production
vi .env.production               # DB_USERNAME/PASSWORD/DATABASE, JWT_SECRET 입력
```

- **`JWT_SECRET`**은 `openssl rand -base64 48`처럼 32자 이상으로 만듭니다. placeholder를 그대로 두면 기동이 **의도적으로 실패**합니다.
- **`CORS_ORIGIN`**
  - 브라우저 프론트엔드가 없으면 `none`으로 둡니다.
  - 웹이 생기면 `https://app.example.com`처럼 origin 목록으로 바꿉니다.
- **`TRUST_PROXY=loopback`**은 같은 호스트의 nginx만 신뢰합니다. nginx가 없어도 안전합니다.

### 4.3 배포 (스키마 변경 포함)

```bash
git pull --ff-only
npm ci
npm run build
npm run env:check:prod           # DB 접속 없이 설정만 검증. FAIL이면 중단
npm run db:check:prod            # 읽기 전용: 접속, 권한, pending migration 확인
mysqldump --single-transaction --routines --triggers <prod_db> > backup-$(date +%Y%m%d%H%M).sql   # pending이 있으면 반드시
npm run migration:show:prod      # 적용될 목록 확인([ ] 표시)
npm run migration:run:prod       # 실패하면 재시작하지 말고 중단(이전 버전이 계속 동작)
npm run pm2:reload               # ecosystem.config.cjs: cwd=프로젝트 루트, NODE_ENV=production
curl -fsS http://127.0.0.1:3000/health
pm2 logs backend-nestjs --lines 50 | grep -i migration   # pending 경고가 없어야 함
```

admin 지정, 스모크 테스트, 롤백은 [EC2 배포 가이드](mariadb-systemd.kr.md)를 따릅니다.

### 4.4 운영 앞단 확인 방법 (nginx 유무)

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

## 5. 스키마 변경 체크리스트

개념과 이유는 [학습 가이드 5~8장](../learning/database-schema-management.kr.md#5-test에서-되던-것이-devprod에-없으면)을 보세요.

1. entity를 변경하고, `npm run migration:generate -- src/database/migrations/<Name>`으로 초안을 만든 뒤 SQL을 리뷰합니다.
2. **하위 호환을 확인합니다.** 삭제와 이름 변경은 다음 릴리스로 나눕니다(expand → contract). 새 NOT NULL 컬럼에는 default를 둡니다.
3. 로컬에서 `npm run db:reset:test` → `npm run migration:check:test` → `npm run test:e2e`를 실행합니다.
4. PR을 올리고 CI `database` job이 통과하는지 확인합니다: 빈 DB 전체 체인 → pending 없음 → 최신 revert/재적용 → drift → e2e.
5. Dev에 적용합니다: `npm run db:check` → `npm run migration:run`. 기존 데이터 위에서 적용되는지 확인합니다.
6. Prod에 적용합니다: 4.3 순서대로 진행하고, 백업 없이 migration을 실행하지 않습니다.

## 6. 자주 나는 오류

| 메시지 | 원인 · 해결 |
| --- | --- |
| `DB_PASSWORD is required.` | env 파일의 `DB_PASSWORD`가 비어 있습니다. 직접 입력합니다 |
| `Access denied for '<user>' (1045)` | 아이디나 비밀번호가 틀렸습니다. 특수문자가 있으면 큰따옴표로 감쌉니다 |
| `does not allow '<user>' from this host (1130)` | 계정의 접속 허용 host에 내 IP가 없습니다. 관리자가 `'<user>'@'<ip>'`를 허용해야 합니다 |
| `blocked after too many failed connections (1129)` | 연결 실패가 반복되어 서버가 내 IP를 차단했습니다. 관리자가 `FLUSH HOSTS`를 실행합니다 |
| `lacks privileges on \`<db>\`` (1044/1227) | DB 생성이나 변경 권한이 없습니다. 출력된 GRANT SQL을 관리자에게 요청합니다(2.1) |
| `Connection refused` / `Timed out` | 주소, 포트, 방화벽, 포트포워딩을 확인합니다 |
| `does not support TLS` | 서버가 TLS를 지원하지 않습니다. `DB_SSL=false`로 둡니다 |
| `Missing .env.test.local` | test 환경 파일이 없습니다. 3장을 따라 만듭니다 |
| `DB_DATABASE must end with _test when NODE_ENV=test.` | test에서 개발 DB를 지정했습니다. `app_db_test`를 사용합니다 |
| `db:ensure is disabled for NODE_ENV=production` | 운영 DB는 관리자 SQL로 만듭니다(4.1) |
| `JWT_SECRET must be a strong production secret.` / `at least 32 characters` | 운영 secret이 placeholder이거나 너무 짧습니다 |
| `CORS_ORIGIN is required when NODE_ENV=production` | 운영 파일에 `CORS_ORIGIN`(origin 목록 또는 `none`)이 없습니다 |
| `DB_USERNAME is required.` (운영) | `.env.production`이 없거나 cwd가 다릅니다. PM2는 `ecosystem.config.cjs`로 실행합니다 |
| `Unknown column 'User.role'` / 기동 로그 `pending migration(s)` | 새 migration이 적용되지 않았습니다. 해당 환경의 `migration:run*`을 실행합니다 |
| `MySql does not support unique constraints` | MariaDB에서 `createUniqueConstraint`를 썼습니다. migration에서는 `TableIndex({ isUnique: true })`를 씁니다 |
| `dist/database/data-source.js not found` | prod 명령 전에 `npm run build`가 필요합니다 |
