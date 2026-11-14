# Admin API / Live API 경계

> 최신화 기준: 2026-11-14 · dictionary MVP 작업 트리
> 사전 MVP는 기존 음악·인증 API와 같은 앱에 구현되었습니다. 확장 기능과 운영 경계는 아래에서 별도로 표시합니다.

## 1. 구현된 MVP 배치

동일 NestJS 애플리케이션에 다음 route/module 경계를 둡니다.

```text
src/dictionary/
  entities/           TypeORM 사전 스키마
  application/        편집·검수·게시 및 공개 조회 서비스
  interface/          admin/live/health controllers와 별도 DTO
  dictionary.module.ts
```

현재 `src/users`와 `src/music`의 Nest module, DTO, ValidationPipe, error envelope, JWT/role guard, TypeORM migration 패턴을 재사용합니다. Controller는 도메인 모델을 직접 반환하지 않고 response DTO/presenter를 사용합니다. 초기 기능에서 admin과 live를 별도 deployable app으로 만들지 않습니다.

## 2. Live 기능

| 그룹 | 기능 | 접근 |
|---|---|---|
| Lookup | 언어 목록/언어별 검색, lexeme detail, senses/concepts/translations | 공개, 게시 publication만 |
| Characters / Study | 문자·독음·학습 | 미구현 |
| Health | process liveness, DB/readiness | 공개; DB 장애는 readiness에서 503 |

## 3. Admin 기능

| 그룹 | 기능 | 필수 제어 |
|---|---|---|
| Editorial | 출처·concept 생성, lexeme 생성/수정/조회 | `admin`, DTO 검증, revision 및 감사 기록 |
| Review | 현재 revision 검수 요청 및 승인 | `admin`; 승인 reason, actor/time |
| Publication | 승인 revision을 새 전체 스냅샷으로 게시 | `admin`; 예상 현재 ID와 감사 로그 |
| Import / Governance 확장 | import·반려·철회·MFA·세분화된 운영 역할 | 미구현 |

현재 앱의 `user/admin` 두 역할을 재사용하고 Admin API 전체를 admin-only로 둡니다. 별도의 `editor/reviewer/publisher/importer` 역할은 구현하지 않았습니다.

## 4. 인증·인가와 네트워크

- Admin 작업은 인증된 사용자와 server-side role 검사를 통과해야 하며 actor는 토큰에서 가져옵니다.
- 관리자 MFA/보호된 OIDC, 복구 절차 및 Nginx/VPN/Zero Trust 네트워크 제한은 **미구현·미검증**입니다. 운영 공개 전 별도로 마련해야 합니다.
- Admin API path는 `/api/v1/admin`입니다. 별도 Admin UI를 사용할 경우 해당 origin을 CORS allow-list에 추가해야 합니다.
- `dictionary_audit_logs`에 actor, action, 대상, revision 참조, request ID, timestamp 및 해당 작업의 reason을 저장합니다. password/token/secret은 기록하지 않습니다.

## 5. 서비스 경계와 향후 분리 기준

Live 조회는 현재 publication의 entry에 연결된 revision만 읽습니다. Admin은 별도 서비스와 DTO로 편집·검수·게시하며, 각 변경과 감사 기록은 같은 트랜잭션에서 처리합니다. 상세 계약은 [사전 API 명세](../api/API_SPEC.md)를 참고합니다.

아래 조건이 하나라도 운영 요구가 되면 별도 Admin/Live 앱 분리를 설계합니다.

- Admin은 사내망에서만 운영해야 하며 Live는 인터넷/별도 보안 인증 경계에 있어야 함.
- Live read scaling/캐시/가용성 요구가 Admin write 요구와 달라짐.
- 별도 팀/릴리스 주기 또는 장애 도메인이 실제로 필요함.
- API 호출량·성능 측정으로 단일 앱의 리소스 공유가 병목임이 입증됨.

