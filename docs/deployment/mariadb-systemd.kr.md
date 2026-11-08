# EC2 + MariaDB 배포 가이드

> 최신화 기준: 2026-11-08 · develop `9b731ef` + `chore/project-audit-2026-11`

NestJS 프로세스와 MariaDB가 같은 EC2 호스트에 있는 구성을 기준으로 합니다.

- DB 연결은 `127.0.0.1:3306`을 사용하고 3306 포트는 외부에 공개하지 않습니다.
- 실제 계정과 비밀번호는 서버의 `.env.production`(Git 미추적, chmod 600)에만 둡니다. 저장소, systemd unit, PM2 설정 파일에는 넣지 않습니다.

## 1. 실행 방식

| 방식 | 설정 주입 | 사용 시점 |
| --- | --- | --- |
| **PM2 + `.env.production` (기본)** | 프로젝트 루트의 `.env.production`(chmod 600)을 앱이 직접 읽음. `ecosystem.config.cjs`가 `cwd`와 `NODE_ENV=production`을 고정 | 현재 운영 기본 경로 |
| PM2 + Secrets Manager (선택) | `eval "$(… npm run -s secrets:export)"`로 셸에 export한 값이 `.env.production`보다 우선 | 비밀값을 서버 파일에 두지 않을 때 |
| systemd (대안) | `deploy/backend-nestjs.service.example`. `WorkingDirectory`의 `.env.production`을 앱이 읽음 | PM2를 쓰지 않을 때 |

- 환경별 파일 규칙, 운영 DB 계정 SQL, nginx 확인 방법은 [환경별 DB·설정 가이드](database-environments.kr.md)를 참고하세요.
- PM2와 Secrets Manager export는 `scripts/runtime-env-keys.cjs`에 나열된 키만 전달합니다. 새 환경변수를 추가하면 `src/config/app-env.ts`와 이 목록을 함께 고칩니다(어긋나면 `runtime-env-keys.spec.ts`가 실패).

## 2. 배포 전 점검

- [ ] DB 백업을 완료했습니다([MariaDB 운영](../music/database/mariadb-operations.md#backup-및-restore)).
- [ ] 서버의 `.env.production`을 최신 템플릿(`.env.production.example`)과 비교해, 빠진 키가 없습니다.
- [ ] **`npm run env:check:prod`가 `OK`입니다.**
  - 이 명령은 서버·DB에 접속하지 않고 기동 시와 같은 검증만 실행합니다.
  - 다음 항목이 틀리면 `FAIL`로 알려 줍니다: `NODE_ENV=production`, `JWT_SECRET` 32자 이상·placeholder 금지, `CORS_ORIGIN`(origin 목록 또는 `none`), `DB_SYNCHRONIZE=false`, 활성 SNS provider의 필수 키
- [ ] SNS 로그인은 전부 `false`입니다(로컬 로그인만). 켜려면 [재활성화 체크리스트](../auth/sns-reenable-checklist.kr.md)를 먼저 완료합니다.
- [ ] `TRUST_PROXY=loopback`(같은 호스트의 nginx 또는 proxy 없음). 외부 ALB면 hop 수로 바꿉니다.
- [ ] DB는 `127.0.0.1:3306`이며 3306이 외부에 열려 있지 않습니다(`sudo ss -ltnp | grep 3306`).

## 3. PM2 배포 절차

```bash
cd /opt/backend-nestjs
git pull --ff-only
npm ci
npm run build

npm run env:check:prod           # FAIL이면 중단
npm run migration:show:prod      # dist 기반, .env.production 사용
npm run migration:run:prod       # 실패하면 여기서 중단하고 재시작하지 않습니다

npm run pm2:reload
curl -fsS http://127.0.0.1:${PORT:-3000}/health   # DB 장애 시 503 → curl 실패
pm2 logs backend-nestjs --lines 50
```

- PM2 fork 모드의 reload는 새 프로세스가 기동에 실패해도 이전 프로세스를 유지하지 않습니다. 그래서 `env:check:prod`를 먼저 실행합니다.
- `kill_timeout`은 10초입니다. 이 시간 안에 앱이 graceful shutdown(`enableShutdownHooks`)으로 진행 중인 요청과 DB 풀을 정리합니다.
- **Secrets Manager를 쓰는 경우:** `migration:*:prod`와 `pm2:reload` 전에 `eval "$(AWS_SECRET_ID=<secret-id> AWS_REGION=ap-northeast-2 npm run -s secrets:export)"`를 실행합니다. export한 값이 `.env.production`보다 우선합니다.
  - 출력에 비밀값이 들어 있으므로 `eval` 없이 실행하거나 `set -x`, CI 로그에 남기지 않습니다.
- `pm2 save`는 환경변수를 `~/.pm2/dump.pm2`에 평문으로 저장합니다. 꼭 필요할 때만 쓰고 파일 권한을 확인합니다.

## 4. systemd 배포 절차 (대안)

1. `deploy/backend-nestjs.service.example`을 `/etc/systemd/system/backend-nestjs.service`로 복사하고, 배포 경로(`WorkingDirectory`)와 서비스 계정을 맞춥니다.
2. `WorkingDirectory`에 `.env.production`을 두고(chmod 600, 서비스 계정 소유), `npm run env:check:prod`와 `npm run migration:run:prod`를 실행합니다.
3. 서비스를 기동합니다.
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now backend-nestjs
   ```

## 5. 배포 후 작업

**admin 지정** (최초 1회, `1765000000000-AddRoleToUsers` 적용 후):

```sql
UPDATE users SET role = 'admin' WHERE username = '<admin-username>';
SELECT id, username, role FROM users WHERE role = 'admin';
```

역할은 매 요청마다 DB에서 다시 읽으므로, 변경 즉시 반영되고 재로그인이 필요 없습니다.

**스모크 테스트:**

- `GET /health`가 200 `{"status":"ok","database":"up"}`인지 확인합니다.
- `GET /music/public/playlists`가 200인지 확인합니다.
- 일반 사용자 토큰으로 `POST /music/tracks`를 보내 403, admin 토큰으로는 201인지 확인합니다.
- 비활성 provider `POST /auth/<provider>/login`이 503 `AUTH_<PROVIDER>_DISABLED`인지 확인합니다.

## 6. 롤백

- 애플리케이션: 이전 커밋으로 `npm ci && npm run build && npm run pm2:reload`
- 최근 migration: `npm run migration:revert:prod`(`AddRoleToUsers`는 컬럼만 삭제)
- `ArchiveLegacyMusicSchema`·`RepairLegacyMariaDbSchema`는 down이 없습니다. 문제가 생기면 배포 전 백업으로 복원합니다.

## 7. DB TLS (원격 DB 또는 RDS로 옮길 때)

1. 서버에서 `SHOW VARIABLES LIKE 'have_ssl'`, `require_secure_transport`를 확인합니다.
2. CA 번들을 호스트마다 내려받습니다. 이 파일은 Git에 커밋하지 않습니다.
   ```bash
   curl -fsSL -o config/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
   ```
3. `DB_SSL=true`, `DB_SSL_REJECT_UNAUTHORIZED=true`, `DB_SSL_CA=<절대경로>/config/global-bundle.pem`을 설정합니다. production에서 `DB_SSL=true`이면서 인증서 검증을 켰는데 CA가 없으면 기동이 실패합니다.
