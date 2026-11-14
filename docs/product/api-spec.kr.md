# API 명세 (라우트·권한)

> 최신화 기준: 2026-11-14 · dictionary MVP 작업 트리
> 기존 인증·음악 컨트롤러의 라우트 55개를 정리합니다. 이후 추가된 [사전·관리·health API](../api/API_SPEC.md)는 별도 명세를 참고하세요. 요청·응답 예시는 [API_EXAMPLES.md](../../API_EXAMPLES.md)를 참고하세요. Swagger UI `/api-docs`는 `SWAGGER_ENABLED=true`일 때만 제공되며 production에서는 활성화할 수 없습니다.

권한 표기:

- `public`: 인증 불필요
- `jwt`: `Authorization: Bearer <token>` 필요
- `admin`: JWT 필요, `role = admin`이어야 하며 아니면 403
- `public*`: SNS 라우트. `AUTH_<PROVIDER>_ENABLED=true`가 아니면 503 — **현재 5종 모두 비활성**. 라우팅은 대소문자를 구분하지 않지만(`/auth/GOOGLE/login`도 같은 라우트), 비활성 판정은 컨트롤러 메타데이터로 하므로 철자와 관계없이 503입니다

## 시스템

| Method | Path | 권한 | 요청 | 비고 |
| --- | --- | --- | --- | --- |
| GET | `/` | public | — | 환영 메시지 |
| GET | `/health` | public | — | `{status:'ok'\|'degraded', database:'up'\|'down', timestamp}`, DB down이면 503, rate limit 제외 |

## 계정

| Method | Path | 권한 | 요청 | 비고 |
| --- | --- | --- | --- | --- |
| POST | `/users/register` | public | `CreateUserDto {username(4–50), password(8자 이상·72바이트 이하), email?(255), name?(100)}` | 201 PublicUser, 409 중복, 400 예약 username·정책 위반 |
| GET | `/users/profile` | jwt | — | PublicUser(`role`, `providers` 포함) |
| PATCH | `/users/profile` | jwt | `UpdateUserDto {email?, name?, password?, currentPassword?}` | 비밀번호 변경 시 `currentPassword` 필요(400/403), email 중복 409. **비밀번호를 바꾸면 기존 토큰 전부(현재 토큰 포함) 401** |
| POST | `/auth/login` | public | `LoginDto {identifierType, identifier(255), password(1024)}` | 201 `{access_token, user}`, 401, IP당 분당 5회, 계정당 실패 10회/15분이면 429 + `Retry-After` |

## SNS 로그인

성공 응답: `{ ok: true, requestId, data }`

| Method | Path | 권한 | 요청 | 비고 |
| --- | --- | --- | --- | --- |
| POST | `/auth/google/verify-id-token` | public* | `{idToken, nonce?}` | 검증된 identity 반환 |
| POST | `/auth/google/exchange-code` | public* | `{code, redirectUri, codeVerifier?, state?, expectedState?}` | provider token set 반환 |
| POST | `/auth/google/login` | public* | `{idToken \| code, redirectUri?, nonce?, codeVerifier?, state?, expectedState?}` | `data {accessToken, expiresIn, user}` |
| POST | `/auth/apple/verify-id-token` | public* | `{idToken, nonce?}` | |
| POST | `/auth/apple/exchange-code` | public* | `{code, redirectUri, state?, expectedState?}` | |
| POST | `/auth/apple/login` | public* | `{idToken \| code, redirectUri?, nonce?, state?, expectedState?, user?{name?, email?}}` | `user.email`은 token에 email이 없을 때만 미검증으로 사용 |
| POST | `/auth/kakao/exchange-code` | public* | `{code, redirectUri, state?, expectedState?}` | |
| POST | `/auth/kakao/login` | public* | `{accessToken \| code, redirectUri?, state?, expectedState?}` | `accessToken`은 `KAKAO_APP_ID`로 발급 앱 검증, 불일치 시 401 `AUTH_KAKAO_INVALID_TOKEN` |
| POST | `/auth/naver/exchange-code` | public* | `{code, redirectUri, state, expectedState?}` | |
| POST | `/auth/naver/login` | public* | `{code, redirectUri, state, expectedState?}` (`accessToken`은 `AUTH_NAVER_ACCESS_TOKEN_LOGIN_ENABLED=true`일 때만) | accessToken 요청은 기본 400 `AUTH_NAVER_BAD_REQUEST` |
| POST | `/auth/facebook/exchange-code` | public* | `{code, redirectUri, state?, expectedState?}` | |
| POST | `/auth/facebook/login` | public* | `{accessToken \| code, redirectUri?, state?, expectedState?}` | `debug_token`으로 `app_id` 검증 |

## 음악 카탈로그 (`/music`)

| Method | Path | 권한 | 요청 | 비고 |
| --- | --- | --- | --- | --- |
| GET | `/music/tracks` | public | `?page=1&limit=100`(최대 100) | 최신순 `[{id, title, artist, bpm}]` |
| GET | `/music/tracks/:id` | public | — | 404 |
| POST | `/music/tracks` | admin | `{title, artist, bpm?}` | |
| PATCH | `/music/tracks/:id` | admin | 부분 수정 | |
| DELETE | `/music/tracks/:id` | admin | — | 플레이리스트에 포함되어 있으면 409 |
| GET | `/music/tracks/:trackId/audio-assets` | admin | — | 내부 저장소 정보 포함 |
| POST | `/music/tracks/:trackId/audio-assets` | admin | `{url?, duration?, bpm?}` | `url`은 http(s) 절대 URL, 2000자 이하 |
| PATCH | `/music/audio-assets/:id` | admin | 부분 수정 | |
| DELETE | `/music/audio-assets/:id` | admin | — | |
| GET | `/music/public/playlists` | public | `?page=1&limit=20`(최대 100) | `published`만 |
| GET | `/music/public/playlists/:id` | public | — | 항목은 `position` 순, 음원 URL 제외 |
| POST | `/music/playlists` | admin | `{title, description?, playDate?, anonymousPlayable?}` | `draft`로 생성 |
| PATCH | `/music/playlists/:id/publish` | admin | — | `published`로 변경 |
| POST | `/music/playlists/:playlistId/tracks` | admin | `{trackId, position, note?}` | position 중복 시 400 |
| PATCH | `/music/playlists/:playlistId/tracks/reorder` | admin | `{items:[{id, position}]}` | 기존 항목 전체 필수 |

## Legacy 음악 (`/music/legacy`)

> **종료 예정:** 현재 API는 데이터 이관 전까지 호환 목적으로 남아 있습니다. 신규 클라이언트와 기능은 Catalog API만 사용하며, 이관·검증 후 Legacy API를 비활성화할 예정입니다. 실제 종료 시점은 배포 계획에 따릅니다.

| Method | Path | 권한 | 요청 | 비고 |
| --- | --- | --- | --- | --- |
| GET | `/music/legacy/artists` | jwt | — | |
| GET | `/music/legacy/artists/:id` | jwt | — | |
| POST | `/music/legacy/artists` | admin | `{name, description?}` | |
| PATCH | `/music/legacy/artists/:id` | admin | 부분 수정 | |
| DELETE | `/music/legacy/artists/:id` | admin | — | 연결된 track이 있으면 409 `FOREIGN_KEY_CONSTRAINT` |
| GET | `/music/legacy/tracks` | public | `?search&artistId&artistName&title&minBpm&maxBpm&page=1&limit=20(최대 100)&sortBy&sortOrder` | 공개 필드, 페이지네이션. 검색어는 100자 이하이며 `%`, `_`는 문자 그대로 검색 |
| GET | `/music/legacy/tracks/full` | jwt | 위와 같음 | 생성·수정 시각 포함 |
| GET | `/music/legacy/tracks/:id` | public | — | |
| GET | `/music/legacy/tracks/:id/full` | jwt | — | |
| POST | `/music/legacy/tracks` | admin | `{title, artistId, bpm?, lengthSec?}` | |
| PATCH | `/music/legacy/tracks/:id` | admin | 부분 수정 | |
| DELETE | `/music/legacy/tracks/:id` | admin | — | |
| GET | `/music/legacy/playlists` | jwt | `?date=YYYY-MM-DD` 선택 | |
| GET | `/music/legacy/playlists/by-date` | jwt | `?date=YYYY-MM-DD` **필수** | 없거나 형식 오류면 400 |
| GET | `/music/legacy/playlists/:id` | jwt | — | 포함된 track 포함 |
| POST | `/music/legacy/playlists` | admin | `{name, playDate?, description?}` | |
| PATCH | `/music/legacy/playlists/:id` | admin | 부분 수정 | |
| DELETE | `/music/legacy/playlists/:id` | admin | — | |
| GET | `/music/legacy/playlists/:playlistId/tracks` | jwt | — | |
| POST | `/music/legacy/playlists/:playlistId/tracks` | admin | `{trackId, seq, note?}` | |
| PATCH | `/music/legacy/playlists/:playlistId/tracks/:playlistTrackId` | admin | `{seq?, note?}` | |
| DELETE | `/music/legacy/playlists/:playlistId/tracks/:playlistTrackId` | admin | — | |

## 공통 오류 envelope

```json
{ "ok": false, "requestId": "…", "errorCode": "CONFLICT", "message": "Email already exists" }
```

| HTTP | errorCode(기본) | 대표 상황 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | DTO 검증 실패(메시지는 쉼표로 이어 붙임), 예약 username, `currentPassword` 누락 |
| 401 | `UNAUTHORIZED` | 토큰 없음·만료·변조, 비밀번호 변경 전에 발급된 토큰, 로그인 실패 |
| 403 | `FORBIDDEN` | admin 아님, `currentPassword` 불일치 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `CONFLICT` / `FOREIGN_KEY_CONSTRAINT` | 중복, 참조 중인 리소스 삭제 |
| 429 | `RATE_LIMITED` | 요청 제한 초과, 계정 단위 로그인 실패 제한(`Retry-After`) |
| 503 | `SERVICE_UNAVAILABLE` / `AUTH_<PROVIDER>_DISABLED` / `AUTH_<PROVIDER>_CONFIG_MISSING` | 비활성 provider, 검증 설정 누락 |
| 5xx | `INTERNAL_SERVER_ERROR` | 메시지는 `Internal server error`로 고정 |

SNS 라우트는 `AUTH_<PROVIDER>_<REASON>` 코드를 씁니다([기능 명세 2장](features.kr.md#2-sns-로그인)).
