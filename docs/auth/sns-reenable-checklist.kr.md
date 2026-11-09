# SNS 로그인 재활성화 체크리스트

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`

## 현재 상태

**모든 SNS 로그인이 꺼져 있습니다. 운영은 로컬 로그인(`POST /auth/login`)만 사용합니다.**

- SNS provider는 **명시적 opt-in**입니다. `AUTH_<PROVIDER>_ENABLED=true`일 때만 켜집니다.
  - credential 키가 env에 있어도 플래그가 없으면 꺼진 상태입니다(`src/config/app-env.ts`).
- 꺼진 provider의 라우트(`/auth/<provider>/*`)는 유지되지만, 외부 호출 없이 503 `AUTH_<PROVIDER>_DISABLED`를 반환합니다(`ProviderReadinessGuard`).
  - 가드는 요청 경로가 아니라 컨트롤러의 `@SocialProviderRoute('<provider>')` 메타데이터로 판정합니다. 그래서 `/auth/GOOGLE/login`처럼 대소문자를 바꾼 경로도 막힙니다(SEC-17). **SNS 컨트롤러를 새로 만들면 이 데코레이터를 반드시 붙입니다**(빠지면 spec 실패).
- 켜진 provider도 검증에 필요한 설정이 비어 있으면 검증을 생략하지 않고 503 `AUTH_<PROVIDER>_CONFIG_MISSING`으로 거부합니다(fail-closed).
- 꺼진 provider는 관련 설정 키가 하나도 없어도 빌드와 기동에 영향이 없습니다.
- Naver는 켜더라도 클라이언트 accessToken 로그인이 기본 차단됩니다(`AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED=false`). code flow만 허용합니다.

provider를 다시 켜기 전에 아래 체크리스트를 **해당 환경에서** 모두 완료하세요. 진행 순서는 dev → test → prod입니다.

## 1. 공통 체크리스트 (모든 provider)

- [ ] **클라이언트 state 검증**: OAuth `state`는 redirect를 받는 클라이언트(앱·웹)가 생성하고 검증합니다.
  - 서버의 `state`/`expectedState` 비교는 둘 다 클라이언트 값이라 CSRF 방어가 되지 않습니다(감사 SEC-5).
- [ ] **redirect URI 허용 목록**: `<PROVIDER>_REDIRECT_URIS`에 실제 콜백만 넣습니다.
  - 목록이 비어 있으면 code flow가 503 `CONFIG_MISSING`으로 거부됩니다(SEC-16, 2026-11-09부터). code flow를 쓰면 반드시 채웁니다.
- [ ] **`exchange-code`·`verify-id-token` 공개 여부 결정**: 이 엔드포인트들은 provider access/refresh token이나 검증된 identity를 호출자에게 그대로 반환합니다(SEC-6).
  - 클라이언트가 쓰지 않는다면 제거나 제한을 먼저 검토합니다.
- [ ] **계정 정책 확인**
  - 같은 email의 로컬 계정과 자동 병합하지 않습니다.
  - 미검증이거나 다른 계정이 쓰는 email은 `users.email`에 쓰지 않습니다([SNS 개요](sns-login-overview.kr.md#계정-연결과-보안-정책)).
- [ ] **세션 한계 인지**: refresh token과 기기별 로그아웃이 없습니다. 비밀번호를 바꾸면 기존 토큰은 무효가 되지만(`sessionVersion`, AUTH-3), SNS 전용 계정은 비밀번호가 없으므로 이 방법으로 취소할 수 없습니다. JWT 만료(`JWT_EXPIRES_IN`)를 짧게 유지합니다.
- [ ] **응답 형식**: SNS는 `{ok, requestId, data:{accessToken,…}}`, 로컬은 `{access_token, user}`입니다(AUTH-5). 클라이언트가 두 형식을 모두 처리하는지 확인합니다.
- [ ] **기동 검증**
  - 운영에서 플래그를 켜면 필수 설정이 빠진 경우 기동이 실패합니다(의도된 안전장치).
  - 반드시 Local(`npm run start:dev`)이나 staging에서 먼저 확인합니다.
- [ ] **동작 검증**
  - 테스트 계정으로 최초 로그인과 재로그인을 해 봅니다.
  - `GET /users/profile`의 `providers`에 연결된 provider가 표시되는지 확인합니다.
  - 잘못된 토큰이면 401이 오는지 확인합니다.

## 2. provider별 체크리스트

### Google

- [ ] `AUTH_GOOGLE_ENABLED=true`
- [ ] `GOOGLE_ALLOWED_AUDIENCES`: 클라이언트가 쓰는 OAuth Client ID 전부(쉼표 구분). 필수입니다. 비어 있으면 기동이 실패하고, 런타임에서도 ID Token을 거부합니다.
- [ ] code flow를 쓸 때는 `GOOGLE_OAUTH_CLIENT_ID`·`CLIENT_SECRET`·`REDIRECT_URIS` 세 개를 모두 넣습니다. 일부만 넣으면 운영 기동이 실패합니다.
- [ ] 웹(GIS)이면 nonce를 사용하고, PKCE(`codeVerifier`)를 권장합니다.

### Apple

- [ ] `AUTH_APPLE_ENABLED=true`
- [ ] `APPLE_ALLOWED_AUDIENCES`: Bundle ID 또는 Service ID. **모든 환경에서 필수**입니다(aud 미검증 방지).
- [ ] code flow는 `APPLE_SERVICE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`(.p8, `\n` 이스케이프), `APPLE_REDIRECT_URIS`가 필요합니다.
- [ ] 최초 인증의 `user.email`은 서명되지 않은 값입니다. 서버는 ID Token의 email이 없을 때만 미검증으로 사용합니다.

### Kakao

- [ ] `AUTH_KAKAO_ENABLED=true`
- [ ] `KAKAO_APP_ID`(숫자 앱 ID)는 **모든 환경에서 필수**입니다(2026-11-09부터. 이전에는 운영만). 클라이언트 accessToken의 발급 앱을 `/v1/user/access_token_info`의 `app_id`로 검증하며, 값이 없으면 검증을 건너뛰지 않고 거부합니다.
- [ ] `KAKAO_REST_API_KEY`, `KAKAO_REDIRECT_URIS`(운영 필수), 선택 `KAKAO_CLIENT_SECRET`
- [ ] **staging에서 확인**: 다른 Kakao 앱에서 받은 토큰으로 로그인하면 401 `AUTH_KAKAO_INVALID_TOKEN`이 나와야 합니다.
  - 실제 `access_token_info` 응답 필드는 아직 실연동으로 확인하지 않았습니다.

### Naver

- [ ] `AUTH_NAVER_ENABLED=true`
- [ ] `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URIS`(code flow 필수)
- [ ] ⚠ **accessToken 로그인은 켜지 않습니다.** `AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED=false`(기본)를 유지합니다.
  - Naver는 토큰의 발급 앱(client_id)을 검증할 공식 API를 확인하지 못했습니다. 다른 앱에서 받은 토큰으로 로그인하는 토큰 치환을 막을 수 없습니다(SEC-3).
  - 클라이언트는 `code` + `redirectUri` + `state`로 로그인합니다.
- [ ] accessToken 로그인을 꼭 써야 한다면, 앱 바인딩 검증 방법을 먼저 확인하고 구현합니다. 그 전에는 플래그를 켜지 않습니다.

### Facebook

- [ ] `AUTH_FACEBOOK_ENABLED=true`
- [ ] `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URIS`(운영 필수), 선택 `FACEBOOK_GRAPH_API_VERSION`
- [ ] accessToken은 `debug_token`으로 `app_id`를 검증합니다. `appsecret_proof` 미적용(SEC-15)을 감수할지 결정합니다.

## 3. 켜는 절차

1. 위 체크리스트를 완료합니다.
2. dev `.env`에서 켜고 검증합니다.
3. 운영 `.env.production`에 키를 넣고 플래그를 `true`로 바꿉니다.
4. **재기동 전에 `npm run env:check:prod`로 설정을 검증합니다.** 서버나 DB에 접속하지 않고 같은 검증 규칙만 실행하며, 비밀번호·secret 값은 출력하지 않습니다. `FAIL`이 나오면 재기동하지 않습니다.
   - PM2 fork 모드의 reload는 새 프로세스가 실패해도 이전 프로세스를 유지하지 않고 재시작을 반복합니다.
5. `npm run pm2:reload`로 재기동하고 `pm2 logs`로 확인합니다.
6. 해당 provider의 로그인 스모크 테스트를 하고, 결과를 [감사 리포트 로드맵](../audit/2026-11-08-project-audit.kr.md#6-로드맵)에 기록합니다.

다시 끌 때는 플래그를 `false`로 바꾸고 `pm2:reload`합니다. 데이터(`social_accounts`)는 유지됩니다.
