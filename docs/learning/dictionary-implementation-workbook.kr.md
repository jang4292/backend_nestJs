# 다국어 사전 구현·유지보수 실습

> 최신화 기준: 2026-11-17 · develop `82bb4f1` + 주석·문서 작업 트리
> 이 문서는 현재 사전 MVP를 설명합니다. 운영 데이터, 라이선스 승인 상태와 배포 환경은 확인하지 않았습니다.

목표는 담당자가 어휘를 등록하고 공개되는 경로를 재현한 다음, 동시 수정·검색·스키마 변경의 영향을 스스로 판단하는 것입니다. 실제 운영 DB가 아닌 [격리된 개발 환경](developer-handbook.kr.md)을 사용하세요.

## 1. 코드와 데이터 찾기

| 역할 | 파일 |
| --- | --- |
| 모듈 등록 | [`dictionary.module.ts`](../../src/dictionary/dictionary.module.ts), [`app.module.ts`](../../src/app.module.ts) |
| 관리자 HTTP | [`dictionary-admin.controller.ts`](../../src/dictionary/interface/dictionary-admin.controller.ts), [`dictionary.dto.ts`](../../src/dictionary/interface/dictionary.dto.ts) |
| 관리자 업무 규칙 | [`dictionary-admin.service.ts`](../../src/dictionary/application/dictionary-admin.service.ts) |
| 공개 HTTP·검색 | [`dictionary-live.controller.ts`](../../src/dictionary/interface/dictionary-live.controller.ts), [`dictionary-live.service.ts`](../../src/dictionary/application/dictionary-live.service.ts) |
| 콘텐츠 조립·정규화 | [`dictionary-content.ts`](../../src/dictionary/application/dictionary-content.ts) |
| 테이블과 제약 | [`dictionary.entities.ts`](../../src/dictionary/entities/dictionary.entities.ts), [사전 migration](../../src/database/migrations/1767000000000-CreateDictionarySchema.ts), [ERD](../database/ERD.md) |
| 요청·응답 계약 | [사전 API 명세](../api/API_SPEC.md), [`dictionary-response.dto.ts`](../../src/dictionary/interface/dictionary-response.dto.ts) |
| DB 기반 검증 | [`dictionary.e2e-spec.ts`](../../test/dictionary.e2e-spec.ts) |

`/api/v1/admin/*`은 관리자 JWT를 요구하고 `/api/v1/lexemes`, `/api/v1/concepts/*`, `/api/v1/languages`는 공개입니다. 관리자의 `actorId`는 요청 body가 아니라 인증된 사용자에서 가져옵니다.

### 데이터 관계

```text
language ──< lexeme ──< revision ──< form
                            ├──< sense ──< sense_concept >── concept
                            └── source

publication ──< publication_entry >── revision
      ↑                    │
publication_state(한 행)    └── lexeme
audit_log ── actor / revision / requestId / action
```

- `lexeme`은 언어에 속하는 **안정적인 어휘 ID**와 관리자 편집용 `currentVersion`을 가집니다.
- `revision`은 특정 버전의 표제어, 출처, 품사와 상태를 보관합니다. forms와 senses도 그 revision에 속합니다.
- `sense_concept`는 하나의 뜻과 언어 독립 개념을 연결합니다. 같은 개념에 연결된 다른 언어의 게시 어휘가 번역 후보입니다.
- `publication_entry`는 publication 안의 lexeme과 revision을 묶습니다. 복합 외래 키는 revision이 그 lexeme에 속하는지 확인합니다.
- `publication_state.id=1`은 현재 공개 스냅샷을 가리킵니다. 첫 migration은 지원 언어 5개와 `currentPublicationId=null`인 행을 넣습니다.
- 관리 쓰기와 audit 행은 같은 트랜잭션에 저장됩니다. 실패한 작업이나 단순 읽기는 이 업무 감사 로그에 추가되지 않습니다.

## 2. 초안에서 공개까지

### 2.1 준비

격리 DB에 migration을 적용하고 서버를 기동한 뒤 테스트용 `admin` 계정으로 로그인합니다. [가입·로그인 예제](../../API_EXAMPLES.md#2-register-public)에서 로컬 계정을 만들고 로그인 응답의 `access_token`을 사용합니다. 관리자 승격은 공개 API가 아니라 [승인된 관리자 DB 작업](../deployment/mariadb-systemd.kr.md#5-배포-후-작업)입니다. 실제 운영 계정이나 토큰을 예제에 넣지 않습니다.

아래 예는 **새 테스트 DB에서만** ID가 우연히 1일 수 있습니다. 각 응답의 `data.id`, `data.currentVersion`, `data.revision.id`를 확인해 다음 요청에 대입하세요. `ADMIN_TOKEN`은 별도 안전한 방법으로 현재 셸에 설정하며, 공유 호스트에서는 curl 인자가 다른 프로세스에 보일 수 있으므로 실제 운영 토큰으로 실습하지 않습니다.

```bash
BASE=http://127.0.0.1:3000

# 출처: 직접 만든 실습 데이터만 사용
curl -sS -X POST "$BASE/api/v1/admin/sources" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"직접 작성한 실습","license":"author-created","attribution":"실습 작성자"}'

# 서로 다른 언어의 뜻을 연결할 개념
curl -sS -X POST "$BASE/api/v1/admin/concepts" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"description":"실습용 인사 개념"}'
```

출처의 `license`·`attribution`은 필수지만 서버가 실제 사용 허가를 판정하지는 않습니다. 실제 자료는 담당자가 라이선스와 재배포 조건을 확인해야 합니다.

### 2.2 어휘 생성·검수

아래 `sourceId`, `conceptIds`는 앞에서 받은 값으로 바꿉니다.

```bash
curl -sS -X POST "$BASE/api/v1/admin/lexemes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"languageTag":"ko","lemma":"안녕","sourceId":1,"forms":[{"text":"안녕하세요","script":"Hang","type":"variant"}],"senses":[{"definition":"직접 작성한 실습 인사","conceptIds":[1]}]}'
```

응답은 `data.id`(lexeme ID), `data.currentVersion=1`, `data.revision.id`, `data.revision.status="draft"`를 포함합니다. 표제어는 최대 200자, forms는 최대 20개, senses는 1~20개입니다. sense마다 concept ID는 최대 20개이며 중복되지 않아야 합니다. 전체 제약은 DTO를 기준으로 확인하세요.

`1`이 아닌 실제 lexeme ID와 version을 넣어 검수 요청과 승인을 수행합니다.

```bash
curl -sS -X POST "$BASE/api/v1/admin/lexemes/1/submit" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"expectedVersion":1}'

curl -sS -X POST "$BASE/api/v1/admin/lexemes/1/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"expectedVersion":1,"reason":"실습 내용 검수 완료"}'
```

상태는 `draft → in_review → approved`입니다. submit/approve는 상태를 바꾸지만 새 version을 만들지 않으므로 위 두 요청의 `expectedVersion`은 같습니다. 상태가 맞지 않거나 다른 관리자가 편집해 version이 바뀌면 409입니다. 409 뒤에는 현재 어휘를 다시 읽고 사람이 변경 내용을 확인한 뒤 재시도합니다.

### 2.3 게시와 공개 조회

현재 publication을 먼저 확인합니다.

```bash
curl -sS "$BASE/api/v1/admin/publications/current" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

새 DB에서만 `data.publicationId`가 `null`입니다. 다음 요청의 `revisionIds`에는 **lexeme ID가 아니라 승인된 revision ID**를, `expectedCurrentPublicationId`에는 방금 읽은 값을 넣습니다.

```bash
curl -sS -X POST "$BASE/api/v1/admin/publications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"revisionIds":[1],"expectedCurrentPublicationId":null,"reason":"실습 게시"}'

curl -sS "$BASE/api/v1/lexemes?language=ko&q=%EC%95%88"
curl -sS "$BASE/api/v1/lexemes/1"
curl -sS "$BASE/api/v1/concepts/1/translations?targetLanguage=ko"
```

공개 응답의 `publicationId`, `contentRevisionId`, 출처·라이선스와 뜻을 확인합니다. 아직 게시되지 않은 어휘의 상세는 404이고, publication이 아예 없을 때 검색 목록은 빈 배열입니다. 게시되지 않은 개념 연결도 공개 개념 조회에서는 404입니다. 전역 요청 제한으로 429를 받으면 잠시 기다립니다.

같은 개념에 영어 어휘를 하나 더 만들고 검수·게시하면 `targetLanguage=en`으로 조회할 수 있습니다. 영어 어휘만 새로 게시해도 이전 한국어 항목은 새 스냅샷에 유지됩니다.

### 2.4 수정해도 공개 내용은 즉시 바뀌지 않음

```bash
curl -sS -X PATCH "$BASE/api/v1/admin/lexemes/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"expectedVersion":1,"lemma":"수정한 인사"}'
```

관리자 응답은 새 `draft` revision과 `currentVersion=2`를 반환합니다. 생략한 forms·senses·source·품사는 이전 revision에서 복사됩니다. 공개 상세는 **이전 publication에 기록된 revision**을 계속 반환합니다. 새 초안을 제출·승인하고 현재 publication ID를 지정해 다시 게시해야 공개 내용이 바뀝니다. 예전 revision을 직접 덮어쓰거나 공개 DB 테이블을 수동 수정하지 마세요.

## 3. 동시 수정과 게시가 안전한 이유

### 어휘 수정

1. 트랜잭션 안에서 lexeme 행을 `pessimistic_write`로 잠급니다.
2. 잠근 행의 `currentVersion`과 요청의 `expectedVersion`을 비교합니다.
3. 다르면 409, 같으면 이전 콘텐츠를 읽고 새 draft revision과 자식 행을 만듭니다.
4. lexeme의 version 증가와 audit까지 함께 commit합니다. 중간 실패 시 모두 rollback합니다.

잠금은 동시 실행 순서를 정하고, version 비교는 오래된 화면의 변경을 거부합니다. 둘은 서로 다른 문제를 해결합니다. 승인·제출도 같은 행을 잠근 뒤 현재 revision의 상태를 확인합니다.

### Publication

1. `publication_state`의 단일 행을 잠그고 `expectedCurrentPublicationId`를 비교합니다. 생략하면 `null`로 취급하므로 최초 게시 후에는 현재 ID를 전달해야 합니다.
2. 지정한 revision이 존재하고 모두 승인되었는지 검사합니다. 요청에 같은 lexeme의 revision이 두 개이면 400입니다.
3. 이미 공개된 동일 lexeme에 대해 같거나 더 오래된 version을 다시 게시하려 하면 409입니다. **현재 편집 version만 게시할 수 있다는 검사는 없습니다.** 다만 이미 공개된 버전보다 최신이어야 합니다.
4. 새 publication을 만들고 이전 스냅샷에서 요청에 없는 항목을 복사합니다. 요청한 항목은 지정 revision으로 기록합니다.
5. 현재 포인터와 감사 기록을 같은 트랜잭션에서 바꿉니다. 공개 조회는 현재 포인터를 사용하므로 초안이 우연히 공개되지 않습니다.

게시 취소·되돌리기 API는 구현되지 않았습니다. 이전 publication 행이 있다고 해서 운영자가 포인터를 수동으로 변경하는 절차가 승인된 것은 아닙니다.

## 4. 검색, 유니코드와 페이지네이션

- 원문은 그대로 표시하고 검색 키만 `NFC` 정규화 후 `toLowerCase()`합니다. 잘못된 Unicode 문자열은 거부하며 정규화 결과는 최대 512 Unicode 코드 포인트입니다.
- 검색은 표제어와 forms의 **접두사**입니다. 형태소 분석, 중간 일치, 오타 교정은 제공하지 않습니다. SQL `LIKE`의 `%`, `_`, `!`는 입력 문자로 이스케이프합니다.
- DB 사전 문자열은 `utf8mb4`/`utf8mb4_bin`을 사용합니다. 서로 다른 코드 포인트 표현을 비교할 때 DB collation만 믿지 않고 앱에서 같은 방식으로 정규화하는 이유입니다.
- 결과는 lexeme ID 오름차순입니다. `limit+1`개를 읽어 다음 페이지 존재 여부를 확인하고, 마지막 ID와 publication ID·검색 조건의 fingerprint를 cursor에 넣습니다.
- 같은 조건으로 `nextCursor`를 전달합니다. 조건이 바뀌면 400, publication이 바뀌면 409이므로 첫 페이지부터 다시 조회합니다. cursor는 Base64URL로 표현된 데이터이며 **서명, 암호화 또는 권한 증명 수단이 아닙니다.**
- forms·senses·개념 연결은 여러 revision에 대해 묶어서 조회합니다. 목록 항목마다 별도 조회를 추가하면 N+1 문제가 생길 수 있습니다.

## 5. 직접 기능을 확장하는 예: revision에 선택 발음 추가

아래는 구현 명령이 아니라 변경 범위를 찾기 위한 실습 절차입니다. 제품에서 허용할 언어별 형식·길이·공개 정책을 먼저 결정합니다.

1. 기존 응답과 데이터에 영향을 주지 않도록 새 nullable 컬럼을 추가하는 **새 migration**과 entity 필드를 만듭니다. 적용된 기존 migration은 편집하지 않습니다. 필드 제거 시 데이터가 사라지므로 rollback·백업 방안을 먼저 정합니다.
2. 생성/수정 DTO와 `RevisionInput`에 필드를 추가하고, 문자열 길이와 Unicode 검증을 정합니다. 수정 시 생략은 이전 값 복사인지, `null`은 삭제인지 명시적으로 구분합니다.
3. `updateLexeme`의 이전 revision 복사와 `createRevision` 저장에 반영합니다. **기존 revision을 업데이트하지 말고 새 revision에만 값**을 저장합니다.
4. `presentAdminLexeme`, 공개 `presentEntries`, Swagger의 구체적인 응답 DTO와 [사전 API 명세](../api/API_SPEC.md)를 함께 갱신합니다.
5. 테스트에서 새 값 생성, 생략 시 복사, null 처리, 오래된 version 409, 새 초안이 기존 publication에 노출되지 않는지 확인합니다. 승인·재게시한 뒤에만 새 값이 공개되는지도 확인합니다.
6. 격리 DB에서 빈 DB 전체 migration과 기존 데이터 위 적용을 검증하고, 구버전 클라이언트가 추가 필드를 처리하는지 확인합니다.

새 테이블을 추가하는 경우에는 `APP_TABLES`, entity 목록, migration, 권한·백업 범위도 함께 검토합니다. 새 컬럼 하나만 추가한다면 테이블 allowlist를 늘릴 필요는 없습니다.

## 6. 테스트와 문제 해결

사전 E2E는 MariaDB의 FK·트랜잭션·유니코드 및 publication을 직접 변경합니다. [격리 절차](developer-handbook.kr.md)대로 일회성 로컬 DB를 준비하고 다음처럼 해당 파일만 실행할 수 있습니다.

```bash
ENV_FILE=/absolute/path/to/isolated-test.env ISOLATED_DATABASE_E2E=true npm run test:e2e -- --runInBand dictionary.e2e-spec
```

| 증상 | 확인할 것 |
| --- | --- |
| 관리자 401/403 | Bearer 토큰의 만료·session version, DB의 사용자 역할 |
| 생성 400 | DTO의 필수 필드·지원 언어·source/concept 존재·배열 제한 |
| 수정·승인 409 | 최신 `currentVersion`, 현재 revision의 상태 |
| 게시 409 | 최신 publication ID, 승인 상태, 이미 공개된 version |
| 공개 검색 빈 목록 | 현재 publication과 게시된 revision, 언어·접두사 |
| cursor 400/409 | 이전과 같은 조건인지, 도중에 publication이 바뀌었는지 |
| 준비 상태 503 | DB 연결·계정·TLS와 `/api/v1/health/ready`; `/live`만으로 DB 상태를 판단하지 않음 |

사전 migration의 `down()`은 사전 데이터가 있거나 기본 언어가 변경되면 실패합니다. 복구가 필요하면 데이터와 배포 시점을 확인하고 [백업·복구 계획](../operations/BACKUP_RECOVERY.md)에 따라 격리 복원을 검증하세요.

## 7. 스스로 설명할 수 있어야 하는 것

1. `lexeme.id`, `revision.id`, `publication.id`는 각각 무엇을 식별하나요?
2. 승인된 revision과 현재 공개 revision은 왜 다를 수 있나요?
3. 동시에 두 관리자가 같은 version을 수정하면 왜 한 요청이 409를 받나요?
4. `nextCursor`를 저장한 뒤 새 publication이 게시되면 왜 처음부터 조회해야 하나요?
5. 출처를 등록했다는 사실과 실제 데이터의 사용 허가를 받았다는 사실은 왜 다른가요?

문자·독음 전용 API, 외부 import, 학습 이력, 게시 롤백, idempotency key 등은 현재 MVP에 없습니다. 목표 설계 문서의 제안과 구현된 기능을 구분하세요.
