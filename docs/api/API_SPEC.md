# 다국어 사전 REST API

> 최신화 기준: 2026-11-14 · dictionary MVP 작업 트리
> 이 문서는 현재 구현된 사전 API를 설명합니다. 기존 음악·인증 API에는 전역 prefix를 추가하지 않습니다.

## 공통 규칙

- 사전과 health 경로는 `/api/v1`을 사용하며 JSON UTF-8로 요청하고 응답합니다. ID는 정수입니다.
- Public 조회는 현재 publication의 승인된 revision만 반환하며, 출처의 이름·라이선스·attribution·URL을 함께 제공합니다.
- Public 목록의 `limit`은 기본 20, 최대 100이며 `cursor`는 opaque token입니다. 정렬은 lexeme ID 오름차순입니다. 다음 페이지 요청에는 같은 검색 조건을 사용해야 하며, publication이 바뀌면 409를 반환하므로 첫 페이지부터 다시 조회합니다.
- 검색은 lemma와 forms에 대해 NFC 정규화·소문자 변환 후 **접두사**를 비교합니다. `%`, `_`, `!`는 와일드카드가 아닌 문자 그대로 취급합니다. 언어별 형태소 분석이나 fuzzy 검색은 지원하지 않습니다.
- 관리자 API는 Bearer JWT와 `admin` 역할이 필요합니다. actor는 토큰에서 결정하며 요청 body에서 받지 않습니다. 쓰기와 감사 기록은 같은 트랜잭션에서 처리합니다.
- Swagger를 명시적으로 활성화한 비운영 환경에서는 `/api-docs`에서 DTO와 응답 스키마를 확인할 수 있습니다.

성공 응답 예:

```json
{
  "ok": true,
  "requestId": "req-123",
  "data": { "publicationId": null, "items": [], "nextCursor": null }
}
```

오류 응답 예:

```json
{
  "ok": false,
  "requestId": "req-123",
  "errorCode": "BAD_REQUEST",
  "message": "Invalid cursor"
}
```

## Public

| Method / path | 입력 | 결과 |
|---|---|---|
| `GET /api/v1/languages` | 없음 | 지원 언어 `en`, `ko`, `ja`, `zh-Hans`, `zh-Hant` |
| `GET /api/v1/lexemes` | `q?`(최대 100자), `language?`, `cursor?`, `limit?` | `{ publicationId, items, nextCursor }`; 게시물이 없으면 빈 목록 |
| `GET /api/v1/lexemes/{id}` | 정수 ID | 게시된 어휘·forms·senses·source·`contentRevisionId`·`publicationId`; 없으면 404 |
| `GET /api/v1/concepts/{id}` | `language?`, `cursor?`, `limit?` | 게시된 개념과 연결 어휘; 게시된 연결이 없으면 404 |
| `GET /api/v1/concepts/{id}/translations` | `targetLanguage?`, `cursor?`, `limit?` | 같은 개념에 연결된 게시 어휘; 개념이 공개되지 않으면 404 |
| `GET /api/v1/health/live` | 없음 | 프로세스 생존 확인 |
| `GET /api/v1/health/ready` | 없음 | DB `SELECT 1`; 실패하면 503 |

`language`와 `targetLanguage`는 위 다섯 태그 중 하나입니다. Concept 응답은 검색 목록과 같은 필드에 `concept: { id, description }`을 추가합니다. 기존 `/health`도 유지됩니다.

## Admin

관리자 목록은 `page`(기본 1)와 `limit`(기본 20, 최대 100)을 사용하고 `{ items, total, page, limit }`을 반환합니다.

| Method / path | 목적과 입력 | 성공 |
|---|---|---|
| `POST /api/v1/admin/sources` | 출처 생성: `name`, `license`, `attribution`, `url?` | 201 |
| `GET /api/v1/admin/sources` | 출처 목록 | 200 |
| `POST /api/v1/admin/concepts` | 개념 생성: `description` | 201 |
| `GET /api/v1/admin/concepts` | 개념 목록 | 200 |
| `POST /api/v1/admin/lexemes` | 초안 생성: `languageTag`, `lemma`, `sourceId`, `senses`, `partOfSpeech?`, `forms?` | 201 |
| `GET /api/v1/admin/lexemes` | 어휘 목록, `status?` 필터 | 200 |
| `GET /api/v1/admin/lexemes/{id}` | 현재 revision 상세 | 200 |
| `PATCH /api/v1/admin/lexemes/{id}` | `expectedVersion`과 변경할 콘텐츠 필드로 새 초안 생성 | 200 |
| `POST /api/v1/admin/lexemes/{id}/submit` | `expectedVersion`으로 초안 검수 요청 | 200 |
| `POST /api/v1/admin/lexemes/{id}/approve` | `expectedVersion`, `reason`으로 검수 중 revision 승인 | 200 |
| `GET /api/v1/admin/publications/current` | `{ publicationId }`, 최초에는 `null` | 200 |
| `POST /api/v1/admin/publications` | `revisionIds`, `expectedCurrentPublicationId?`, `reason`으로 게시 | 201 |
| `GET /api/v1/admin/audit-logs` | 감사 로그 목록 | 200 |

어휘 생성 예:

```json
{
  "languageTag": "ko",
  "lemma": "예시",
  "sourceId": 1,
  "forms": [{ "text": "예시", "script": "Hang", "type": "variant" }],
  "senses": [{ "definition": "직접 작성한 뜻", "conceptIds": [1] }]
}
```

`senses`는 1~20개, `forms`는 최대 20개입니다. 각 sense의 `conceptIds`는 최대 20개이며 기존 개념을 참조합니다. 변경하지 않은 필드는 이전 revision에서 복사되고, 편집할 때마다 새 `draft` revision이 만들어집니다. 상태는 `draft → in_review → approved` 순서로 진행합니다. 수정·제출·승인 시 `expectedVersion`이 오래되었거나 상태가 맞지 않으면 409입니다.

게시 요청 예:

```json
{
  "revisionIds": [1, 2],
  "expectedCurrentPublicationId": null,
  "reason": "검수 완료"
}
```

승인된 revision만 게시할 수 있습니다. 게시 트랜잭션은 이전 스냅샷에서 요청에 없는 어휘를 유지하고 지정한 어휘만 새 revision으로 교체한 뒤 현재 publication 포인터를 원자적으로 바꿉니다. `expectedCurrentPublicationId`를 생략하면 `null`로 간주하므로 최초 게시 이후에는 현재 ID를 전달해야 합니다. 동시에 다른 게시가 완료되거나 이미 같은/더 최신 revision이 공개된 경우 409입니다. 단일 요청은 최대 100개 revision을 받습니다.

## 상태와 운영 제한

| 상태 | 의미 |
|---|---|
| 400 | DTO, 필터, cursor 또는 참조 검증 실패 |
| 401 / 403 | 미인증 / admin 권한 부족 |
| 404 | 존재하지 않거나 게시되지 않은 리소스 |
| 409 | version, review 상태, publication 또는 cursor 충돌 |
| 429 | 공통 요청 제한 |
| 503 | readiness에서 DB 연결 실패 |

출처 정보는 수동 등록만 제공하며 라이선스의 적법성이나 재배포 가능 여부를 자동 검증하지 않습니다. 외부 데이터는 가져오지 않았습니다. MFA, 관리자 네트워크 제한, 출처 승인 절차와 배포 환경은 별도 운영 검증이 필요합니다. 문자·독음 API, 학습, import job, 게시 취소/롤백, idempotency key는 MVP에 구현되지 않았습니다.
