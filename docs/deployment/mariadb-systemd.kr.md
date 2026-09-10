# MariaDB EC2 배포 설정

EC2에서 MariaDB와 NestJS 프로세스가 같은 호스트에 있으면 DB 연결은 `localhost:3306`을 사용합니다. 실제 DB 계정과 비밀번호는 저장소 또는 systemd unit 파일에 넣지 않습니다.

1. `deploy/backend-nestjs.env.example`을 서버의 `/etc/backend-nestjs/backend-nestjs.env`로 복사한 뒤 실제 값을 입력합니다.
2. 시크릿 파일 권한을 제한합니다: `sudo chown root:root /etc/backend-nestjs/backend-nestjs.env` 및 `sudo chmod 600 /etc/backend-nestjs/backend-nestjs.env`.
3. `deploy/backend-nestjs.service.example`을 `/etc/systemd/system/backend-nestjs.service`로 복사하고 배포 경로와 서비스 계정을 맞춥니다.
4. `sudo systemctl daemon-reload`, `sudo systemctl enable --now backend-nestjs`를 실행합니다.

`EnvironmentFile=`이 systemd 프로세스에만 환경변수로 전달하므로, Node 애플리케이션은 비밀번호가 적힌 파일을 직접 읽을 필요가 없습니다. 배포 전 `DB_SYNCHRONIZE=false`인지 확인하고 migration을 별도 배포 단계에서 실행합니다.

현재 서버 확인값은 `have_ssl=Disabled`, `require_secure_transport=OFF`이므로 `DB_SSL=false`를 사용합니다. 네트워크 경계가 변경되거나 TLS를 활성화한 경우, 두 값을 다시 조회한 뒤 CA 인증서와 `DB_SSL=true`를 적용합니다.