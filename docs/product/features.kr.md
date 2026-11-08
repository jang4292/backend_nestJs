# 기능 명세 (기획)

> 최신화 기준: 2026-11-08 · develop `9b731ef` + `chore/project-audit-2026-11`
> 현재 구현을 기준으로 정리한 명세입니다. "정책 미확정" 표시는 제품 결정이 필요한 항목입니다.

## 1. 계정

### 1.1 회원가입 `POST /users/register`

| 항목 | 규칙 |
| --- | --- |
| username | 필수, 4자 이상, 고유. 대소문자와 관계없이 `google_`, `apple_`, `kakao_`, `naver_`, `facebook_` 접두사 사용 불가(SNS 계정용 예약) |
| password | 필수, 6자 이상. bcrypt(cost 10)로 저장 |
| email | 선택, 이메일 형식, 고유 |
| name | 선택 |
| 실패 | 형식 오류 400, username/email 중복 409 |

### 1.2 로그인 `POST /auth/login`

- 요청: `{ identifierType: 'username' | 'email', identifier, password }`
- 성공: `{ access_token, user }` (JWT HS256, 기본 만료 1시간 `JWT_EXPIRES_IN`)
- 실패
  - 401 `Invalid credentials`. 계정 없음, 비밀번호 없음(SNS 전용 계정), 불일치를 구분하지 않으며 응답 시간도 같게 맞춥니다.
  - 요청 제한 초과 시 429. 로그인은 분당 5회입니다.

### 1.3 프로필 `GET/PATCH /users/profile` (로그인 필요)

- 응답 필드: `id, username, email, name, role, providers(연결된 SNS 목록), createdAt, updatedAt`. 비밀번호 해시는 어떤 응답에도 포함하지 않습니다.
- 수정 가능 필드: `email`, `name`, `password`
- email 변경: 다른 계정이 쓰는 email이면 409
- 비밀번호 변경
  - 기존 비밀번호가 있는 계정은 `currentPassword`가 필수입니다. 없으면 400, 틀리면 403입니다.
  - 비밀번호가 없는 SNS 전용 계정은 `currentPassword` 없이 최초 설정할 수 있습니다.
  - 정책 미확정: 비밀번호 변경 후 기존 토큰을 무효화할지(현재는 만료 시까지 유효)

## 2. SNS 로그인

| provider | 로그인 입력 | 서버 검증 |
| --- | --- | --- |
| Google | `idToken` 또는 `code`(+`redirectUri`, 선택 `codeVerifier`) | ID Token 서명, `aud`(`GOOGLE_ALLOWED_AUDIENCES`), `iss`, 만료, 선택 nonce |
| Apple | `idToken` 또는 `code` | JWKS 서명, `aud`(`APPLE_ALLOWED_AUDIENCES` 필수), `iss`, 만료, 선택 nonce |
| Kakao | `accessToken` 또는 `code` | `accessToken`이면 발급 앱(`app_id` = `KAKAO_APP_ID`) 확인 후 프로필 조회 |
| Naver | `accessToken` 또는 `code` | 프로필 조회. ⚠ 발급 앱 검증 없음([로드맵 P0](../audit/2026-11-08-project-audit.kr.md#p0-main-배포-전-결정-또는-확인)) |
| Facebook | `accessToken` 또는 `code` | `debug_token`으로 `app_id` 확인 후 프로필 조회 |

공통 규칙:

- **계정 연결:** `(provider, providerUserId)`로 기존 연결을 찾습니다. 없으면 username `<provider>_<sub>` 계정을 새로 만듭니다.
- **email 정책:** provider email은 `social_accounts`에 저장합니다. `users.email`에는 비어 있을 때만 채우며, 다음 경우에는 쓰지 않습니다.
  - provider가 미검증이라고 알린 email
  - 다른 계정이 이미 쓰는 email
- **자동 병합 없음:** 로컬 계정과 같은 email이어도 자동으로 병합하지 않습니다(계정 탈취 방지).
- **name:** 사용자가 설정한 `users.name`을 SNS 로그인 때마다 덮어쓰지 않습니다.
- **Apple email:** ID Token claim을 우선합니다. 최초 인증 시 클라이언트가 보낸 email은 token에 email이 없을 때만 미검증으로 사용합니다.
- **기능 플래그:** `AUTH_<PROVIDER>_ENABLED=false`이면 해당 provider의 모든 라우트가 외부 호출 없이 503 `AUTH_<PROVIDER>_DISABLED`를 반환합니다.
- **오류 코드:** `AUTH_<PROVIDER>_<REASON>`
  - `BAD_REQUEST`: 400
  - `STATE_MISMATCH`, `EXCHANGE_FAILED`, `PROFILE_FETCH_FAILED`, `INVALID_*`, `TOKEN_EXPIRED`, `MISSING_SUB`, `NONCE_MISMATCH`: 401
  - `CONFIG_MISSING`: 503
  - `INTERNAL_ERROR`: 500. 메시지는 `Internal server error`로 가립니다.
- **state:** OAuth `state`는 redirect를 받는 클라이언트가 검증해야 합니다. 서버의 `state`/`expectedState` 비교는 보조 장치일 뿐입니다.

## 3. 음악 카탈로그

### 3.1 Track / AudioAsset

- **Track:** `title`(1–200자), `artist`(1–200자), `bpm`(0–400, 선택)
- **AudioAsset**
  - Track 하나에 여러 개를 둘 수 있습니다(1:N).
  - 필드: `url`(선택), `duration`(초), `bpm`(분석값)
  - `Track.bpm`과 자동 동기화하지 않습니다.
- **조회**
  - Track 목록·상세는 공개입니다. 목록은 최신순이며 `page`, `limit`(최대 100)를 받습니다.
  - AudioAsset 목록은 내부 저장소 정보를 담고 있어 admin만 조회합니다.
- **삭제:** 플레이리스트에 포함된 Track은 삭제할 수 없습니다(409). AudioAsset은 Track과 함께 삭제됩니다.

### 3.2 Playlist

- **상태:** `draft`로 생성하고, `published`가 되면 공개 API에 노출됩니다. `archived`는 공개하지 않습니다.
  - 정책 미확정: 공개 상태 전이 규칙. 현재는 archived도 다시 published로 바꿀 수 있습니다.
- **항목:** `(playlistId, position)`이 고유합니다. 재정렬 요청에는 기존 항목을 모두 한 번씩 포함해야 합니다.
  - 정책 미확정: 같은 Track을 중복 허용할지, 날짜당 플레이리스트를 하나로 제한할지([결정 문서](../music/decisions.md))
- **공개 응답:** 제목, 설명, Track 요약, 순서만 반환합니다. 음원 URL, S3 키, 재생 토큰은 포함하지 않습니다.

### 3.3 Legacy (`/music/legacy`)

- Artist/Track/Playlist/PlaylistTrack CRUD를 보존합니다.
- **권한**
  - 조회는 로그인 사용자 전체입니다. Track 목록·상세는 공개입니다.
  - 쓰기는 admin만 할 수 있습니다.
- **오류:** 연결된 Track이 있는 Artist를 삭제하면 409입니다. `by-date`는 `date=YYYY-MM-DD`가 필수입니다.
- 정책 미확정: legacy 폐기 일정과 데이터 이전

## 4. 공통 정책

| 항목 | 정책 |
| --- | --- |
| 오류 응답 | `{ ok: false, requestId, errorCode, message }`. 5xx 메시지는 일반화하고 비밀값은 마스킹합니다 |
| 요청 ID | `x-request-id`를 받거나 생성하고, 응답 헤더로 돌려줍니다(CORS 노출) |
| 입력 검증 | 전역 `ValidationPipe(whitelist, forbidNonWhitelisted, transform)` |
| 요청 제한 | 전역 `THROTTLE_LIMIT`/`THROTTLE_TTL`(기본 10회/60초), 로그인 5회/분, `/health` 제외. proxy 뒤에서는 `TRUST_PROXY` 필수 |
| CORS | `CORS_ORIGIN` 쉼표 목록, `*` 금지 |
| 문서 | Swagger `/api-docs`. production에서는 비노출 |
