# Admin API / Live API 경계

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 목표 설계 문서입니다. 기존 API는 음악 서비스를 제공하며 이 문서는 신규 사전 API를 현재 계약으로 선언하지 않습니다.

## 1. 권장 MVP 배치

처음에는 동일 NestJS 애플리케이션에 다음 route/module 경계를 둡니다.

```text
src/dictionary/
  domain/             Language, Lexeme, Sense, Concept, publication policy
  application/        use-cases, repository ports, import/publish workflows
  infrastructure/     TypeORM repositories, source parser adapters
  interface/
    live/             public search and study controllers/DTO
    admin/            authenticated editorial controllers/DTO
  dictionary.module.ts
```

현재 `src/users`와 `src/music`의 Nest module, DTO, ValidationPipe, error envelope, JWT/role guard, TypeORM migration 패턴을 재사용합니다. Controller는 도메인 모델을 직접 반환하지 않고 response DTO/presenter를 사용합니다. 초기 기능에서 admin과 live를 별도 deployable app으로 만들지 않습니다.

## 2. Live 기능

| 그룹 | 기능 | 접근 |
|---|---|---|
| Lookup | 언어 목록/언어별 검색, lexeme detail, senses/concepts/translations | 공개, 게시 publication만 |
| Characters | 문자/한자 기본 속성, 언어·지역별 reading, variants, word examples | 공개, 게시 publication만 |
| Study | 세션 생성, 문제 페이지 조회, answer 제출, progress/reviews | 사용자 JWT; 각 user ID를 토큰에서 가져옴 |
| Health | process liveness, DB/readiness | 공개 또는 내부 ingress; DB 장애는 readiness에서 503 |

## 3. Admin 기능

| 그룹 | 기능 | 필수 제어 |
|---|---|---|
| Editorial | 언어·lexeme/form/sense/concept/translation/character/readings/examples CRUD | `editor` 또는 `admin`, DTO 검증, revision 기록 |
| Review | 중복·출처·라이선스·품질 검증, 승인/반려 | `reviewer` 이상; actor/time/reason |
| Publication | publish/unpublish/rollback to previous snapshot | `publisher` 또는 `admin`; immutable ID, 확인 단계, 감사 로그 |
| Import | job 생성, staging 조회/검수/적용, 실패 재처리 | `importer` 또는 `admin`; idempotency, source license allowlist |
| Governance | 사용자·역할·audit 조회 | 최고 권한; MFA 및 제한된 네트워크 |

현재 앱의 `user/admin` 두 역할은 최소 RBAC입니다. 새 `editor/reviewer/publisher/importer` 권한을 처음부터 넣을지, 실사용자·운영 역할을 확인한 후 결정합니다. 역할 분리가 승인되기 전까지 기본안은 `user/admin`만 허용하고 Admin API 전체를 admin-only로 둡니다.

## 4. 인증·인가와 네트워크

- Admin 작업은 인증된 사용자와 server-side role 검사 둘 다 통과해야 합니다. 요청 body의 `userId`, `role`, `publishedBy`는 신뢰하지 않습니다.
- 관리자 계정은 MFA 지원 인증(또는 보호된 OIDC)을 우선 검토하고, 초기 local/JWT 인증만 쓸 경우 강력한 관리자 비밀번호, 짧은 세션, 세션 폐기, 복구 절차를 마련합니다.
- Admin API path는 `/api/v1/admin`으로 명시하고, 별도 Admin UI origin을 CORS allow-list에 추가합니다.
- Nginx/VPN/Zero Trust에서 Admin route를 제한하고, network restriction을 우회하더라도 app-level authorization이 계속 적용되어야 합니다.
- `audit_logs`에 actor, action, entity/version, before/after diff 또는 revision reference, request ID, timestamp, reason을 저장합니다. password/token/secret은 기록하지 않습니다.

## 5. 서비스 경계와 향후 분리 기준

단일 앱에서도 `live`가 draft repository를 직접 사용하지 않고 publication read port만 이용하도록 합니다. `admin`은 command/use-case를 통해 편집 상태를 바꾸며 public controller와 DTO를 공유하지 않습니다. dictionary 도메인의 Migration/Entity 이름은 기존 `music`·`users` 테이블과 충돌하지 않게 정합니다.

아래 조건이 하나라도 운영 요구가 되면 별도 Admin/Live 앱 분리를 설계합니다.

- Admin은 사내망에서만 운영해야 하며 Live는 인터넷/별도 보안 인증 경계에 있어야 함.
- Live read scaling/캐시/가용성 요구가 Admin write 요구와 달라짐.
- 별도 팀/릴리스 주기 또는 장애 도메인이 실제로 필요함.
- API 호출량·성능 측정으로 단일 앱의 리소스 공유가 병목임이 입증됨.

