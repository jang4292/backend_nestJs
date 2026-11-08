# EC2 + MariaDB 배포 가이드

> 최신화 기준: 2026-11-08 · develop `9b731ef` + `chore/project-audit-2026-11`

NestJS 프로세스와 MariaDB가 같은 EC2 호스트에 있는 구성을 기준으로 합니다.

- DB 연결은 `127.0.0.1:3306`을 사용하고 3306 포트는 외부에 공개하지 않습니다.
- 실제 계정과 비밀번호는 저장소, systemd unit, PM2 설정 파일에 넣지 않습니다.

## 1. 실행 방식

| 방식 | 비밀값 주입 | 사용 시점 |
| --- | --- | --- |
| **PM2 (기본)** | `npm run -s secrets:export`로 Secrets Manager 값을 셸 환경에 export하고 `npm run pm2:reload`로 전달 | 현재 운영 기본 경로 |
| systemd | `/etc/backend-nestjs/backend-nestjs.env`(root 600)를 `EnvironmentFile=`로 주입 | Secrets Manager를 쓰지 않는 호스트 |

PM2에는 `scripts/runtime-env-keys.cjs`에 나열된 키만 전달됩니다.

- `ecosystem.config.cjs`와 `scripts/export-secrets-env.cjs`가 이 목록을 함께 사용합니다.
- 새 환경변수를 추가하면 `src/config/app-env.ts`와 이 목록을 같이 고쳐야 합니다.
- 둘이 어긋나면 `src/config/runtime-env-keys.spec.ts`가 실패합니다.

## 2. 배포 전 점검

- [ ] DB 백업을 완료했습니다([MariaDB 운영](../music/database/mariadb-operations.md#backup-및-restore)).
- [ ] `NODE_ENV=production`을 설정했습니다. 비어 있으면 development로 간주되어 Swagger가 노출됩니다.
- [ ] `JWT_SECRET`은 32자 이상이며 `replace-with`, `change-this`, `your-` 문구가 없습니다(예: `openssl rand -base64 48`).
- [ ] `CORS_ORIGIN`에 실제 프론트엔드 origin을 쉼표로 구분해 적었고, `*`는 쓰지 않았습니다.
- [ ] reverse proxy(nginx, ALB) 뒤라면 `TRUST_PROXY=1`(proxy hop 수)을 설정했습니다. 설정하지 않으면 요청 제한이 proxy IP 하나로 집계됩니다.
- [ ] 활성화한 SNS provider의 필수 값을 넣었습니다.
  - Kakao: `KAKAO_APP_ID`, `KAKAO_REST_API_KEY`, `KAKAO_REDIRECT_URIS`
  - Apple: `APPLE_ALLOWED_AUDIENCES`
  - Facebook: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URIS`
  - Google: `GOOGLE_ALLOWED_AUDIENCES`
- [ ] `DB_SYNCHRONIZE=false`입니다.
- [ ] DB TLS를 쓰면 `DB_SSL=true`와 `DB_SSL_CA`를 설정했습니다. 같은 호스트의 MariaDB는 현재 `have_ssl=Disabled`이므로 `DB_SSL=false`입니다.

## 3. PM2 배포 절차

```bash
cd /opt/backend-nestjs
git pull --ff-only
npm ci
npm run build

eval "$(AWS_SECRET_ID=<secret-id> AWS_REGION=ap-northeast-2 npm run -s secrets:export)"
npm run migration:show
npm run migration:run          # 실패하면 여기서 중단하고 재시작하지 않습니다

npm run pm2:reload
curl -fsS http://127.0.0.1:${PORT:-3000}/health   # DB 장애 시 503 → curl 실패
```

- `secrets:export` 출력에는 비밀값이 들어 있습니다. `eval` 없이 실행하거나 `set -x`, CI 로그에 남기지 않습니다.
- `pm2 save`는 환경변수를 `~/.pm2/dump.pm2`에 평문으로 저장합니다. 꼭 필요할 때만 쓰고 파일 권한을 확인합니다.
- PM2의 `kill_timeout`은 10초입니다. 이 시간 안에 앱이 graceful shutdown(`enableShutdownHooks`)으로 진행 중인 요청과 DB 풀을 정리합니다.

## 4. systemd 배포 절차 (대안)

1. `deploy/backend-nestjs.env.example`을 `/etc/backend-nestjs/backend-nestjs.env`로 복사하고 실제 값을 입력합니다.
2. 권한을 제한합니다.
   ```bash
   sudo chown root:root /etc/backend-nestjs/backend-nestjs.env
   sudo chmod 600 /etc/backend-nestjs/backend-nestjs.env
   ```
3. `deploy/backend-nestjs.service.example`을 `/etc/systemd/system/backend-nestjs.service`로 복사하고, 배포 경로와 서비스 계정을 맞춥니다.
4. migration은 같은 환경파일을 읽어 실행합니다.
   ```bash
   set -a
   . /etc/backend-nestjs/backend-nestjs.env
   set +a
   npm run migration:run
   ```
5. 서비스를 기동합니다.
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now backend-nestjs
   ```

`EnvironmentFile=`은 systemd 프로세스에만 환경변수를 전달하므로, 애플리케이션이 비밀번호 파일을 직접 읽지 않습니다.

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
- 최근 migration: `npm run migration:revert`(`AddRoleToUsers`는 컬럼만 삭제)
- `ArchiveLegacyMusicSchema`·`RepairLegacyMariaDbSchema`는 down이 없습니다. 문제가 생기면 배포 전 백업으로 복원합니다.

## 7. DB TLS (원격 DB 또는 RDS로 옮길 때)

1. 서버에서 `SHOW VARIABLES LIKE 'have_ssl'`, `require_secure_transport`를 확인합니다.
2. CA 번들을 호스트마다 내려받습니다. 이 파일은 Git에 커밋하지 않습니다.
   ```bash
   curl -fsSL -o config/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
   ```
3. `DB_SSL=true`, `DB_SSL_REJECT_UNAUTHORIZED=true`, `DB_SSL_CA=<절대경로>/config/global-bundle.pem`을 설정합니다. production에서 `DB_SSL=true`이면서 인증서 검증을 켰는데 CA가 없으면 기동이 실패합니다.
