# 학습 로드맵

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 이 저장소의 학습 자료를 한곳에 모았습니다. 위에서부터 순서대로 읽으면 "구조 → 데이터 → 운영 → 보안" 흐름으로 이해할 수 있습니다.
> 같은 내용을 웹사이트로 보려면 `docs/html/index.html`을 브라우저로 엽니다([학습 사이트 관리 가이드](../html/README.md)).

## 1. 읽는 순서

| 순서 | 문서 | 무엇을 배우나 | 먼저 알면 좋은 것 |
| --- | --- | --- | --- |
| 1 | [서비스 개요](../product/overview.kr.md) → [기능 명세](../product/features.kr.md) | 이 서버가 하는 일, 기능 규칙 | 없음 |
| 2 | [아키텍처·운영 안정성 가이드](nestjs-operational-stability-guide.kr.md) | NestJS 모듈 구조, 계층과 포트·어댑터, 오류 처리, 인증·인가, 품질 게이트 | TypeScript, NestJS 기본 |
| 3 | [Music 학습 가이드](../music/learning-guide.kr.md) | 도메인(Artist·Track·Playlist), 요청 흐름, presenter, 트랜잭션 | 2번 |
| 4 | [DB·스키마 관리 가이드](database-schema-management.kr.md) | DB·테이블은 누가 언제 만드나, migration 적용과 검증, 롤백, 다른 DB 보호 | SQL 기본 |
| 5 | [환경별 DB·설정 가이드](../deployment/database-environments.kr.md) | Local / Test / Prod 설정과 명령, 권한, 자주 나는 오류(실행 절차) | 4번 |
| 6 | [시크릿 관리 가이드](security-guide.kr.md) → [API 보안 학습 가이드](api-security-guide.kr.md) | 비밀 관리와 push 전 점검 → 위협 모델, 비밀번호·세션·인가, 외부 IdP 검증, **대소문자 경로 우회 사례**, 직접 점검하는 방법 | 2번 |
| 7 | [SNS 로그인 운영 가이드](sns-login-operational-guide.kr.md) → [SNS 재활성화 체크리스트](../auth/sns-reenable-checklist.kr.md) | provider 구조, opt-in 정책, 다시 켤 때 점검 | 2번 |
| 8 | [배포 시크릿 체크리스트](deployment-secrets-checklist.kr.md) → [EC2 배포 가이드](../deployment/mariadb-systemd.kr.md) | 운영 배포 순서, 시크릿 회전, 롤백 | 5번 |
| 9 | [작업 내역과 배운 점](work-history-2026-11.kr.md) | 2026-11 감사와 후속 작업 전체(1~7단계): 문제, 원인, 조치, 교훈 | 1~8번 |
| 10 | [DB 개선 가이드](database-improvement-guide.kr.md) | 남은 DB 과제의 우선순위와 단계: drift, 계정 분리, 백업, 전송 구간, refresh token | 4~5번 |
| 참고 | [용어집](glossary.kr.md) | aud, iss, PKCE, fail-closed, drift, expand/contract 등 | — |
| 참고 | [실행 오류 이력](runtime-troubleshooting-history.kr.md) (이력 문서) | 과거 로컬 실행 오류와 해결 과정 | — |
| 참고 | [감사 리포트](../audit/2026-11-08-project-audit.kr.md), [보안 감사](../audit/2026-11-09-security-audit.kr.md) | 발견 사항 전체(ID), 로드맵, 릴리스 체크리스트, 배포 영향 | — |

## 2. 주제별 찾아보기

| 궁금한 것 | 문서 |
| --- | --- |
| 계층(controller → use-case → port → adapter)을 어떻게 나눴나 | [아키텍처 가이드 6장](nestjs-operational-stability-guide.kr.md#6-계층과-포트어댑터-users-예시) |
| 오류를 HTTP 응답으로 바꾸는 곳 | [아키텍처 가이드 7장](nestjs-operational-stability-guide.kr.md#7-오류-처리를-한-곳에-모으기) |
| admin만 쓸 수 있는 API는 어떻게 막나 | [아키텍처 가이드 8장](nestjs-operational-stability-guide.kr.md#8-인증과-인가) |
| 명령마다 어떤 env 파일을 읽나 | [환경별 가이드 1장](../deployment/database-environments.kr.md#명령과-env-파일) |
| DB·테이블은 언제 만드나, 왜 기동 시 자동 실행을 안 하나 | [DB 가이드 3~4장](database-schema-management.kr.md#4-적용-방식-비교-직접-sql--명령--기동-시-자동) |
| Test에서 되던 스키마를 Local·Prod에 반영하기 | [DB 가이드 5장](database-schema-management.kr.md#5-test에서-되던-것이-localprod에-없으면) |
| migration에 필요한 권한, 중간 실패 방지 | [DB 가이드 8.2](database-schema-management.kr.md#82-사례-실제-개발-서버에-처음-연결할-때-2026-11-09) |
| 같은 서버의 다른 DB를 지키는 방법 | [환경별 가이드 2장](../deployment/database-environments.kr.md#2-db-삭제-안전-원칙), [DB 가이드 8.3](database-schema-management.kr.md#83-사례-같은-서버의-다른-db를-지키기-2026-11-09) |
| 운영 배포 순서와 롤백 | [EC2 배포 가이드](../deployment/mariadb-systemd.kr.md) |
| 비밀이 커밋됐을 때 | [시크릿 관리 가이드 4장](security-guide.kr.md#4-시크릿이-이미-커밋됐다면) |
| 꺼진 기능이 열리는 이유, fail-closed | [API 보안 가이드 8장](api-security-guide.kr.md#8-사례-대소문자-경로로-비활성-provider-우회-sec-17) |
| 비밀번호를 바꾸면 토큰을 어떻게 무효화하나 | [API 보안 가이드 5장](api-security-guide.kr.md#5-세션-jwt와-취소) |
| 무차별 대입을 IP와 계정 단위로 막기 | [API 보안 가이드 4장](api-security-guide.kr.md#4-무차별-대입-ip-단위와-계정-단위) |
| 보안 점검을 직접 해 보는 순서 | [API 보안 가이드 12장](api-security-guide.kr.md#12-직접-보안-점검하는-방법) |
| 앞으로의 DB 과제와 순서 | [DB 개선 가이드 2장](database-improvement-guide.kr.md#2-우선순위) |

## 3. 자가 점검과 실습 모음

각 문서 끝에 질문과 과제가 있습니다. 읽은 뒤 스스로 답해 보세요.

| 문서 | 자가 점검 | 실습 |
| --- | --- | --- |
| 아키텍처 가이드 | 14장의 파일별 질문 | [15장 실습 과제](nestjs-operational-stability-guide.kr.md#15-실습-과제) |
| Music 학습 가이드 | [9장 질문](../music/learning-guide.kr.md#9-학습자가-스스로-답해야-하는-질문) | [8장 실습](../music/learning-guide.kr.md#8-직접-해보는-학습-실습) |
| DB·스키마 관리 가이드 | [11장 자가 점검](database-schema-management.kr.md#11-자가-점검-질문) | [12장 실습 과제](database-schema-management.kr.md#12-실습-과제) |
| API 보안 학습 가이드 | [14장 자가 점검](api-security-guide.kr.md#14-자가-점검-질문) | [15장 실습 과제](api-security-guide.kr.md#15-실습-과제) |
| DB 개선 가이드 | [5장 자가 점검](database-improvement-guide.kr.md#5-자가-점검-질문) | [6장 실습 과제](database-improvement-guide.kr.md#6-실습-과제) |
| 작업 내역과 배운 점 | 단계별 "배운 점"을 자기 말로 설명하기 | "남은 과제" 중 하나(예: DB-12 drift 해소)를 직접 해 보기 |

## 4. 학습 자료 작성 규칙

- **개념과 이유는 `learning/`에, 실행 절차는 `deployment/`에 둡니다.** 같은 주제는 서로 링크합니다.
- **작업을 하면 기록을 남깁니다.** 문제, 원인, 조치, 배운 점을 [작업 내역](work-history-2026-11.kr.md)이나 관련 가이드의 "사례" 절에 추가합니다.
- **문서 상단에 최신화 기준을 적습니다.** 이력 문서는 작성 시점에 고정합니다.
- **새 학습 문서는 사이트 설정에도 넣습니다.** `docs/html/_tools/site.config.json`의 섹션 순서가 사이트의 학습 순서입니다. HTML은 원할 때 `npm run docs:html`로 다시 만듭니다.
- **공개 저장소이므로** 실제 서버 주소, 포트, 계정, 비밀번호는 적지 않습니다. `<dev-db-host>`, `<dev-user>` 같은 자리표시자를 씁니다.
