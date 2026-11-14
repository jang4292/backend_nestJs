# 구현 전 시스템 현황 (AS-IS)

> 최신화 기준: 2026-11-14 · develop `a38e885`
> 범위: 저장소에서 읽을 수 있는 소스·설정·문서와 현재 개발 PC에서 확인한 런타임만. 운영 서버, NAS, Mini PC에는 접속하거나 변경하지 않았습니다.
> 이 문서는 dictionary MVP 구현 **이전**의 조사 기록입니다. 현재 구현은 [사전 API](../api/API_SPEC.md)와 [ERD](../database/ERD.md)를 참고하십시오.

## 1. 요약

| 항목 | 확인된 현황 | 근거 |
|---|---|---|
| 프로젝트 종류 | 단일 NestJS 백엔드 애플리케이션. 프런트엔드 앱이나 사전 도메인은 저장소에 없음 | `package.json`, `src/` |
| 실제 제품 | 사용자 인증, 프로필, 음악 카탈로그 및 기존 음악 API | [README.md](../../README.md), [제품 개요](../product/overview.kr.md) |
| 언어·런타임 | TypeScript; `.nvmrc`는 Node 24, `engines.node`는 `>=22.13`; 현재 개발 셸은 Node 24.14.1 / npm 11.19.0 | `package.json`, `.nvmrc` |
| 프레임워크 | NestJS 11, Express 5, TypeORM 0.3, MariaDB 드라이버 `mysql2` | `package.json`, `package-lock.json` |
| 데이터베이스 | MariaDB 사용 코드와 버전형 Migration 존재. CI는 MariaDB 10.11 사용. 운영 DB의 실제 버전·주소·데이터 상태는 미확인 | `.github/workflows/ci.yml`, `src/database/` |
| 인증·인가 | 로컬 로그인/JWT, `users.role` 기반 최소 RBAC. 5개 SNS 모듈은 구현되어 있으나 기본 비활성 | `src/auth/`, `src/users/`, `docs/product/features.kr.md` |
| 배포 정의 | PM2 설정, systemd 예시, EC2 배포 문서가 있음. 실제 EC2 서비스 상태·Nginx 설정은 미확인 | `ecosystem.config.cjs`, `deploy/`, `docs/deployment/` |
| CI | lint, format, typecheck, unit test, build, 중요도 critical npm audit, MariaDB 10.11 Migration 및 E2E 검증 | `.github/workflows/ci.yml` |

**핵심 차이:** 첨부된 목표인 다국어 사전·학습 플랫폼은 현재 저장소의 제품 목적 및 코드에 반영되어 있지 않습니다. 현재 음악 서비스의 대체·폐기 승인은 주어지지 않았으므로 이 문서는 음악 기능을 제거하거나 기존 Migration을 수정하는 것을 전제로 하지 않습니다.

## 2. 프로젝트 구조와 계층

현재 `src/`는 NestJS 단일 앱이며 기능 모듈별 경계를 둡니다.

```text
src/
  main.ts                  부트스트랩: Helmet, CORS, ValidationPipe, Swagger, graceful shutdown
  app.module.ts            전역 설정, DB, rate-limit, 공통 filter/interceptor/guard, 기능 모듈 등록
  config/                  환경 파일 선택 및 기동 전 환경변수 검증
  common/                  응답·오류·요청 ID·인증 공통 기능
  database/                TypeORM 옵션, CLI, 보호된 DB 점검 도구, Migration
  auth/                    local/JWT, SNS provider별 application/domain/adapter/interface
  users/                   사용자 도메인, use case, port/adapter, controller
  music/                   Legacy 음악 API와 Catalog API
scripts/                   env 및 TypeORM 명령 보조
test/                      MariaDB 기반 E2E 설정
deploy/                    systemd unit 예시
```

`users/`와 일부 `auth/`는 `domain → application(use-case/port) → infrastructure(adapter) → interface(controller/DTO)` 형태를 따릅니다. Catalog API는 `CatalogMusicService`를 중심으로 한 모듈이며 Legacy API는 서비스/use-case/repository port 구조를 갖습니다. 이를 근거로 전면 재작성보다 신규 도메인을 별도 Nest 모듈로 추가하는 방식이 현 구조에 가장 가까운 선택입니다.

현재 Controller 경로 데코레이터는 55개입니다(정적 검색 기준). 기존 문서의 API 목록은 [API 명세](../product/api-spec.kr.md)를 참고하십시오. 이 개수는 배포 환경에서 응답 확인한 값이 아닙니다.

## 3. 현재 데이터 모델

현재 TypeORM Entity 및 Migration은 다음 중심입니다. 세부 현재 스키마는 소스 Migration이 기준이며, ERD 요약은 [음악 아키텍처](../music/architecture.kr.md)에 있습니다.

| 그룹 | 엔터티/테이블 | 주요 관계 |
|---|---|---|
| 사용자 | `users` | `social_accounts` 1:N; role은 `user/admin`, 세션 무효화 버전 보유 |
| SNS 로그인 | `social_accounts` | `users` N:1; `(provider, providerUserId)` unique |
| Legacy 음악 | `legacy_artist`, `legacy_track`, `legacy_playlist`, `legacy_playlist_track` | Artist→Track; Playlist/Track 관계 테이블 |
| Catalog 음악 | `track`, `audio_asset`, `playlist`, `playlist_track` | Track→AudioAsset; Playlist/Track 관계 테이블 |

**사전 데이터는 없음:** `languages`, `lexemes`, `senses`, `concepts`, 한자/문자, source attribution, study/review, publication 또는 import staging 엔터티가 발견되지 않았습니다.

## 4. 환경·배포·보안에서 확인한 것

- 문서상의 LOCAL은 개발 PC에서 앱을 실행하고 공유 DEV MariaDB를 연결하는 구성입니다. 첨부 요청의 “로컬 DB 기본”과 다르므로 목표 구성을 [환경 문서](ENVIRONMENTS.md)에서 별도로 제안합니다.
- 문서는 PROD를 EC2의 localhost MariaDB + PM2로 설명하며 systemd는 대안으로 설명합니다. 이 설정이 현재 운영 서버와 일치하는지는 **UNVERIFIED**입니다.
- `.env.example`, `.env.production.example`, `.env.test.example` 템플릿과 환경 검증 코드가 있습니다. 실제 `.env` 파일은 민감할 수 있으므로 읽거나 내용을 기록하지 않았습니다.
- Migration은 앱 시작 때 자동 실행하지 않으며, 명시적인 명령으로 적용합니다. `DB_SYNCHRONIZE=true`는 거부됩니다.
- Nginx 설정 파일, 실제 DNS/TLS, EC2 Security Group, 방화벽, DB bind address, DB 계정 권한, 백업 스케줄·복원 결과는 이 저장소만으로 확인할 수 없습니다.
- Admin 접근을 VPN/Zero Trust로 제한하는 인프라 설정 및 별도 Admin UI는 확인되지 않았습니다.
- 저장소에 Dockerfile/Compose 설정은 없습니다. NAS의 컨테이너 지원을 추정하지 않습니다.

## 5. 확인하지 않은 장비·운영 항목

| 항목 | 상태 | 확인이 필요한 증거 |
|---|---|---|
| EC2 인스턴스 유형, CPU/RAM, 디스크, 가용 영역 및 비용 | **UNVERIFIED** | AWS 콘솔/CLI 조회 권한 |
| EC2 OS 및 실행 중 서비스·포트·Nginx·PM2 | **UNVERIFIED** | 운영자 동행 read-only 명령 |
| MariaDB 운영 버전·용량·권한·TLS·백업·복구 | **UNVERIFIED** | 승인된 DB read-only 계정 및 백업/복원 기록 |
| HP t620의 RAM·스토리지 여유·가동률·네트워크·전원 | **UNVERIFIED** | 로컬 콘솔 또는 SSH read-only 점검 |
| Synology DS218j의 실제 볼륨 여유·상태·스케줄·원격 접근 | **UNVERIFIED** | DSM 관리자 read-only 확인 |
| GitHub 보호 규칙, Actions secrets, Dependabot 적용 상태 | 코드로 확인 불가 | Repository 설정 화면/권한 |
| 실제 데이터 보유량과 콘텐츠 라이선스 | **UNVERIFIED** | DB 스키마·원본 레지스터·데이터 담당자 |

## 6. 조사 범위 및 안전

이 감사는 소스·추적 설정·문서를 읽고 개발 PC의 Node/npm 버전을 확인했습니다. 실제 서버에 SSH 접속하지 않았고, 운영 DB 접속·쓰기, 환경 시크릿 출력, 패키지 설치/업그레이드, Migration, 배포, 파일 삭제를 수행하지 않았습니다. 상태가 필요한 외부 시스템은 모두 `UNVERIFIED`로 남겼습니다.

