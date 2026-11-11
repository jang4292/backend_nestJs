# 서비스 개요 (기획)

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 이 문서는 **현재 코드에서 역으로 정리한 기획 문서**입니다. 확정된 제품 요구사항이 아니며,
> 결정이 필요한 항목은 [결정 문서](../music/decisions.md)와 [감사 로드맵](../audit/2026-11-08-project-audit.kr.md#6-로드맵)에 있습니다.

## 1. 한 줄 정의

모바일·웹 클라이언트를 위한 **인증과 음악 카탈로그 API 서버**입니다. 사용자는 로컬 계정이나 SNS 계정(Google, Apple, Kakao, Naver, Facebook)으로 로그인하고, 공개된 음악 플레이리스트와 트랙 정보를 조회합니다. 관리자는 카탈로그(트랙, 음원, 플레이리스트)를 관리하고 공개합니다.

## 2. 사용자 유형

| 유형 | 식별 | 할 수 있는 일 |
| --- | --- | --- |
| 비로그인 방문자 | 없음 | 공개 플레이리스트·트랙 메타데이터 조회, 회원가입, 로그인 |
| 일반 사용자(`user`) | JWT | 내 프로필 조회·수정(비밀번호 변경 포함), legacy 음악 데이터 조회 |
| 관리자(`admin`) | JWT + `users.role = 'admin'` | 카탈로그 트랙·음원·플레이리스트 생성, 수정, 삭제, 공개, 정렬. legacy 음악 데이터 쓰기 |

- 관리자 지정은 운영 DB에서 수동으로 합니다([배포 문서](../deployment/mariadb-systemd.kr.md)).
- 관리자 지정 API는 제공하지 않습니다.

## 3. 핵심 기능

1. **계정**
   - 로컬 가입(username, password, 선택 email·name)
   - username 또는 email로 로그인
   - 프로필 조회·수정
2. **SNS 로그인**
   - 5개 provider를 지원하며, provider마다 기능 플래그(`AUTH_*_ENABLED`)로 켜고 끕니다. **현재는 5종 모두 꺼져 있고 로컬 로그인만 운영합니다**([재활성화 체크리스트](../auth/sns-reenable-checklist.kr.md)).
   - 첫 로그인 시 계정이 자동 생성되고, 이후에는 같은 계정으로 연결됩니다.
   - 같은 email이라도 로컬 계정과 자동 병합하지 않습니다.
3. **음악 카탈로그(Catalog)**
   - Track은 제목, 아티스트명, BPM을 가집니다.
   - AudioAsset은 Track에 딸린 음원 파일 정보입니다(URL, 길이, 분석 BPM).
   - Playlist는 `draft` → `published` → `archived` 상태를 가지고, 항목은 `position` 순서로 정렬합니다.
   - 공개 API는 `published` 플레이리스트만, 음원 URL을 빼고 반환합니다.
4. **Legacy 음악 API**
   - 이전 Artist/Track/Playlist 모델을 `/music/legacy` 아래에 보존합니다.
   - 신규 기능은 Catalog에서만 개발합니다.
5. **운영 기능**
   - `/health`: DB 상태 포함, DB 장애 시 503
   - 요청 ID(`x-request-id`)
   - 공통 오류 envelope
   - rate limit

## 4. 범위 밖 (현재 미제공)

- refresh token, 로그아웃(토큰 폐기), 비밀번호 재설정 메일
- 음원 업로드(S3)와 재생용 서명 URL
- 사용자별 플레이리스트 소유권과 공유. 현재 플레이리스트는 관리자가 운영하는 전역 카탈로그입니다.
- 관리자 지정·권한 관리 API

## 5. 관련 문서

- [기능 명세](features.kr.md): 기능별 규칙과 정책
- [API 명세](api-spec.kr.md): 전체 라우트와 권한
- [API 사용 예시](../../API_EXAMPLES.md)
- [음악 아키텍처](../music/architecture.kr.md), [SNS 로그인 개요](../auth/sns-login-overview.kr.md)
