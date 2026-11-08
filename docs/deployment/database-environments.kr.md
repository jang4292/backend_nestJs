# 환경별 DB·설정 가이드 (Dev / Test / Prod)

> 최신화 기준: 2026-11-08 · develop `9b731ef` + `chore/project-audit-2026-11`

모든 환경은 **env 파일 하나**로 설정합니다. 앱(`npm run start*`), migration CLI, e2e가 같은 규칙(`src/config/env-files.ts`)으로 파일을 고릅니다.

## 1. 환경 매트릭스

| | Dev | Test | Prod |
| --- | --- | --- | --- |
| 실행 위치 | 개발 PC | 개발 PC / CI | EC2 (build + PM2) |
| DB 서버 | 외부 개발 서버(도메인:3306 직접 접속) | 개발 서버 | 같은 EC2의 MariaDB(`127.0.0.1:3306`) |
| DB 이름 | `app_db` | `app_db_test` (**`*_test`만 허용**) | 운영 DB(예: `app_db`) |
| DB 계정 | 개발 계정 | 테스트 전용 계정 | `'<app>'@'localhost'` 전용 계정 |
| `NODE_ENV` | `development`(기본) | `test` | `production` |
| env 파일 | `.env` | `.env.test.local` (**필수**) | `.env.production` |
| 템플릿 | `.env.example` | `.env.test.example` | `.env.production.example` |
| 설정 검증(DB 접속 없음, `npm run build` 선행) | `npm run env:check` | `npm run env:check:test` | `npm run env:check:prod` |
| 앱 실행 | `npm run start:dev` | `npm run test:e2e` | `npm run pm2:reload` |
| migration 상태 | `npm run migration:show` | `npm run migration:show:test` | `npm run migration:show:prod` |
| migration 적용 | `npm run migration:run` | `npm run migration:run:test` | `npm run migration:run:prod` |
| SNS 로그인 | 전부 off | 전부 off | 전부 off(로컬 로그인만) |

- **dev와 운영은 다른 서버**이므로 개발·테스트 작업이 운영 데이터에 닿지 않습니다.
- **Test는 개발 서버에 있으므로 DB 이름 규칙으로 분리합니다.** `NODE_ENV=test`에서 `*_test`가 아닌 DB를 지정하면 기동이 실패합니다(`src/config/app-env.ts`).
- **prod migration은 `dist` 기반**입니다(`--dist`). 빌드 결과(`dist/database/data-source.js`)를 node로 실행하므로 ts-node와 `src`가 필요 없으며, 먼저 `npm run build`를 실행해야 합니다.

### 우선순위와 재지정

1. 이미 export된 셸 환경변수가 파일 값보다 우선합니다. PM2 `--update-env`, Secrets Manager export가 여기에 해당합니다.
2. `ENV_FILE=<경로>`를 지정하면 NODE_ENV 규칙 대신 그 파일 하나만 읽습니다. 예: `ENV_FILE=/etc/backend-nestjs/app.env`
3. 파일이 없을 때
   - Test는 기동하지 않습니다(개발 DB 오사용 방지).
   - Dev와 Prod는 환경변수만으로도 기동할 수 있고, 필수 값이 빠지면 검증 단계에서 어떤 키가 빠졌는지 알려 줍니다.

> ⚠ EC2 셸에 예전 `eval "$(… secrets:export)"`로 export한 값이 남아 있으면 `.env.production`보다 우선합니다. `.env.production` 방식으로 바꿨다면 새 셸에서 `pm2:reload`하거나 `env | grep -E '^(DB_|JWT_)'`로 남은 값을 확인하세요(값은 출력하지 않도록 키 이름만 보세요: `env | cut -d= -f1 | grep -E '^(DB_|JWT_)'`).

## 2. Dev: 외부 개발 DB

```bash
cp .env.example .env      # DB_HOST, DB_USERNAME, DB_PASSWORD 입력
npm run migration:show    # 대기 중인 migration 확인
npm run migration:run     # 개발 DB에 적용
npm run start:dev
```

- 개발 서버 MariaDB는 TLS가 꺼져 있습니다(`have_ssl=Disabled`). 인터넷으로 접속하면 계정 정보가 평문으로 오가므로, **개발 서버 보안그룹에서 3306을 개발자 IP로 제한**하세요.
- 3306을 닫고 싶으면 SSH 터널로 접속할 수 있습니다.
  ```bash
  ssh -N -L 13306:127.0.0.1:3306 <user>@<dev-server>   # .env: DB_HOST=127.0.0.1, DB_PORT=13306
  ```

## 3. Test: `app_db_test` 준비 (개발 서버, 1회)

개발 서버 MariaDB에 관리자 계정으로 접속해 실행합니다. 비밀번호는 문서나 Git에 남기지 말고, 실행할 때만 입력하세요.

```sql
CREATE DATABASE IF NOT EXISTS app_db_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 접속할 IP 대역으로 '%'를 좁히는 것을 권장합니다(예: '203.0.113.%').
CREATE USER IF NOT EXISTS 'app_test'@'%' IDENTIFIED BY '<test-password>';

-- 테스트 DB에만 권한(migration 실행을 위해 DDL 포함). 개발 DB(app_db)에는 권한을 주지 않습니다.
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON app_db_test.* TO 'app_test'@'%';
FLUSH PRIVILEGES;
```

```bash
cp .env.test.example .env.test.local   # DB_HOST, DB_USERNAME=app_test, DB_PASSWORD 입력
npm run migration:run:test             # app_db_test에 스키마 적용
npm run test:e2e
```

## 4. Prod: EC2 + PM2 + localhost MariaDB

### 4.1 최초 1회: 운영 DB 계정

EC2의 MariaDB에서 실행합니다. 운영 계정은 `localhost`에서만 접속할 수 있게 만들어, 계정 정보가 유출되어도 외부에서 쓸 수 없게 합니다.

```sql
CREATE DATABASE IF NOT EXISTS <prod_db>
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '<app>'@'localhost' IDENTIFIED BY '<prod-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON <prod_db>.* TO '<app>'@'localhost';
FLUSH PRIVILEGES;
```

`bind-address=127.0.0.1`과 보안그룹으로 3306이 외부에 열려 있지 않은지 확인합니다.

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

- `JWT_SECRET`은 `openssl rand -base64 48`처럼 32자 이상으로 만듭니다. placeholder를 그대로 두면 기동이 **의도적으로 실패**합니다.
- `CORS_ORIGIN`
  - 브라우저 프론트엔드가 없으면 `none`으로 둡니다.
  - 웹이 생기면 `https://app.example.com`처럼 origin 목록으로 바꿉니다.
- `TRUST_PROXY=loopback`은 같은 호스트의 nginx만 신뢰합니다. nginx가 없어도 안전합니다.

### 4.3 배포

```bash
git pull --ff-only
npm ci
npm run build
npm run env:check:prod           # DB 접속 없이 설정만 검증. FAIL이면 중단
npm run migration:show:prod      # .env.production 기준, dist로 실행
npm run migration:run:prod       # 실패하면 재시작하지 말고 중단
npm run pm2:reload               # ecosystem.config.cjs: cwd=프로젝트 루트, NODE_ENV=production
curl -fsS http://127.0.0.1:3000/health
```

배포 전 백업, admin 지정, 스모크 테스트, 롤백은 [EC2 배포 가이드](mariadb-systemd.kr.md)를 따릅니다.

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

## 5. 자주 나는 오류

| 메시지 | 원인 · 해결 |
| --- | --- |
| `Missing .env.test.local` | test 환경 파일이 없습니다. 3장을 따라 만듭니다 |
| `DB_DATABASE must end with _test when NODE_ENV=test.` | test에서 개발 DB를 지정했습니다. `app_db_test`를 사용합니다 |
| `JWT_SECRET must be a strong production secret.` / `at least 32 characters` | 운영 secret이 placeholder이거나 너무 짧습니다 |
| `CORS_ORIGIN is required when NODE_ENV=production` | 운영 파일에 `CORS_ORIGIN`(origin 목록 또는 `none`)이 없습니다 |
| `DB_USERNAME is required.` (운영) | `.env.production`이 없거나 cwd가 다릅니다. PM2는 `ecosystem.config.cjs`로 실행하세요 |
| `Unknown column 'User.role'` | 새 migration(`AddRoleToUsers`)이 적용되지 않았습니다. 해당 환경의 `migration:run*`을 실행합니다 |
| `dist/database/data-source.js not found` | `migration:*:prod` 전에 `npm run build`가 필요합니다 |
