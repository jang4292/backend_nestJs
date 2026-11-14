# 우선순위별 작업 체크리스트

> 최신화 기준: 2026-11-14 · dictionary MVP 작업 트리
> 동일 앱의 사전 MVP 구현 상태와 운영 전 남은 항목을 구분합니다. 미검증 운영 환경은 변경하지 않았습니다.

## P0 — 진행 전 차단 항목

- [x] 기존 음악 API/DB를 유지하고 사전 MVP를 동일 앱에 추가
- [ ] EC2, HP t620, DS218j의 실제 상태를 운영자 승인 하에 read-only 조사하거나 UNVERIFIED로 승인
- [ ] Production 콘텐츠 사용 방식과 상업 이용 의도 확정
- [ ] 외부 사전별 라이선스·attribution·파생/재배포 요건 확인
- [ ] Admin 접근 방식, 인증/MFA, 운영 역할 승인
- [ ] PROD DB, 비용 한도, RPO/RTO, backup 복구 책임자 결정
- [ ] 운영 DB/서비스를 변경하지 않고 DB 현재 schema·용량·Migration 상태 확보

## P1 — MVP 전에 필요

- [ ] Phase 1 architecture / trust boundary / environment decision 승인
- [x] `src/dictionary/` module 경계 및 기존 route compatibility 유지
- [x] 5개 언어, NFC·소문자 접두사 검색 및 Unicode variant 테스트 범위 구현
- [ ] Lexeme/Sense/Concept/Character/provenance/publication ERD와 versioning policy review
- [x] 수동 source license/attribution 등록과 공개 응답 구현 (외부 라이선스 법적 검토는 미완료)
- [x] 기존 admin 역할·인가와 사전 변경 감사 기록 구현
- [ ] Migration 계정과 runtime DB 계정 분리 계획
- [x] 격리 MariaDB E2E, Unicode fixtures, dictionary OpenAPI 계약 테스트 추가
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

