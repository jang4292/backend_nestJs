# PostgreSQL RDS 참고 문서

이 문서는 과거 PostgreSQL/RDS 구성을 기록한 역사적 참고 자료입니다.
현재 애플리케이션은 MariaDB 10.11과 `mysql2` 드라이버만 지원하며,
`DB_TYPE=mariadb` 이외의 값은 부팅 시 거부됩니다.

현재 개발 및 배포 절차는 다음 문서를 기준으로 확인하세요.

- [MariaDB EC2 배포 가이드](../deployment/mariadb-systemd.kr.md)
- [프로젝트 README](../../README.md)
- [API 사용 예제](../../API_EXAMPLES.md)

현재 데이터베이스 설정의 핵심 값은 다음과 같습니다.

```env
DB_TYPE=mariadb
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=<db-user>
DB_PASSWORD=<db-password>
DB_DATABASE=<database>
DB_SYNCHRONIZE=false
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
```

공유 또는 운영 데이터베이스에서는 `DB_SYNCHRONIZE=false`를 유지하고
TypeORM migration을 별도 배포 단계에서 실행합니다. MariaDB TLS를 사용하려면
서버의 TLS 상태와 CA 인증서 준비 여부를 먼저 확인한 뒤 `DB_SSL=true`와
`DB_SSL_CA`를 함께 설정하세요.

PostgreSQL로의 전환을 다시 검토할 때는 드라이버, TypeORM 옵션, migration,
쿼리 문법, 테스트 데이터베이스를 함께 검증해야 합니다. 이 저장소의 현재
구현은 PostgreSQL 연결을 제공하지 않습니다.
