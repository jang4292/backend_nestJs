# 용어집

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 학습 자료에 나오는 용어를 이 프로젝트 기준으로 짧게 설명합니다. 자세한 내용은 각 항목의 링크를 따라갑니다.

## 인증·인가

| 용어 | 뜻 | 이 프로젝트에서 |
| --- | --- | --- |
| 인증(Authentication) | 누구인지 확인 | 로컬 로그인, SNS 로그인, JWT 검증 |
| 인가(Authorization) | 무엇을 할 수 있는지 확인 | `@AdminOnly()`, `RolesGuard` |
| RBAC | 역할 기반 접근 제어 | `users.role`(user/admin). [아키텍처 가이드 8장](nestjs-operational-stability-guide.kr.md#8-인증과-인가) |
| JWT | 서명된 JSON 토큰. 서버가 세션을 저장하지 않음 | HS256 고정, 기본 만료 1시간 |
| claim | JWT 안의 필드 | `sub`(사용자 id), `username`, `sv`(세션 버전), `exp` |
| `sessionVersion` / `sv` | 토큰 무효화용 버전. DB 값과 토큰 값이 다르면 거부 | 비밀번호 변경 시 1 증가. [API 보안 가이드 5장](api-security-guide.kr.md#5-세션-jwt와-취소) |
| refresh token | access token을 다시 발급받는 긴 수명 토큰 | 아직 없음(P1). [DB 개선 가이드](database-improvement-guide.kr.md#refresh-token-테이블-설계) |
| bcrypt | 느린 비밀번호 해시 함수 | cost 10. 입력의 앞 72바이트만 사용 |
| 타이밍 공격 | 응답 시간 차이로 정보를 알아내는 공격 | 계정이 없어도 bcrypt 비교를 1회 수행(SEC-9) |
| 무차별 대입(brute force) | 비밀번호를 계속 바꿔 시도 | IP 단위 + 계정 단위 제한(SEC-19) |
| credential stuffing | 다른 사이트에서 유출된 계정·비밀번호 목록으로 시도 | 계정 단위 제한만으로는 부족. 유출 목록 대조, CAPTCHA가 필요 |
| 계정 열거(enumeration) | 응답 차이로 계정 존재를 알아냄 | 로그인은 같은 메시지와 시간. 가입은 중복을 알려 줌(SEC-25) |

## OAuth·OIDC (SNS 로그인)

| 용어 | 뜻 | 이 프로젝트에서 |
| --- | --- | --- |
| IdP | 신원 제공자 | Google, Apple, Kakao, Naver, Facebook |
| OAuth 2.0 | 권한 위임 프로토콜 | code flow, access token |
| OIDC | OAuth 위에 신원(ID Token)을 더한 표준 | Google, Apple |
| ID Token | 사용자 신원이 담긴 JWT | `aud`, `iss`, `exp`, `nonce` 검증 |
| `aud` (audience) | 토큰을 받을 대상 앱 | `GOOGLE_ALLOWED_AUDIENCES`, `APPLE_ALLOWED_AUDIENCES` |
| `iss` (issuer) | 토큰 발급자 | `accounts.google.com`, `appleid.apple.com` |
| `nonce` | 로그인 시도마다 만드는 일회용 값. 재전송 방지 | 선택 입력 |
| `state` | redirect 왕복을 묶는 값. CSRF 방지 | 클라이언트가 검증해야 함(SEC-5) |
| PKCE | code 가로채기를 막는 확장(`code_verifier`) | Google `codeVerifier` |
| 토큰 치환(token substitution) | 다른 앱이 받은 사용자 토큰으로 이 서비스에 로그인 | Kakao `app_id`, Facebook `debug_token` 검증. Naver accessToken 로그인 기본 차단 |
| redirect URI 허용 목록 | code를 교환할 수 있는 콜백 주소 목록 | 비어 있으면 code flow 거부(SEC-16) |

## 보안 설계 원칙

| 용어 | 뜻 | 예 |
| --- | --- | --- |
| fail-closed | 설정이나 판단이 불확실하면 **거부** | audience가 비면 503 `CONFIG_MISSING`(SEC-17) |
| fail-open | 불확실하면 **통과**(위험) | 수정 전 "audience가 없으면 검사 생략" |
| 심층 방어(defense in depth) | 방어를 여러 겹으로 | 가드 + 검증기 + 테스트 |
| 최소 권한 | 필요한 권한만 부여 | 앱 DB 단위 GRANT, runtime 계정 분리(DB-18) |
| 위협 모델 | 자산, 공격자, 진입점을 정리한 것 | [API 보안 가이드 2장](api-security-guide.kr.md#2-위협-모델) |
| 라우트 메타데이터 | 데코레이터로 핸들러에 붙인 정보 | `@SocialProviderRoute`, `@Roles` |
| 대량 할당(mass assignment) | 요청에 끼워 넣은 필드가 그대로 저장됨 | `whitelist`, `forbidNonWhitelisted`로 차단 |
| redaction | 로그·응답에서 비밀값을 가림 | `redactSensitiveText` |
| OWASP API Top 10 | API 보안 위험 상위 10개 목록 | [보안 감사 1장](../audit/2026-11-09-security-audit.kr.md#owasp-api-security-top-10-2023-대응) |

## 운영·네트워크

| 용어 | 뜻 | 이 프로젝트에서 |
| --- | --- | --- |
| trust proxy | proxy가 보낸 `X-Forwarded-For`를 믿을지 | `TRUST_PROXY=loopback` |
| rate limit / throttling | 요청 횟수 제한 | `ThrottlerGuard`, 로그인 5회/분 |
| `Retry-After` | 다시 시도할 수 있는 시간(초) 헤더 | 계정 단위 제한 429에 포함 |
| request id | 요청 하나를 추적하는 id | `x-request-id`. 형식이 안전할 때만 받음(SEC-14) |
| graceful shutdown | 진행 중인 요청을 마치고 종료 | `enableShutdownHooks`, PM2 `kill_timeout` |
| CORS | 브라우저의 다른 origin 요청 허용 규칙 | origin 목록, `*` 금지 |
| 공급망(supply chain) | 의존성, CI Action 등 외부 코드 | Dependabot, `npm audit` |

## DB·스키마

| 용어 | 뜻 | 이 프로젝트에서 |
| --- | --- | --- |
| migration | 스키마 변경을 담은 순서 있는 코드 | `src/database/migrations/`, 10개 |
| pending | 아직 적용하지 않은 migration | `db:check`가 표시 |
| drift | entity가 기대하는 스키마와 실제 DB의 차이 | DB-12, dry-run 49문 |
| dry-run | 실제로 바꾸지 않고 바꿀 내용만 보기 | `migration:check:test` |
| `synchronize` | entity에 맞춰 DB를 자동 변경하는 TypeORM 기능 | 모든 환경에서 금지 |
| expand → contract | 추가 → 배포 → 제거로 나누는 하위 호환 변경 | [DB 가이드 6장](database-schema-management.kr.md#6-하위-호환-변경-expand--contract) |
| DDL / DML | 구조 변경(CREATE, ALTER, DROP) / 데이터 변경(INSERT, UPDATE, DELETE) | runtime 계정은 DML만(DB-18) |
| 소유 판정(ownership) | 대상 DB에 앱이 관리하지 않는 객체가 있는지 확인 | `APP_TABLES`, `inspectOwnership` |
| collation | 문자열 비교·정렬 규칙 | `utf8mb4_unicode_ci`(대소문자 구분 안 함) |
| LIKE 와일드카드 | `%`(여러 글자), `_`(한 글자) | `escapeLike`로 이스케이프 |

## 환경

| 용어 | 뜻 |
| --- | --- |
| Local | 개발 PC + 개발 서버의 `app_db_dev`(`.env`) |
| Test | Local 안의 e2e(`.env.test.local`, `app_db_test`) |
| Prod | EC2 + PM2 + localhost MariaDB(`.env.production`) |

자세한 내용: [환경별 DB·설정 가이드](../deployment/database-environments.kr.md)
