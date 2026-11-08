# API 명세 (라우트·권한)

> 최신화 기준: 2026-11-08 · develop `9b731ef` + `chore/project-audit-2026-11`
> 빌드된 컨트롤러 메타데이터에서 추출한 전체 라우트 55개입니다. 요청·응답 예시는 [API_EXAMPLES.md](../../API_EXAMPLES.md)를, 실행 중인 서버에서는 Swagger `/api-docs`(production 제외)를 참고하세요.

권한 표기:

- `public`: 인증 불필요
- `jwt`: `Authorization: Bearer <token>` 필요
- `admin`: JWT 필요, `role = admin`이어야 하며 아니면 403
- `public*`: SNS 라우트. `AUTH_<PROVIDER>_ENABLED=true`가 아니면 503 — **현재 5종 모두 비활성**

## 시스템

| Method | Path | 권한 | 요청 | 비고 |
| --- | --- | --- | --- | --- |
| GET | `/` | public | — | 환영 메시지 |
| GET | `/health` | public | — | `{status:'ok'\|'degraded', database:'up'\|'down', timestamp}`, DB down이면 503, rate limit 제외 |

## 계정

| Method | Path | 권한 | 요청 | 비고 |
| --- | --- | --- | --- | --- |
| POST | `/users/register` | public | `CreateUserDto {username, password, email?, name?}` | 201 PublicUser, 409 중복, 400 예약 username |
| GET | `/users/profile` | jwt | — | PublicUser(`role`, `providers` 포함) |
| PATCH | `/users/profile` | jwt | `UpdateUserDto {email?, name?, password?, currentPassword?}` | 비밀번호 변경 시 `currentPassword` 필요(400/403), email 중복 409 |
| POST | `/auth/login` | public | `LoginDto {identifierType, identifier, password}` | 201 `{access_token, user}`, 401, 분당 5회 |

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
| POST | `/music/tracks/:trackId/audio-assets` | admin | `{url?, duration?, bpm?}` | |
| PATCH | `/music/audio-assets/:id` | admin | 부분 수정 | |
| DELETE | `/music/audio-assets/:id` | admin | — | |
| GET | `/music/public/playlists` | public | `?page=1&limit=20`(최대 100) | `published`만 |
| GET | `/music/public/playlists/:id` | public | — | 항목은 `position` 순, 음원 URL 제외 |
| POST | `/music/playlists` | admin | `{title, description?, playDate?, anonymousPlayable?}` | `draft`로 생성 |
| PATCH | `/music/playlists/:id/publish` | admin | — | `published`로 변경 |
| POST | `/music/playlists/:playlistId/tracks` | admin | `{trackId, position, note?}` | position 중복 시 400 |
| PATCH | `/music/playlists/:playlistId/tracks/reorder` | admin | `{items:[{id, position}]}` | 기존 항목 전체 필수 |

## Legacy 음악 (`/music/legacy`)

| Method | Path | 권한 | 요청 | 비고 |
| --- | --- | --- | --- | --- |
| GET | `/music/legacy/artists` | jwt | — | |
| GET | `/music/legacy/artists/:id` | jwt | — | |
| POST | `/music/legacy/artists` | admin | `{name, description?}` | |
| PATCH | `/music/legacy/artists/:id` | admin | 부분 수정 | |
| DELETE | `/music/legacy/artists/:id` | admin | — | 연결된 track이 있으면 409 `FOREIGN_KEY_CONSTRAINT` |
| GET | `/music/legacy/tracks` | public | `?search&artistId&artistName&title&minBpm&maxBpm&page=1&limit=20(최대 100)&sortBy&sortOrder` | 공개 필드, 페이지네이션 |
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
| 401 | `UNAUTHORIZED` | 토큰 없음·만료·변조, 로그인 실패 |
| 403 | `FORBIDDEN` | admin 아님, `currentPassword` 불일치 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 409 | `CONFLICT` / `FOREIGN_KEY_CONSTRAINT` | 중복, 참조 중인 리소스 삭제 |
| 429 | `RATE_LIMITED` | 요청 제한 초과 |
| 503 | `SERVICE_UNAVAILABLE` / `AUTH_<PROVIDER>_DISABLED` | 비활성 provider |
| 5xx | `INTERNAL_SERVER_ERROR` | 메시지는 `Internal server error`로 고정 |

SNS 라우트는 `AUTH_<PROVIDER>_<REASON>` 코드를 씁니다([기능 명세 2장](features.kr.md#2-sns-로그인)).
