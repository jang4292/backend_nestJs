# 다국어 사전 REST API 초안

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 제안된 미래 계약입니다. 현재 저장소의 기존 API 계약은 `/api/v1` prefix 없이 운영되는 것으로 문서화되어 있습니다. 전체 앱에 prefix를 일괄 추가하지 말고, 기존 client 호환성을 보존하면서 신규 dictionary route만 버저닝해야 합니다.

## 1. 공통 규칙

- Base URL: `https://<host>/api/v1`; JSON UTF-8.
- `id`는 공개 가능한 opaque/string ID 권장. DB의 auto-increment 정수 노출 여부는 결정할 것.
- Live는 게시된 publication을 대상으로 하고 `publicationId` 및 `contentRevision`을 응답 metadata에 기록합니다.
- 페이지네이션: `limit` 기본 20, 최대 100; `cursor` opaque token. 검색 응답 순서는 `(language, normalized match rank, stable id)`로 안정화합니다.
- 선택 필터: BCP-47 `language`, script/region, part-of-speech, status(관리자만), concept, include fields.
- 문자열 검색은 literal query와 길이 상한을 사용합니다. SQL wildcard 검색식을 사용자 입력 그대로 적용하지 않습니다.
- Mutation에는 `Idempotency-Key`를 받는 operation을 명시하고, Admin mutation은 `X-Request-Id`를 감사 이벤트와 연결합니다.
- 응답에는 DB Entity를 직접 직렬화하지 않고 전용 DTO/presenter를 사용합니다.

### 응답 Envelope

현재 앱의 공통 error envelope와 호환을 우선하고, 성공 응답을 새 API에 적용합니다.

```json
{
  "ok": true,
  "requestId": "4b9e...",
  "data": { "id": "lex_123", "publicationId": "pub_2026_01" },
  "meta": { "nextCursor": null }
}
```

```json
{
  "ok": false,
  "requestId": "4b9e...",
  "errorCode": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "details": [{ "field": "language", "code": "UNSUPPORTED_LANGUAGE" }]
}
```

## 2. API 그룹

### Dictionary (public)

| Method / path | 목적·인증 | Query/Body | 정상 / 주요 오류 |
|---|---|---|---|
| `GET /languages` | 공개 지원 언어 조회 | `active=true` | 200 |
| `GET /lexemes` | 공개 검색 | `q`, `language`, `script`, `pos`, `conceptId`, `cursor`, `limit` | 200; 400 잘못된 filter |
| `GET /lexemes/{lexemeId}` | 어휘·forms·senses 조회 | `include=examples,translations,pronunciations` | 200; 404 |
| `GET /concepts/{conceptId}` | 언어 독립 의미 조회 | `language[]`, `cursor`, `limit` | 200; 404 |
| `GET /concepts/{conceptId}/translations` | 연결된 다국어 sense 조회 | `sourceLanguage`, `targetLanguage[]` | 200; 404 |
| `GET /characters/{codepoint}` | 문자 코드/표기·variants 조회 | codepoint는 `U+` 없는 hex | 200; 400/404 |
| `GET /characters/{codepoint}/readings` | 언어별 독음·출처 요약 | `language[]`, `script` | 200; 404 |

예: `GET /api/v1/lexemes?q=行&language=ja&limit=20`.

### Study (authenticated user)

| Method / path | 목적 | Request | 정상 / 주요 오류 |
|---|---|---|---|
| `POST /study/sessions` | 학습 세션 생성 | `{ deckId?, language, targetLanguage?, mode, limit }` | 201; 400/403 |
| `GET /study/sessions/{sessionId}/questions` | 세션 문제 조회 | `cursor`, `limit` | 200; 403/404 |
| `POST /study/sessions/{sessionId}/answers` | 답 제출·복습 상태 기록 | `{ cardId, answer, idempotencyKey? }` | 201; 400/403/409 |
| `GET /study/progress` | 개인 학습 진행도 | `from`, `to`, `deckId?` | 200 |
| `GET /study/reviews` | due 복습 카드 | `dueBefore`, `cursor`, `limit` | 200 |

보안 규칙: 사용자 소유권은 인증 token의 `sub`에서 정하며 body/query의 사용자 ID를 신뢰하지 않습니다. 답변 응답은 grade, 다음 복습 시각, 사용한 immutable `contentRevisionId`를 반환합니다. 정답이 필요 없는 문제 응답에 answer 필드를 노출하지 않습니다.

### Admin (authenticated, admin role + restricted network)

| Method / path | 목적 | 주요 입력/응답 |
|---|---|---|
| `POST /admin/lexemes` | draft lexeme 생성 | `languageTag`, `lemma`, `forms[]`, `partOfSpeech`; 201 |
| `PATCH /admin/lexemes/{id}` | 신규 revision 편집 | 수정 fields + `expectedVersion`; 200/409 |
| `POST /admin/concepts` | concept draft 생성 | `description`; 201 |
| `POST /admin/sense-concepts` | sense/concept 연결 검수 | `senseId`, `conceptId`, `relationType`; 201 |
| `POST /admin/character-readings` | 언어별 독음 편집 | character, language, reading metadata; 201 |
| `POST /admin/import-jobs` | 출처 등록 및 import job 생성 | `sourceId`, `sourceVersion`, `checksum`, `idempotencyKey`; 202 |
| `GET /admin/import-jobs/{id}` | staging/import 상태 확인 | 200; 404 |
| `POST /admin/import-jobs/{id}/review` | 검수/반려 결과 기록 | entry IDs, decisions, reason; 200/409 |
| `POST /admin/publications` | 승인 revision 집합 게시 | `{ revisionIds[], expectedCurrentPublicationId?, reason }`; 201 |
| `POST /admin/publications/{id}/revoke` | 공개 철회/이전 버전 복구 workflow | `{ reason }`; 202 |
| `GET /admin/audit-logs` | 변경 이력 조회 | actor, entity, date range, cursor; 200 |

위 API는 정확한 Request/Response DTO, pagination, sorting, validation, 권한 decorator와 Swagger operation을 구현 시 명시합니다. Admin writes는 actor ID, reason, request ID, before/after revision을 기록합니다.

### System

| Method / path | 용도 | 응답 |
|---|---|---|
| `GET /health/live` | process liveness | 200, 프로세스만 확인; 외부 dependency 조회 없음 |
| `GET /health/ready` | readiness | DB 등 필수 dependency 확인; 준비 불가 시 503 |

## 3. DTO 예시

### 검색

```http
GET /api/v1/lexemes?q=行&language=ja&cursor=&limit=20
```

```json
{
  "ok": true,
  "requestId": "req-123",
  "data": [{
    "id": "lex_123",
    "language": "ja",
    "forms": [{ "text": "行", "script": "Jpan", "type": "kanji" }],
    "senses": [{ "id": "sense_1", "partOfSpeech": "verb", "glosses": ["..."] }]
  }],
  "meta": { "publicationId": "pub_42", "nextCursor": null }
}
```

예시 gloss의 실제 텍스트는 라이선스·데이터 fixture 승인 전에는 사용하지 않습니다.

## 4. HTTP 상태/오류 정책

| Status | 사용처 |
|---|---|
| 200 | 조회/성공한 부분 수정 |
| 201 | 생성 및 publication revision 생성 |
| 202 | 비동기 import/revoke job 접수 |
| 400 | DTO/필터/locale/codepoint 오류 |
| 401 / 403 | 미인증 / 권한 또는 리소스 소유권 불일치 |
| 404 | 존재하지 않거나 호출자가 볼 수 없는 리소스 |
| 409 | optimistic version, 중복 idempotency, publication 상태 충돌 |
| 422 | 도메인 검증 실패(출처 누락, 연결 불가능한 sense 등) |
| 429 | 사용자/IP/job rate limit |
| 503 | readiness 실패 또는 의존성 일시 장애 |

외부 데이터 제공자 오류 원문, SQL 오류, 민감한 import payload는 API 응답에 포함하지 않습니다. Public endpoint에는 rate limit, query length 제한, cursor 검증을 적용합니다.

## 5. 버저닝·호환성

- 신규 dictionary route만 `/api/v1`로 시작합니다. 현 음악/auth route에 global prefix를 씌우지 않습니다.
- 응답 필드의 additive change는 v1 내에서 허용하되 필드 제거/의미 변경/권한 변경은 breaking change로 취급합니다.
- OpenAPI JSON을 CI에서 생성/검증해 Admin/Live UI 계약과 동기화합니다.
- deprecation은 응답 header/문서로 사전 고지하고, 클라이언트 전환 및 사용량 확인 후 제거합니다.

