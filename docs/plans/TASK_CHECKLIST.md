# 우선순위별 작업 체크리스트

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 체크리스트는 제안 상태입니다. P0의 읽기 전용 조사 이외에는 별도 Phase 승인 전 착수하지 않습니다.

## P0 — 진행 전 차단 항목

- [ ] 음악 API/DB가 계속 지원 대상인지, 신규 사전 시스템과 동일 제품인지 결정
- [ ] EC2, HP t620, DS218j의 실제 상태를 운영자 승인 하에 read-only 조사하거나 UNVERIFIED로 승인
- [ ] Production 콘텐츠 사용 방식과 상업 이용 의도 확정
- [ ] 외부 사전별 라이선스·attribution·파생/재배포 요건 확인
- [ ] Admin 접근 방식, 인증/MFA, 운영 역할 승인
- [ ] PROD DB, 비용 한도, RPO/RTO, backup 복구 책임자 결정
- [ ] 운영 DB/서비스를 변경하지 않고 DB 현재 schema·용량·Migration 상태 확보

## P1 — MVP 전에 필요

- [ ] Phase 1 architecture / trust boundary / environment decision 승인
- [ ] `src/dictionary/` module 경계 및 기존 route compatibility 기준 확정
- [ ] Unicode locale/script/variant/normalization 예제와 검색 MVP 범위 결정
- [ ] Lexeme/Sense/Concept/Character/provenance/publication ERD와 versioning policy review
- [ ] source license registry + attribution rendering 정책 구현 설계
- [ ] Admin role/authorization/audit contract 확정
- [ ] Migration 계정과 runtime DB 계정 분리 계획
- [ ] CI MariaDB schema, Unicode fixtures, OpenAPI compatibility gate 보강 범위 확정
- [ ] LOCAL local DB 및 DEV/PROD secret/DB 분리 설계
- [ ] 백업 off-host 저장, 암호화 키 회수, restore drill 설계

## P2 — 확장·운영 안정화

- [ ] Admin/Live 별도 deploy 필요 여부를 실제 트래픽/조직/보안 요구로 재평가
- [ ] 외부 worker queue, retry/backoff, DLQ/checkpoint, source adapter 분리
- [ ] CJK tokenizer/search engine 선택을 benchmark로 결정
- [ ] 콘텐츠 revision/publication 조회 caching 및 invalidation 정책
- [ ] MFA/SSO, refresh token/session revoke, 관리자 계정 recovery 강화
- [ ] audit retention, 사용자 계정/학습이력 삭제, source takedown 절차
- [ ] NAS backup 검증, snapshot/offsite copy, 복원 리허설 주기
- [ ] 운영 dashboard, alert, incident ownership, SLO를 실제 운영팀과 합의
- [ ] CI/CD AWS OIDC, environment approval, artifact signing 검토

