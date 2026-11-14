# 인증·권한·접근제어 설계

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 저장소의 기존 보안 현황은 [2026-11-09 보안 감사](../audit/2026-11-09-security-audit.kr.md)에 있습니다. 이 문서는 신규 사전/Admin 기능의 추가 통제 초안입니다.

## 1. Trust boundary

```text
Public Internet → Nginx TLS/WAF/rate limit → Live API → published read-only data
Admin VPN/Zero Trust → Nginx Admin allow-list → authenticated Admin API → editorial DB writes
Import Worker → authenticated upload/import staging → review/approval → publish
```

Admin network 정책은 앱 권한을 대체하지 않으며, 앱 RBAC도 network isolation을 대체하지 않습니다. MariaDB, Worker management port, backup store, admin endpoint를 직접 공개하지 않습니다.

## 2. 인증 및 권한

- 기존 JWT 구현 재사용 여부는 refresh/revocation/MFA 필요성을 점검한 후 결정합니다. 현재 password change 기반 sessionVersion은 확인되었지만, refresh token·로그아웃·MFA가 완비된 것으로 간주하지 않습니다.
- Live public dictionary reads는 공개 가능합니다. 사용자 study/history endpoint는 JWT 필수이며 소유자 검사를 use-case마다 수행합니다.
- Admin에서는 초기 `admin` 역할만 허용하고 body에서 role을 바꾸지 못하게 합니다. 다중 편집자 필요가 승인되면 `editor`, `reviewer`, `publisher`, `importer`, `admin`을 least privilege로 분리합니다.
- Admin account는 별도 가입 공개 route로 생성하지 않습니다. 첫 관리자 등록/복구는 승인된 break-glass 절차와 audit 기록을 둡니다.
- JWT는 환경별 signing key, 만료, audience/issuer 정책을 명시하고 key rotation/revocation 절차를 둡니다.

## 3. 관리자 변경과 감사

필수 감사 이벤트: create/update/delete, import/review/approve/reject, merge/split, publish/revoke, role/key/security setting 변경.

로그는 actor ID, 역할, entity type/ID, revision ID, request ID, timestamp(UTC), 변경 사유와 field-level diff reference를 포함합니다. password hash, JWT, OAuth token, secret, 전체 raw import body를 로그에 넣지 않습니다. 개인정보 보존기간·열람권한·삭제요청 절차는 법무/운영 결정이 필요합니다.

## 4. API·애플리케이션 통제

- DTO whitelist + reject unknown field, ID/locale/codepoint 검증, query/body size 상한.
- Parameterized DB query, 제한된 검색 query 길이/결과 수, 안정된 cursor, endpoint별 rate limit.
- CORS allow-list, Helmet, TLS, 정확한 `TRUST_PROXY`, generic 5xx envelope, request ID 기반 관측.
- Public read response는 draft, source raw payload, internal IDs, user PII, secret URL을 제외합니다.
- Import parser는 archive bomb/path traversal/oversize input을 방어하고, 파일 형식·크기·압축률·행수 제한을 둡니다. Worker는 sandboxed 비특권 계정으로 실행합니다.
- 외부 URL을 사용자/데이터가 지정하게 하지 않습니다. Source endpoint는 allow-list를 사용해 SSRF 위험을 피합니다.
- Unicode confusable/정규화는 검색/중복 검출용으로만 사용하고, 승인된 원본 표기를 자동으로 치환하지 않습니다.

## 5. 인프라·데이터 보안

- DB bind/listener 및 Security Group은 최소 범위; DB 계정은 환경·용도별 분리.
- DEV에는 PROD DB dump/secret 접근을 주지 않습니다. Test 데이터는 synthetic.
- backup은 암호화·versioning·별도 credential/MFA delete protection 검토.
- SSH key/MFA/계정 최소권한, Nginx/Admin access log 및 DB audit 범위, system update/patch ownership을 명시합니다.
- 공급망: lockfile, Dependabot, high/critical audit 처리, GitHub branch protection, secret scanning, dependency review, CodeQL 여부를 Repository 설정에서 확인합니다.

## 6. 미해결 보안 검증

운영 Security Group, 3306 public reachability, TLS cert renewal, SSH exposure, GitHub protection rules, secret manager IAM, 백업 접근/복호화 권한은 서버/Repository 설정 권한 없이는 **UNVERIFIED**입니다. 실제 접근 없이 “안전/차단됨”으로 보고하지 않습니다.

