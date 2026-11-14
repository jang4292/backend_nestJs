# 다국어 사전·학습 플랫폼 목표 구조 (TO-BE)

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 상태: 장기 아키텍처 초안. 단일 앱 사전 MVP는 이후 구현되었으며 현재 범위는 [API 명세](../api/API_SPEC.md)를 참고합니다. 학습·import·인프라 등 나머지 내용은 제안입니다.

## 1. 목표와 경계

영어(`en`), 중국어(`zh-Hans`, `zh-Hant`), 일본어(`ja`), 한국어(`ko`)의 어휘·표기·의미를 언어 독립 개념에 연결하고, 승인·게시된 콘텐츠를 검색·학습할 수 있게 합니다. 중국어 간체/번체는 서로 다른 표기·언어 태그로 구별하며, 일본어·중국어 한자 한 글자의 언어별 독음과 뜻은 하나의 전역 발음 필드로 합치지 않습니다.

기존 음악·사용자 API를 유지하며 동일 앱에 사전 MVP를 추가했습니다. 음악 API 종료나 데이터 이관·삭제는 승인되지 않았습니다.

## 2. 권장 아키텍처

초기 MVP는 **단일 배포 NestJS modular monolith**를 권장합니다. 현재 저장소의 NestJS 모듈 구조, 인증, 공통 응답, TypeORM Migration, CI를 활용하고, 신규 도메인은 `src/dictionary/`에 격리합니다. 프로세스 분리의 초기 비용 없이도 Admin/Live 경계는 controller, use-case, permission, repository, route prefix로 강제할 수 있습니다.

```mermaid
flowchart LR
  Browser[Live Web / Admin Web / Mobile] --> Edge[Nginx: TLS, rate limit, admin network policy]
  Edge --> API[NestJS modular monolith]
  API --> Live[/api/v1: public read + authenticated study]
  API --> Admin[/api/v1/admin: role + network restricted]
  Live --> Dictionary[Dictionary read model]
  Admin --> Editorial[Draft / review / approve / publish]
  Editorial --> Maria[(MariaDB: normalized content + immutable published revision)]
  Live --> Study[Study sessions / user progress]
  Study --> Maria
  Import[Isolated import worker] --> Staging[Authenticated import or controlled file handoff]
  Staging --> Admin
  NAS[(NAS: encrypted backup / raw source archive)] -. backup only .-> Maria
```

Worker는 사용자 요청과 분리하고, 외부 소스 다운로드/정규화/검증은 staging으로만 보냅니다. 운영 MariaDB에 Worker가 직접 접속하는 경로는 두지 않습니다. 초기에는 승인된 파일을 EC2 내부 Import API/작업으로 전달하고, 안정화 후 queue/worker를 별도 프로세스로 분리할 수 있습니다.

## 3. Admin / Live 경계

- **Live API:** 지원 언어, 게시 버전의 lexeme·sense·concept·character 조회/검색, 사용자 학습 세션·답안·복습 상태. 공개 데이터 조회와 사용자 소유 데이터 쓰기를 별도 권한 처리합니다.
- **Admin API:** 초안 작성, 출처·라이선스 연결, import 검수, 중복 및 데이터 품질 확인, 승인·게시, 게시 취소/교체, 관리자·권한, 변경 감사 이력.
- Live는 draft/review 레코드를 직접 읽지 않습니다. 하나의 immutable `publication_id`가 가리키는 일관된 스냅샷만 검색합니다.
- Admin은 `/api/v1/admin`로 구분하되 경로만으로 보안 경계를 만들지 않습니다. 인증, 최소 권한 역할, Nginx/VPN/Zero Trust 접근 통제, 감사 로그가 함께 필요합니다.
- 첫 출시에서 앱/배포 단위를 나누지 않습니다. 독립 스케일링·조직 소유권·보안 인증 경계가 실제 요구가 되면 Option B로 분리합니다.

## 4. 데이터 처리·게시·학습 불변성

1. 수집 결과를 원본 출처, 버전, 다운로드 시각, 라이선스, checksum과 함께 staging에 저장합니다.
2. parser/normalizer는 재실행 가능한 idempotent import job으로 동작합니다. 기존 게시 데이터를 덮어쓰지 않습니다.
3. 매핑·중복·Unicode 정규화·필수 필드 검증 후 Admin 검수 큐로 이동합니다.
4. 관리자가 승인한 변경만 새 content revision에 반영하고, publication은 승인된 revision 집합을 고정합니다.
5. Live 조회는 현재 활성 `publication_id`만 사용합니다. 게시 취소/교체는 이전 publication을 비활성화하고 새 publication을 원자적으로 전환합니다.
6. Study card/answer는 생성 시 사용한 prompt/answer content revision을 참조합니다. 정답 수정·의미 연결 변경이 과거 학습 결과를 조용히 바꾸지 않게 합니다.
7. 데이터를 다시 수집해도 관리자 수정값을 출처값으로 덮어쓰지 않도록 field-level provenance와 conflict 상태를 보존합니다.

## 5. Option 비교

| 기준 | Option A: 단일 앱/모듈 경계 (권장 MVP) | Option B: Admin/Live 별도 앱·배포 |
|---|---|---|
| 유지보수 | 공통 도메인·DB 계약을 한 저장소에서 관리 | 계약·버전 호환과 중복 설정 필요 |
| 보안 | RBAC와 네트워크 정책을 올바르게 설정해야 함; 프로세스 격리는 없음 | 별도 네트워크·비밀키·DB 계정으로 격리 강화 가능 |
| 성능/확장 | 단일 프로세스 용량을 공유; 초기 트래픽에 적합 | Live만 확장 가능; 내부 호출/배포 복잡도 증가 |
| 개발 난이도 | 낮음; 기존 Nest 모듈과 CI 재사용 | 높음; monorepo/shared contract/배포 2개 |
| 비용/리소스 | API 프로세스와 DB 한 세트 | 프로세스·관측·배포 관리 오버헤드 추가 |
| 전환 조건 | 현재 추천 | Admin을 사내망 전용으로 독립 운영해야 하거나, Live 확장/팀 소유권이 분리될 때 |

Option B를 선택하더라도 DB 엔터티를 양쪽 앱에서 직접 공유하지 말고, 버전된 API 계약 또는 application port를 통해 접근합니다. Module 경계를 지키면 이 전환을 준비할 수 있습니다.

## 6. 보안·복구 원칙

- 운영 MariaDB의 3306 및 Nest 내부 포트는 인터넷에 공개하지 않습니다.
- Admin write에는 최소 권한 role, 강한 MFA 가능한 인증, 별도 네트워크 제한, actor/request ID 포함 audit log를 적용합니다.
- LOCAL/DEV/PROD의 DB, JWT key, OAuth key, storage credentials를 분리하고 PROD 덤프를 DEV에 복사하지 않습니다.
- 모든 schema 변경은 검토된 Migration으로 수행하며 앱 시작 시 자동 Migration을 금지합니다.
- Nginx 뒤 client IP 제한을 설정할 때 `TRUST_PROXY`는 정확한 hop/IP 범위로 제한합니다. `true`를 임의 적용하지 않습니다.
- 실질적인 RPO/RTO, 백업 보존기간, 복원 절차는 EC2/NAS 상태와 비용을 점검한 뒤 확정합니다.

## 7. 설계 미결정 사항

Phase 0/1에서 다음을 합의해야 합니다.

1. 음악 API와 DB를 같은 제품에서 유지할지, 신규 dictionary 서비스로 분리할지.
2. 상업 서비스/오픈 콘텐츠/혼합 모델 중 목표 라이선스 정책과 출처별 데이터 필드 격리.
3. UI/관리자 인증 방식, MFA/SSO, 역할 분리(관리자·편집자·검수자).
4. 중국어 용어 태그 정책(간체/번체 각각의 locale, 동일 어휘 묶기 방식), 한국어·일본어 표기/발음 표준.
5. 무료 API와 계정/학습 기능의 사용자 데이터 보존·삭제 정책.
6. 초기 검색 범위, 데이터 규모, 검색 성능 SLO와 사용자 증가 가정.
7. HP t620 / DS218j 장비의 상태·가용성 및 외부 공개 허용 범위.

## 8. 외부 데이터 소스 후보 (2026-11 확인)

아래는 수집 가능성과 공개된 라이선스 조건의 1차 출처 조사이며, 법률 자문이나 프로덕션 데이터 반입 승인이 아닙니다. 실제로 가져오는 각 release/file 및 모든 하위 자료의 license, attribution, source version을 별도로 확인해 `data_sources`에 기록해야 합니다.

| 소스 | 제공 형태·대상 | 공개된 이용 조건 | 설계상 주의 |
|---|---|---|---|
| [Wikidata Lexicographical Data](https://www.wikidata.org/wiki/Wikidata:Lexicographical_data/Documentation) | Lexeme/Form/Sense; API/SPARQL 및 bulk data 경로 ([data access](https://www.wikidata.org/wiki/Wikidata:Data_access)) | structured data는 CC0 ([license](https://www.wikidata.org/wiki/Wikidata:Licensing)) | 실시간 high-volume API 대신 dump 우선 검토. API request policy/최대 처리량은 사용 전 확인. Coverage·품질을 대상 언어별로 샘플링 |
| [Kaikki / Wiktextract](https://kaikki.org/dictionary/rawdata.html) | Wiktionary extraction JSONL; dump/regular refresh, source edition별 coverage | underlying Wiktionary edition의 terms/attribution/share-alike 준수. 한 dump 안에서도 source edition/field provenance를 유지 | 영어 raw dump 페이지는 2026-10-01 snapshot, 24.8GB JSONL / 2.9GB gzip으로 표기. 중국어 dump도 제공되나 전체 target locale coverage와 storage/CPU를 먼저 확인. Dataset 전체를 NAS/EC2로 가져오는 MVP는 피함 |
| [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?lang=en&page=cc-cedict) | UTF-8 text/zip/gzip; simplified + traditional, pinyin, English gloss | CC BY-SA 4.0, commercial use 가능하나 attribution + share-alike 조건 ([license/download](https://www.mdbg.net/chinese/dictionary?lang=en&page=cc-cedict)) | 2026-11-13 release page는 125,412 entries 표기. 독점 데이터와의 혼합/결합물 배포 영향은 법률 검토 전 확정 금지 |
| [JMdict / EDRDG](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) | XML dictionary, Japanese/English 중심; release file 및 문서 | EDRDG의 [일반 라이선스](https://www.edrdg.org/edrdg/licence.html)는 CC BY-SA 4.0, attribution·share-alike를 명시하고 commercial use를 허용 | 추가 언어 translation components는 별도 권리 가능. 앱 문서·웹 사전 UI의 credit/link 조건을 그대로 구현 |
| [KANJIDIC2 / EDRDG](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) | XML character-level data; downloadable release | 동일 EDRDG [license statement](https://www.edrdg.org/edrdg/licence.html)의 대상에 KANJIDIC2가 포함됨 | 특정 부가 코드/파생 자료의 별도 제한 여부를 실제 배포 파일·문서에서 재확인. Character reading은 언어/출처별로 저장 |
| [Unicode Unihan](https://www.unicode.org/Public/UNIDATA/Unihan.zip) | Unicode release별 Unihan data files | [Unicode License v3](https://www.unicode.org/license.txt): 재사용·상업 배포 가능; copyright/permission notice를 파일 또는 문서에 유지 | 버전 고정·notice 보존. Unicode 상표를 승인 없이 판촉에 쓰지 않음; 각 release의 예외 조건 확인 |
| [국립국어원 한국어기초사전 Open API](https://krdict.korean.go.kr/kor/openApi/openApiInfo) | UTF-8 query API, 인증키 필수; 사이트에 사전 전체 내려받기 안내도 있음 | [저작권 정책](https://krdict.korean.go.kr/kor/kboardPolicy/copyRightTermsInfo): 별도 표시 없는 자료는 CC BY-SA 2.0 KR, commercial use 가능, attribution + share-alike. 이미지/음성 등 multimedia는 개별 조건 | API key/요청 파라미터가 필요. 요청 quota/키 승인 조건과 다운로드 파일 조건을 신청 시 확인; audio/media는 기본 제외 |

### 수집 결정 제안

1. 초기 검증은 CC0 Wikidata, Unicode Unihan의 제한된 sample 및 CC-CEDICT/EDRDG/Korean API의 small approved fixture로 시작하고, 각각의 attribution/license 표시를 UI/API metadata에서 확인합니다.
2. CC BY-SA 데이터와 독점/개별 사용자 기여 콘텐츠를 같은 배포물로 결합할 수 있는지 법무 검토가 끝나기 전에는 commercial redistribution을 약속하지 않습니다.
3. Kaikki는 전체 source dump가 매우 크고 Wiktionary의 edition별 license/coverage를 검토해야 하므로, MVP 전체 import source로 바로 선택하지 않습니다.
4. 외부 API는 rate/terms 변경 가능성이 있어 batch import와 source version/checkpoint가 API 응답의 Live runtime dependency가 되는 것을 막습니다.

