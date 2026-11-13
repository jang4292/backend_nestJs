# Music API 결정 및 후속 작업

> 검토 기준일: 2026-11-13 · 현재 코드와 Music 문서 및 최신 감사 로드맵 대조

이 문서는 현재 구현 상태, 사용자가 확정한 목표 정책, 구현 전에 정리할 세부 설계·검증 항목을 구분합니다. 목표 정책이 코드에 이미 반영되었다고 오해하지 않도록 상태를 분리해 기록합니다.

## 1. 현재 구현 상태

- 운영 DB는 MariaDB이며 `DB_TYPE=mariadb`만 지원합니다. DB 생성과 migration은 애플리케이션 시작과 분리하고, `DB_SYNCHRONIZE=false`를 유지합니다.
- Artist/Track/Playlist 쓰기는 `admin` 역할만 가능합니다. 현재 Music 데이터는 운영자가 관리하는 전역 카탈로그이며 사용자별 Playlist 소유권은 구현되어 있지 않습니다.
- Legacy(`legacy_*`, `/music/legacy/*`)와 Catalog(`/music/*`, `/music/public/*`)가 현재 공존합니다. Catalog에는 별도 테이블과 API가 있지만, Legacy 종료와 데이터 이관은 아직 구현되지 않았습니다.
- Catalog의 Track과 AudioAsset은 1:N입니다. `Track.bpm`과 `AudioAsset.bpm`은 별도 의미를 가지며 자동 동기화하지 않습니다.
- Catalog Playlist 상태는 `draft`, `published`, `archived`입니다. 공개 조회는 `published`만 대상으로 합니다.
- Catalog Playlist에는 현재 `position` 하나만 있어 실제 재생 순서로 사용합니다. `(playlistId, position)` DB 유일 제약이 있습니다. 순서 변경은 transaction을 사용하지만, 항목 조회는 transaction 밖에서 이루어지고 재정렬 항목 수 제한은 없습니다(4장 참조).
- 공개 Playlist 응답은 presenter를 통과하며 AudioAsset URL과 내부 저장소 정보를 포함하지 않습니다.
- AudioAsset은 현재 메타데이터 단계입니다. 실제 파일 업로드·삭제와 재생 URL 발급은 구현 범위에 포함되지 않습니다.
- MariaDB FK 참조 오류는 409 `FOREIGN_KEY_CONSTRAINT`로 변환합니다. 기존 migration 파일은 수정하지 않고 schema 변경은 새 migration으로 추가합니다.

## 2. 사용자가 확정한 목표 정책 (2026-11-13)

### 2.1 Catalog 단일 기준, Legacy 종료

Catalog를 Music 데이터의 단일 기준으로 사용합니다. Legacy 기능과 API는 종료하고 사용하지 않습니다. 기존 Legacy 데이터는 Catalog로 이관·검증한 뒤 Legacy API를 비활성화하며, Legacy 테이블은 복구·감사 가능한 불변 snapshot으로 보존하는 방향입니다. 아직 이관·비활성화 코드는 구현되지 않았습니다.

### 2.2 날짜 및 동일 Track 중복

- 특정 날짜의 Playlist 수에는 제한을 두지 않습니다. `playDate` unique 제약은 추가하지 않으며, 날짜 조회 API는 복수 결과를 처리해야 합니다.
- 한 Playlist 안에서 같은 Track을 여러 번 포함할 수 있습니다. `(playlistId, trackId)` unique 제약을 추가하지 않습니다.

### 2.3 관리 순서와 재생 순서 분리

Playlist 항목의 **관리/표시 순서**와 **실제 재생 순서**는 별도 값으로 기록합니다. 현재 Catalog의 `position` 하나만 사용하는 구현은 목표와 다르므로, 필드와 API 계약을 보완해야 합니다.

### 2.4 Soft delete와 완전 삭제

활성 Catalog 데이터는 soft delete를 사용합니다. Playlist 항목을 포함해 Catalog 레코드를 삭제할 때는 복구 가능한 상태로 남기고, 완전 삭제는 별도의 관리자 처리로 분리합니다. Legacy 테이블은 이관 후 불변 snapshot으로 보존하며 일반 삭제 대상에 포함하지 않습니다. 삭제·복구·완전 삭제 이력과 접근 통제를 구현해야 하며, 아직 코드에는 반영되지 않았습니다.

### 2.5 Playlist 상태 전이

Playlist 공개 상태와 soft delete는 서로 독립된 상태로 관리합니다. 기본 전이는 `draft → published → archived`이며, 보관된 Playlist는 `draft`로 복원한 뒤 다시 공개할 수 있습니다. `publishedAt`은 publish가 일어난 시각으로 기록·갱신하는 방향입니다.

### 2.6 재생 접근 정책

`published`는 Playlist 메타데이터 공개를 뜻하며, 음원 재생 허용과는 분리합니다. `anonymousPlayable=true`인 공개 Playlist의 활성 음원만 익명 재생을 허용하고, 그 외 재생에는 인증을 요구합니다. 저장 URL을 공개 응답에 직접 노출하지 않고 짧은 만료 시간의 URL 발급 방식으로 제공하는 방향입니다.

## 3. 구현 전에 구체화할 세부 기준

사용자가 확정한 정책은 목표 기준입니다. 다음 세부사항은 DB 제약, API, 데이터 이관을 구현하기 전에 명시해야 합니다.

### 3.1 Legacy 데이터 이관과 종료 절차

- Legacy Artist/Track/Playlist/PlaylistTrack을 Catalog 모델로 매핑하고 이관 전후 건수·관계·중복 데이터를 대조합니다.
- Legacy Track의 `artistId`는 Catalog의 artist 문자열로, Legacy PlaylistTrack의 `seq`는 재생 순서로 변환합니다. 관리 순서 값과 과거 ID를 보존할 방법도 정합니다.
- 이관 검증 후 Legacy API를 비활성화합니다. Legacy 테이블의 보존 기간과 최종 purge 시점은 별도로 승인합니다.

### 3.2 순서 필드와 API 의미

- 관리 순서와 재생 순서의 필드명, 초기값, append/reorder 규칙을 정합니다.
- 두 순서가 각각 단순 유일 값인지 연속 번호인지, 최대 Playlist 항목 수가 얼마인지 정합니다.
- 관리자 응답은 두 순서를 모두 제공하고, 공개 Playlist 응답은 재생 순서로만 정렬하는 것을 기본으로 합니다.
- API에서 각 순서를 별도로 변경할지, 별도 관리 순서 변경 경로가 필요한지 정합니다.
- soft-deleted 항목의 순서 유일성을 MariaDB에서 어떻게 보장할지 설계합니다. 기존 `(playlistId, position)` 제약은 soft delete 후에도 삭제 행을 포함하므로 그대로 둘 수 없습니다.

### 3.3 Soft delete 및 관리자 purge

- 삭제·복구 필터, 관리자 권한, 삭제자·사유 기록 여부를 확정합니다.
- 완전 삭제의 실행 조건, 승인·사유·감사 로그, 백업 확인, 데이터 보존 기간을 정의합니다. 자동 purge는 보존 정책이 확정되기 전까지 두지 않는 것을 권장합니다.
- Track/Playlist/AudioAsset 및 Playlist 항목을 복구하거나 완전 삭제할 때 FK와 음원 저장소 파일을 함께 처리하는 순서를 정합니다.

### 3.4 재생 URL과 AudioAsset 세부사항

Track 하나에 여러 AudioAsset을 둘 수 있지만 기본 재생 파일과 format/quality 선택 기준은 없습니다. 재생 기능 구현 전에 TTL, Range 요청, CORS, 오디오 파일 교체·삭제 시 URL 처리와 기본 Asset 선택 기준을 정합니다.

## 4. 남은 구현 및 검증 항목

### 우선순위 1: 데이터와 Playlist 변경 신뢰성

- Legacy 이관의 dry-run, 데이터 검증, cutover/rollback 절차를 마련한 후 Legacy 경로를 비활성화합니다.
- soft delete, 복구, 관리자 완전 삭제를 구현하고 DB FK, 조회 필터, 감사 이력을 검증합니다.
- 관리 순서와 재생 순서의 독립 변경을 transaction으로 처리하고 동시 수정 및 soft-deleted 순서 제약을 테스트합니다.
- 현재 재정렬의 transaction 밖 조회, 2N UPDATE, 항목 수 상한 부재를 함께 개선합니다.
- `draft → published → archived` 및 `archived → draft` 전이와 soft delete의 독립성을 테스트합니다.

### 우선순위 1: 공개 API 계약

- Catalog 기준 API의 페이지 응답, 검색·필터, 관리/재생 순서 필드, soft delete/복구 및 관리자 purge 계약을 OpenAPI와 예제에 반영합니다.
- `GET /music/tracks/:trackId/audio-assets`는 부모 Track 존재 여부를 먼저 확인하지 않아 없는 Track에도 빈 배열을 반환할 수 있습니다. 없는 Track은 404, 존재하지만 AudioAsset이 없는 Track은 빈 배열로 구분합니다.
- Catalog의 position 중복은 현재 400으로 처리하고 DB duplicate 오류도 같은 방식으로 변환합니다. 클라이언트 입력 오류와 동시성/DB 충돌의 400·409 구분을 정하고 일관되게 적용합니다.
- 성공 응답 DTO와 오류별 응답 schema를 명시하고 Swagger, 수동 API 명세, 예제를 동기화합니다.

### 우선순위 2: 구조·검색·DB 품질

- `CatalogMusicService`에서 Playlist·Track·AudioAsset의 책임을 분리하고, Legacy `MusicService` facade의 유지 여부를 정리합니다.
- Legacy 종료 후 불필요해진 controller, service, use-case, repository, Entity를 제거하거나 보관 대상으로 정리합니다.
- Legacy Track 검색은 `%`, `_`, `\`를 문자 그대로 처리하도록 이스케이프하지만, 앞뒤 와일드카드가 포함된 부분 검색은 일반 인덱스를 활용하기 어렵습니다. Catalog Track API는 현재 페이지·한도만 받고 검색/필터는 제공하지 않으므로, 필요한 검색 조건과 인덱스 전략을 먼저 정합니다.
- 공개 Playlist 목록은 `findAndCount`와 Playlist 항목 relation을 함께 조회합니다. 목록 건수 계산을 위해 전체 항목을 로드하지 않도록 count query를 분리하는 방안을 검토합니다.

### 운영·DB·미디어

- 실제 파일 업로드 전 MIME/크기 검증, 저장소 키 관리, DB와 파일 저장소 간 실패 보상 및 삭제 lifecycle을 설계합니다.
- DB entity와 migration 간 FK·index 이름, datetime 정밀도, collation 차이를 정리하고, drift 검사를 보고 전용에서 CI 필수 gate로 전환합니다.
- utf8mb4·timezone, 백업/복구, migration 실패 절차를 운영 DB에서 확인합니다.
- Migration 적용·이관 검증·MariaDB 통합/E2E 결과를 배포 승인 기준에 포함합니다.

## 5. 검토 근거와 상태 확인

- 재정렬, 상태 전이, AudioAsset 조회 및 응답 동작은 `src/music/catalog/catalog-music.service.ts`와 `src/music/catalog/interface/catalog-music.controller.ts`를 기준으로 확인합니다.
- Legacy와 Catalog의 삭제 동작은 `src/music/entities/playlist-track.entity.ts`와 `src/music/catalog/entities/catalog-playlist-track.entity.ts`를 비교합니다.
- 감사 로드맵의 DB-8, DB-9, DB-10, CA-3, CA-5, CA-6 및 Music API 관련 P1/P2 항목과 함께 갱신합니다: [2026-11-08 프로젝트 감사 로드맵](../audit/2026-11-08-project-audit.kr.md#6-로드맵).
- 2026-11-08 감사 DB-9의 `%`·`_` 검색 이스케이프 미비는 현재 Legacy repository 코드와 일치하지 않습니다. 이스케이프는 구현되어 있고, 부분 검색의 인덱스 한계와 Catalog 검색 미지원은 별도 잔여 항목입니다.
- Migration 적용 상태는 환경별로 다를 수 있으므로 `npm run migration:show`로 확인합니다. 과거 개발 DB의 적용 기록을 현재 운영 상태로 간주하지 않습니다.
