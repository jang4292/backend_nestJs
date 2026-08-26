# 시크릿 관리와 GitHub Push 보안 학습 가이드

이 문서는 이 프로젝트에서 시크릿(비밀번호, JWT 시크릿, OAuth 클라이언트 시크릿 등)이 어디서 시작해 어디로 흘러가는지, 그리고 이미 코드에 들어 있는 방어 장치가 왜 그렇게 짜여 있는지 이해하기 위한 가이드입니다. 이어서 GitHub에 push하기 전 재사용 가능한 점검 절차와, 만약 시크릿이 실수로 커밋됐을 때의 대응 원칙을 다룹니다.

## 1. 큰 흐름 먼저 보기

이 프로젝트의 시크릿 흐름은 다음 순서로 읽으면 가장 이해하기 쉽습니다.

```text
.env (로컬, git 추적 안 됨)
  -> ConfigModule.forRoot
  -> validateAppEnv (src/config/app-env.ts)
  -> ConfigService
  -> AppModule / DatabaseOptions / JwtModule / GoogleAuth
```

- `.env`: 로컬 개발 환경의 실제 값을 담는 파일. [.gitignore](../../.gitignore)에서 `.env`와 `.env.*`를 제외하되 `.env.example`만 예외로 허용해, 실제 값은 절대 커밋되지 않고 "어떤 변수가 필요한지"를 보여주는 템플릿만 남깁니다.
- `ConfigModule.forRoot`: 앱 시작 시 `.env`와 배포 환경변수를 읽습니다.
- `validateAppEnv`: 값을 사용하기 전에 형식과 최소한의 안전 규칙을 강제로 검증합니다.
- `ConfigService`: 검증을 통과한 값만 앱 코드(DB 연결, JWT 발급, Google OAuth 검증)로 전달됩니다.

즉 이 프로젝트는 "시크릿은 항상 환경변수로만 들어온다 → 코드에는 절대 실제 값을 쓰지 않는다"는 원칙을 기본으로 깔고 있습니다.

## 2. 이 프로젝트에 이미 있는 방어 장치

### 2.1 프로덕션에서 placeholder 시크릿 차단

[src/config/app-env.ts](../../src/config/app-env.ts)에는 아래와 같은 검증 로직이 있습니다.

```ts
if (nodeEnv === 'production' && isPlaceholderSecret(jwtSecret)) {
  throw new Error('JWT_SECRET must be a strong production secret.');
}

function isPlaceholderSecret(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('change-this') || normalized.includes('your-');
}
```

`.env.example`이나 README에 적힌 예시 값(`your-secret-key-change-this-in-production` 같은 문자열)을 프로덕션에 그대로 배포하면, 앱이 아예 시작하지 않고 즉시 에러를 던집니다. "예시 값을 실수로 그대로 쓰는" 흔한 사고를 코드 레벨에서 원천 차단하는 장치입니다.

같은 함수에서 `DB_SYNCHRONIZE`도 검증합니다.

```ts
if (nodeEnv === 'production' && dbSynchronize) {
  throw new Error('DB_SYNCHRONIZE must be false in production.');
}
```

`DB_SYNCHRONIZE=true`는 TypeORM이 엔티티 변경사항을 운영 DB 스키마에 자동으로 반영하게 만드는 개발 편의 옵션입니다. 운영에서 켜져 있으면 의도치 않은 스키마 변경(컬럼 삭제 등)이 배포 한 번에 일어날 수 있어, 이 프로젝트는 프로덕션에서 이 값이 켜져 있으면 앱을 아예 띄우지 않습니다. 보안 이슈는 아니지만 "설정 실수가 곧 장애/데이터 손실로 이어지는" 항목이라 같은 방식으로 방어하고 있습니다.

### 2.2 CORS_ORIGIN, GOOGLE_ALLOWED_AUDIENCES 필수화

```ts
if (nodeEnv === 'production' && !corsOrigin) {
  throw new Error('CORS_ORIGIN is required when NODE_ENV=production.');
}
```

`GOOGLE_ALLOWED_AUDIENCES`도 `requiredString`으로 필수 처리됩니다. 즉 "누가 이 API를 호출할 수 있는지(CORS)", "어떤 Google 클라이언트에서 발급된 토큰만 신뢰할지(audience)"를 프로덕션에서는 명시적으로 설정하지 않으면 앱이 뜨지 않도록 강제합니다. 기본값으로 느슨하게 열어두는 대신, "설정을 빼먹으면 실패하게" 만드는 fail-closed 방식입니다.

### 2.3 `.gitignore`의 `.env` 제외 규칙

```gitignore
# dotenv environment variable files
.env
.env.*
!.env.example
```

`.env.*` 패턴으로 `.env.local`, `.env.production` 등 변형까지 전부 막고, `.env.example`만 느낌표(`!`)로 다시 허용합니다. 이 프로젝트에서 이번 검토로 아래 패턴을 추가로 더했습니다.

```gitignore
# Keys, certificates, credentials
*.pem
*.key
*.p12
*.pfx
*.keystore
*.jks
id_rsa
id_rsa.pub
*serviceAccountKey.json
*service-account*.json
*firebase-adminsdk*.json
```

현재는 이런 파일이 프로젝트에 없지만, 나중에 Firebase나 다른 서비스 계정 키를 다루게 될 때 실수로 커밋하는 걸 미리 막아두는 defense-in-depth입니다.

## 3. GitHub push 전 체크리스트 (재사용 가능한 절차)

새 기능을 추가하거나 새 저장소를 만들 때마다 아래 순서로 점검하면 됩니다.

1. **추적 파일 확인** — 민감한 이름의 파일이 실수로 추적되고 있지 않은지 확인합니다.
   ```bash
   git ls-files | grep -iE '\.env($|\.)|\.pem$|\.key$|serviceaccount|credentials'
   ```
   `.env.example`처럼 의도한 파일 외에는 아무것도 나오면 안 됩니다.

2. **`.gitignore` 적용 여부 확인** — 로컬에 있는 파일이 실제로 무시되고 있는지 확인합니다.
   ```bash
   git check-ignore -v .env
   ```

3. **커밋 히스토리 전체 스윕** — 과거에 커밋됐다가 나중에 지운 경우까지 확인합니다(단순 삭제 커밋으로는 히스토리에 남아 있기 때문).
   ```bash
   git log --all --full-history -- .env
   git log --all -p | grep -iE 'AKIA[0-9A-Z]{16}|BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|xox[baprs]-'
   ```

4. **소스/설정 파일 하드코딩 여부 확인** — `src/`, 설정 파일, `README`/`docs`에서 실제 값처럼 보이는 문자열을 검색합니다. 이 프로젝트처럼 `process.env`/`ConfigService`를 통해서만 시크릿을 읽는 패턴을 유지하면 이 단계가 항상 깨끗하게 나옵니다.

5. **자동화 도구 도입 고려** — 매번 수동으로 하는 대신 pre-commit 단계에서 자동 검사하는 도구를 붙일 수 있습니다.
   - [gitleaks](https://github.com/gitleaks/gitleaks): 커밋 전/CI에서 시크릿 패턴을 스캔.
   - [git-secrets](https://github.com/awslabs/git-secrets): AWS 자격증명 패턴 등을 커밋 훅에서 차단.

## 4. 시크릿이 이미 커밋됐다면

만약 어느 시점에 실제 시크릿이 커밋된 걸 발견했다면, 원칙은 두 가지입니다.

1. **삭제 커밋만으로는 부족합니다.** `git rm .env && git commit`을 해도 이전 커밋에는 값이 그대로 남아 있고, 저장소를 clone/fork한 사람은 여전히 히스토리에서 값을 꺼낼 수 있습니다. 히스토리 자체를 재작성해야 합니다(`git filter-repo` 또는 BFG Repo-Cleaner).
2. **히스토리 재작성보다 더 중요한 건 rotate입니다.** 이미 GitHub에 push된 적이 있다면(특히 public repo였거나 누군가 clone했을 가능성이 있다면) 그 값은 유출된 것으로 간주하고, 히스토리를 지우는 것과 별개로 해당 비밀번호/키/시크릿을 반드시 새 값으로 교체해야 합니다. 히스토리 재작성은 "앞으로의 유출을 막는 것"이지 "이미 본 사람의 기억을 지우는 것"이 아닙니다.

## 5. 일반 원칙 요약

- 시크릿은 코드가 아니라 환경변수(또는 운영에서는 AWS Secrets Manager/Parameter Store 같은 외부 저장소)로만 주입합니다. 이 방향은 [postgresql-rds-nestjs-guide.kr.md](postgresql-rds-nestjs-guide.kr.md)에서도 이미 언급하고 있습니다.
- `.env.example`에는 항상 placeholder만 남기고, 실제 값이 담긴 `.env`는 `.gitignore`로 반드시 제외합니다.
- "프로덕션에서 실수로 잘못된 설정이 들어가면 조용히 동작하는 것"보다 "즉시 앱이 죽는 것"이 낫습니다. 이 프로젝트의 `validateAppEnv`처럼 fail-closed 검증을 앱 시작 지점에 둡니다.
- 시크릿은 주기적으로, 그리고 유출 의심 시 즉시 rotate합니다. 로컬 개발용 값이라도 오래 방치하지 않는 것이 좋습니다.

## 6. 현재 코드 기준 운영 보안 체크포인트

- 모든 요청은 `x-request-id`를 헤더로 반환해야 합니다. 문제가 생겼을 때 애플리케이션 로그, ALB/Nginx 로그, 클라이언트 오류 리포트를 같은 request id로 합칠 수 있어야 합니다.
- 전역 예외 필터가 내부 에러를 `Internal server error` 형태로 반환하는지 확인합니다. stack trace, SQL 구문, 비밀값이 응답 본문에 포함되면 안 됩니다.
- `POST/PATCH/DELETE /music/**` 엔드포인트는 JWT 인증이 필요해야 합니다. 익명 요청 시 401/403이 나오는지 배포 전 점검합니다.
- `/auth/login`은 route-level throttling이 적용되어야 합니다. 같은 IP에서 짧은 시간에 반복 시도 시 429 응답이 발생하는지 확인합니다.
- 운영 점검 시 `JWT_SECRET`, `DB_PASSWORD`, `DATABASE_URL`, Google OAuth secret이 로그에 출력되지 않는지 샘플 트래픽으로 검증합니다.

## 7. 운영 체크리스트 문서

배포 전 점검, Secrets Manager 주입, 비밀번호 회전 절차는 아래 체크리스트 문서를 함께 사용하세요.

- `docs/learning/deployment-secrets-checklist.kr.md`
