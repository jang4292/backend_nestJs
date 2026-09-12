# 로그인 API 서버 로직 재점검 및 구조 재정리 보고서

작성일: 2026-09-12  
점검 범위: 로컬 로그인, Google, Apple, Kakao, Naver, Facebook SNS 로그인과 공용 세션 발급/계정 연결 구조

## 1. 요약

현재 로그인 기능은 provider별 모듈과 공용 `SessionModule`/`UsersModule`을 분리한 구조이며, Google/Apple은 토큰 검증과 인가코드 교환을 분리하고 Kakao/Naver/Facebook은 access token 또는 인가코드 흐름을 지원합니다. provider별 adapter는 누락된 자격증명을 대체로 요청 처리 시점에 검사하고 `*_CONFIG_MISSING` 오류를 반환하도록 구현되어 있습니다.

다만 현재 상태는 “키가 없으면 해당 provider가 비활성화되어 동작하지 않는다”는 정책을 명시적으로 모델링한 상태라기보다, 모든 provider의 controller가 항상 등록된 뒤 일부 외부 호출 단계에서 실패하는 구조입니다. 따라서 다음 단계에서 provider readiness를 중앙에서 계산하고, 각 endpoint가 같은 정책으로 `503 Service Unavailable`을 반환하도록 정리하는 것이 권장됩니다.

이번 점검에서는 키를 추가하거나 실제 OAuth 연동을 수행하지 않았습니다.

## 2. 실제 요청 흐름

### 로컬 로그인

`POST /auth/login`

1. `AuthLocalController`가 DTO를 받습니다.
2. `LocalLoginUseCase`가 username 또는 email로 사용자를 조회합니다.
3. `UsersService.validatePassword()`로 비밀번호를 검증합니다.
4. `SessionIssuerPort`를 통해 JWT access token을 발급합니다.
5. 응답은 `PublicUser` 변환기를 거치며 password를 제외합니다.

로컬 로그인은 SNS provider 설정과 독립적입니다. JWT 발급에 필요한 `JWT_SECRET`은 `validateAppEnv()`와 `SessionModule`에서 필수로 검사됩니다.

### SNS 로그인 공통 흐름

`POST /auth/{provider}/login`

1. Controller가 DTO를 검증합니다.
2. Use case가 입력 토큰과 인가코드 중 정확히 하나만 허용합니다.
3. 인가코드 흐름이면 `redirectUri`를 확인하고 provider adapter에서 token exchange를 수행합니다.
4. provider adapter가 provider API 또는 JWKS/공개키를 통해 신원을 검증합니다.
5. `SocialAccountLinkerPort.upsert()`가 `(provider, providerUserId)` 기준으로 계정을 생성하거나 갱신합니다.
6. 공용 `SessionIssuerPort`가 애플리케이션 JWT를 발급합니다.

공용 구조는 다음과 같습니다.

```text
HTTP Controller / DTO / ExceptionFilter
        |
        v
Provider Login Use Case
        |
        +--> Provider OAuth or Token Verifier Port
        +--> SocialAccountLinkerPort
        +--> SessionIssuerPort
        |
        v
Provider Adapter --> External Provider API
Users / SocialAccount tables
SessionModule --> JWT
```

## 3. Provider별 점검 결과

| Provider | 주요 입력 | 현재 설정 검사 | 현재 판단 |
|---|---|---|---|
| Google | `idToken` 또는 `code` | `GOOGLE_ALLOWED_AUDIENCES`는 앱 기동 시 필수. OAuth client ID/secret은 adapter 생성 시 보관하고 code exchange 시 외부 라이브러리로 전달 | id token 검증은 audience 설정만으로 가능할 수 있고, code flow는 client 설정 누락 시 외부 호출 단계에서 실패할 가능성이 있음. Google의 readiness가 flow별로 분리되어 있지 않음 |
| Apple | `idToken` 또는 `code` | id token 검증은 audience 설정/JWKS를 사용. code flow는 `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_SERVICE_ID`, `APPLE_PRIVATE_KEY`를 exchange 시 필수 검사 | 누락 시 `AUTH_APPLE_CONFIG_MISSING`으로 실패. controller와 adapter는 항상 등록됨 |
| Kakao | `accessToken` 또는 `code` | code flow에서 `KAKAO_REST_API_KEY` 필수, `KAKAO_CLIENT_SECRET` 선택 | access token profile 조회는 서버의 REST API key 없이도 adapter 코드상 호출 가능. 따라서 “키가 없으면 모든 Kakao 로그인 차단” 정책과는 불일치 가능 |
| Naver | `accessToken` 또는 `code` | code flow에서 `NAVER_CLIENT_ID`와 `NAVER_CLIENT_SECRET` 필수 | access token profile 조회는 client ID/secret 없이 호출 가능. provider 전체 비활성화 정책과는 불일치 가능 |
| Facebook | `accessToken` 또는 `code` | access token 검증과 code exchange 모두 `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` 필수 | 현재 access token 흐름도 앱 자격증명이 없으면 `AUTH_FACEBOOK_CONFIG_MISSING`으로 차단됨 |
| Local | identifier/password | `JWT_SECRET`, DB 설정 필수 | provider OAuth 설정과 무관하게 동작하는 공용 로그인 경로 |

### 공통으로 확인된 동작

- `idToken/accessToken`과 `code`를 동시에 보내거나 둘 다 생략하면 provider별 `BAD_REQUEST`가 발생합니다.
- code flow에는 `redirectUri`가 필요합니다.
- 설정된 allowlist가 있을 때만 `redirectUri`를 비교합니다. allowlist가 비어 있으면 모든 redirect URI를 허용하는 현재 구현이므로 운영에서는 allowlist를 필수화하는 편이 안전합니다.
- Google/Apple/Naver/Kakao/Facebook 모듈은 `AppModule`에서 항상 import되므로, 설정이 없어도 route 자체는 등록됩니다.
- 세션 발급은 provider별 구현이 아니라 `SessionModule`의 `SessionIssuerJwtAdapter` 하나로 통합되어 있습니다.
- 계정 연결은 `users.social_accounts`의 provider/providerUserId unique 조합을 사용하므로 한 사용자가 여러 SNS 계정을 가질 수 있는 방향입니다.

## 4. 설정 및 비활성화 정책 점검

### 현재 구조의 장점

- 실제 secret 값은 코드에 하드코딩되지 않고 `ConfigService`를 통해 주입됩니다.
- provider별 domain error와 exception filter가 있습니다.
- 설정 누락을 `*_CONFIG_MISSING`으로 구분할 수 있는 오류 코드가 이미 존재합니다.
- provider별 use case가 공용 계정 연결과 세션 발급 port에 의존하므로 외부 SDK와 애플리케이션 로직의 결합도가 낮습니다.

### 현재 구조의 한계

1. **provider 활성화 상태가 명시적이지 않음**
   
   `AppModule`은 모든 SNS 모듈을 무조건 등록합니다. “설정이 없으면 route를 숨길지”, “route는 노출하되 503을 반환할지”가 코드 수준의 단일 정책으로 결정되어 있지 않습니다.

2. **flow별 필수 설정과 provider 전체 활성화 조건이 섞여 있음**
   
   예를 들어 Kakao와 Naver는 서버 access token을 검증하는 profile API 흐름과 code exchange 흐름에서 필요한 설정이 다릅니다. 현재는 code exchange에서만 client 설정을 검사하므로, provider 전체를 키 기준으로 차단하려는 요구와 불일치할 수 있습니다.

3. **Google 설정의 전역 필수화가 provider 선택 정책과 다름**
   
   `GOOGLE_ALLOWED_AUDIENCES`는 provider가 실제 사용되지 않아도 앱 기동을 막습니다. Google만 사용하지 않는 배포 환경까지 고려한다면 Google 관련 설정도 provider readiness 정책 안으로 이동해야 합니다. 반대로 모든 배포가 Google을 반드시 제공해야 한다면 이 제약을 문서와 테스트에 명시해야 합니다.

4. **redirect URI allowlist가 비어 있으면 검사가 생략됨**
   
   모든 provider adapter에서 allowlist가 비어 있을 때 redirect URI 검사를 하지 않습니다. 운영 code flow에서는 해당 provider가 활성화된 경우 redirect URI 목록을 필수로 요구하는 편이 좋습니다.

5. **설정 누락 오류의 HTTP 계약 확인 필요**
   
   provider별 exception filter에는 `CONFIG_MISSING` 매핑이 존재하지만, 실제 외부 소비자가 기대하는 응답 envelope와 503 계약은 통합 테스트로 고정할 필요가 있습니다. 전역 예외 필터가 provider filter와 충돌하지 않는지도 함께 확인해야 합니다.

## 5. 권장 목표 구조

### 5.1 중앙 readiness 모델 도입

`src/auth/config` 또는 `src/config`에 provider별 설정 상태를 계산하는 순수한 모델을 둡니다.

```text
ProviderConfig/readiness
  google: { enabled, idTokenEnabled, codeFlowEnabled, missingKeys[] }
  apple:  { enabled, idTokenEnabled, codeFlowEnabled, missingKeys[] }
  kakao:  { enabled, accessTokenEnabled, codeFlowEnabled, missingKeys[] }
  naver:  { enabled, accessTokenEnabled, codeFlowEnabled, missingKeys[] }
  facebook: { enabled, accessTokenEnabled, codeFlowEnabled, missingKeys[] }
```

권장 원칙은 다음과 같습니다.

- `enabled`는 provider의 최소 검증에 필요한 설정이 모두 있을 때만 true입니다.
- flow별로 필요한 secret이 다르면 `codeFlowEnabled`와 `tokenFlowEnabled`를 별도로 계산합니다.
- 설정값과 secret 원문은 readiness 응답이나 로그에 포함하지 않고, 누락된 변수명만 내부 진단 정보로 보관합니다.
- public health endpoint에는 secret 값 대신 `enabled/disabled` 또는 최소화된 상태만 노출합니다.

### 5.2 endpoint 정책 결정

두 가지 정책 중 하나를 명시적으로 선택해야 합니다.

| 정책 | 장점 | 주의점 |
|---|---|---|
| Disabled route 미등록 | 문서와 실제 노출 API가 일치하고 불필요한 endpoint가 숨겨짐 | NestJS 동적 module 구성과 Swagger 문서 생성이 복잡해질 수 있음 |
| Route 등록 + 요청 시 503 | 구현이 단순하고 API 계약을 안정적으로 유지 | 비활성 provider endpoint가 외부에 보이고, 모든 controller가 readiness guard를 거쳐야 함 |

현재 코드와의 변경 폭을 고려하면 `route 등록 + 명확한 503` 방식이 단기적으로 적합합니다. 장기적으로 공개 API surface를 줄여야 하면 동적 module 등록으로 전환할 수 있습니다.

### 5.3 Guard 또는 공통 base policy

각 provider controller의 login/exchange/verify 진입점에서 같은 readiness 검사를 수행해야 합니다. 이 검사는 외부 API 호출 전에 실행되어야 하며, 다음 조건을 보장해야 합니다.

- 설정 누락이면 외부 provider에 요청하지 않음
- `AUTH_{PROVIDER}_CONFIG_MISSING`과 HTTP 503을 일관되게 반환
- access token flow와 code flow의 요구 설정을 혼동하지 않음
- readiness 검사 실패 시 token, code, client secret을 로그에 남기지 않음

## 6. 보안 및 품질 리스크

### 우선순위 높음

- 운영 provider의 redirect URI allowlist를 비워 둬도 code flow가 진행될 수 있음
- provider별 설정 누락을 앱 시작 시점에 감지하지 않아 배포 후 첫 로그인에서 장애가 발견될 수 있음
- provider별 exception filter, 전역 exception filter, 응답 envelope의 실제 통합 동작을 고정한 e2e 테스트가 필요함
- social account 생성과 user 생성이 하나의 transaction으로 묶여 있는지 확인이 필요함. 현재 adapter는 user 저장 후 social account 저장을 수행하므로 두 번째 저장 실패 시 orphan user가 남을 가능성이 있음

### 우선순위 중간

- state 검증은 `state`와 `expectedState`가 둘 다 전달된 경우에만 비교하는 provider가 있습니다. 서버가 OAuth state를 발급하고 저장하는 책임까지 갖는지, 아니면 신뢰 가능한 외부 클라이언트가 state를 관리하는지 계약을 정해야 합니다.
- Google의 issuer 검사는 payload에 issuer가 있을 때만 수행됩니다. 검증 라이브러리의 claim 검증 범위와 애플리케이션의 추가 검증 범위를 명확히 해야 합니다.
- 이메일은 provider마다 제공 여부와 검증 의미가 다릅니다. 이메일을 계정 식별자로 자동 병합하지 말고, 현재처럼 provider/providerUserId를 기본 식별자로 유지하는 정책을 명시하는 편이 안전합니다.
- refresh token 및 서버 측 로그아웃/토큰 무효화는 아직 후속 과제로 남아 있습니다.

## 7. 현재 테스트 상태와 추가 테스트 제안

현재 provider use case 테스트는 다음을 확인합니다.

- 정상 id token/access token 흐름
- 정상 authorization code 흐름
- token/code 상호 배타성
- 일부 redirect URI 누락 및 state mismatch
- local 로그인 성공/실패와 password 미노출

추가해야 할 테스트는 다음과 같습니다.

1. provider 설정이 없을 때 각 login/exchange/verify endpoint가 정확히 503과 `*_CONFIG_MISSING`을 반환하는지
2. 설정 누락 상태에서 외부 `fetch` 또는 Google SDK가 호출되지 않는지
3. provider별 최소 설정 조합과 flow별 설정 조합이 readiness 계산과 일치하는지
4. redirect URI allowlist가 비어 있거나 일치하지 않을 때 운영 정책대로 차단되는지
5. social user와 social account 저장 중 하나가 실패하면 transaction rollback이 되는지
6. 실제 `AppModule` bootstrap에서 설정 없는 provider들이 의도한 route/응답 정책을 갖는지
7. 모든 provider의 오류 응답이 동일한 request ID와 envelope 형식을 갖는지

## 8. 다른 AI/설계 검토자에게 공유할 결정 사항

다음 질문에 대한 합의를 먼저 받으면 구현 범위를 안정적으로 정할 수 있습니다.

- 키가 없는 provider의 endpoint는 `404/route 미등록`인가, `503/일시적 비활성`인가?
- access token 흐름도 서버의 provider app key/secret을 반드시 요구할 것인가?
- Google `GOOGLE_ALLOWED_AUDIENCES`는 모든 환경에서 필수인가, Google 활성화 시에만 필수인가?
- 운영에서 redirect URI allowlist가 비어 있으면 앱 기동 실패인가, 해당 code flow만 비활성화인가?
- OAuth state/PKCE를 서버가 생성·저장·소비할 것인가, 클라이언트가 생성한 값을 서버가 검증할 것인가?
- SNS provider 계정과 기존 local 계정의 이메일이 같을 때 자동 연결을 허용할 것인가?
- 계정 upsert와 social account 연결을 DB transaction으로 보장할 것인가?
- provider 상태를 health/readiness API와 Swagger에 어느 수준까지 노출할 것인가?

## 9. 결론

현재 코드는 provider별 로그인 흐름과 공용 세션/계정 연결의 기본 분리는 잘 되어 있으며, 자격증명 누락 오류 코드도 이미 준비되어 있습니다. 그러나 “키가 없으면 동작하지 않음”을 시스템 정책으로 보장하려면 provider readiness와 flow readiness를 명시적으로 계산하고, 외부 호출 전 공통 검사와 503 응답 계약을 추가해야 합니다.

이번 보고서의 권장 구현 순서는 다음과 같습니다.

1. provider별 최소 설정과 flow별 필수 설정을 표로 확정합니다.
2. readiness/config service와 단위 테스트를 추가합니다.
3. controller 진입점에서 외부 호출 전 readiness를 검사합니다.
4. redirect URI allowlist를 운영 code flow의 필수 조건으로 정합니다.
5. 설정 누락, 응답 envelope, 외부 호출 미수행을 e2e 테스트로 고정합니다.
6. social user/social account upsert의 transaction 경계를 보강합니다.

이 순서라면 실제 Google/Naver/Kakao 키를 발급하거나 연결하기 전에 API 구조와 실패 동작을 먼저 검증할 수 있습니다.