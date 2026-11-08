# DB·스키마 관리 학습 가이드: 생성, migration, 검증

> 최신화 기준: 2026-11-09 · develop `9b731ef` + `chore/project-audit-2026-11`
> 실행 절차(명령 순서, SQL)는 [환경별 DB·설정 가이드](../deployment/database-environments.kr.md)에 있습니다. 이 문서는 **왜 그렇게 하는지**를 설명합니다.

## 1. 학습 목표

이 문서를 읽고 나면 다음 질문에 답할 수 있어야 합니다.

- 데이터베이스와 테이블은 각각 누가, 언제 만드는가?
- Test에서 동작하던 스키마가 Dev나 Prod에 없으면 어떻게 반영하는가?
- 직접 SQL로 만들기, 명령으로 실행하기, 앱 기동 시 자동 실행하기는 무엇이 다른가?
- 스키마 변경이 안전한지 어떤 단계에서 무엇으로 검증하는가?
- 배포 후 문제가 생기면 어떻게 되돌리는가?

## 2. 용어

| 용어 | 뜻 | 이 프로젝트에서 |
| --- | --- | --- |
| DB 서버 | MariaDB 프로세스 하나(host:port) | Dev/Test는 외부 개발 서버, Prod는 EC2 localhost |
| 데이터베이스(스키마) | 테이블을 담는 이름 공간. MariaDB에서는 `DATABASE`와 `SCHEMA`가 같은 말 | `app_db`, `app_db_test`, 운영 DB |
| 계정·권한 | `'user'@'host'`와 `GRANT` | 앱 계정은 자기 DB에만 권한 |
| 테이블·컬럼·인덱스 | 실제 데이터 구조 | migration 파일로만 변경 |
| migration | 스키마를 한 단계 바꾸는 코드(`up`/`down`) | `src/database/migrations/*.ts` |
| `migrations` 테이블 | 어떤 migration이 적용됐는지 TypeORM이 기록하는 테이블 | 각 DB 안에 자동 생성 |
| pending | 코드에는 있지만 그 DB에 아직 적용되지 않은 migration | `db:check`, `migration:show`로 확인 |
| drift | entity(코드)와 실제 DB 스키마가 어긋난 상태 | `migration:check:test`로 검사 |
| `synchronize` | entity를 보고 TypeORM이 스키마를 자동으로 맞추는 기능 | **항상 false**(운영에서는 검증에서 거부) |

핵심은 **"그릇(데이터베이스·계정)"과 "내용(테이블 구조)"을 다르게 다룬다**는 점입니다.

- 그릇은 환경마다 한 번 준비하면 거의 바뀌지 않습니다. 이 일을 **프로비저닝**이라고 합니다.
- 내용은 코드와 함께 계속 바뀝니다. 그래서 코드처럼 버전을 관리하는 **migration**으로 다룹니다.

## 3. 무엇을 누가 만드나

| 대상 | Dev | Test | Prod |
| --- | --- | --- | --- |
| DB 서버 | 개발 서버 관리자 | 개발 서버 관리자 | EC2 MariaDB 설치(1회) |
| 데이터베이스 | `npm run db:setup`(없으면 생성) | `db:setup:test` / `db:reset:test` | **관리자 SQL**(1회) |
| 계정·권한 | 관리자 SQL(1회) | 관리자 SQL(1회) | 관리자 SQL(1회), `'<app>'@'localhost'` |
| 테이블·컬럼 | `migration:run` | `migration:run:test` | `migration:run:prod`(배포 단계) |
| 데이터(admin 지정 등) | 필요 시 SQL | 테스트가 직접 생성 | 배포 체크리스트의 수동 단계 |

Prod에서는 앱이 데이터베이스를 만들지 않습니다. `db:ensure`가 운영에서 거부되는 이유이기도 합니다.

- **최소 권한 원칙:** 앱 계정이 `CREATE DATABASE`나 `DROP DATABASE`를 할 수 있으면, 계정이 유출되거나 코드 실수가 있을 때 피해가 커집니다.
- **운영 DB는 백업, 문자셋, 계정 정책과 함께 한 번에 설계합니다.** 그래서 앱이 아니라 관리자가 만듭니다.

## 4. 적용 방식 비교: 직접 SQL / 명령 / 기동 시 자동

| | 직접 SQL로 생성 | 명령으로 migration 실행 (**이 프로젝트**) | 앱 기동 시 자동 실행 |
| --- | --- | --- | --- |
| 예 | 콘솔에서 `CREATE TABLE …` | `npm run migration:run:prod` | TypeORM `migrationsRun: true`, Spring Boot + Flyway 기본값 |
| 재현성 | 낮음: 환경마다 손으로 반복하므로 빠뜨리거나 오타가 생김 | 높음: 같은 파일을 같은 순서로 적용 | 높음 |
| 이력 | 없음: 누가 언제 무엇을 했는지 모름 | `migrations` 테이블과 Git | 같음 |
| 실패 시 | 중간 상태로 남기 쉬움 | **배포를 멈추고** 앱은 이전 버전 그대로 | 앱이 기동하지 못함. PM2가 재시작을 반복 |
| 여러 인스턴스 | 해당 없음 | 한 번만 실행 | 동시에 실행될 수 있음. TypeORM에는 실행 잠금이 없음 |
| 오래 걸리는 변경 | 해당 없음 | 별도 단계로 시간 확보 | 기동과 health check 지연 |
| 쓰는 곳 | 긴급 조치(이후 반드시 migration으로 기록) | 공유 Dev, Prod 배포 | 로컬 전용 DB, 잠금을 지원하는 도구 |

정리하면 다음과 같습니다.

- **스키마는 직접 SQL로 바꾸지 않습니다.** 긴급하게 손으로 고쳤다면 같은 내용을 migration으로 남겨 다른 환경도 같은 상태가 되게 합니다.
- **자동 실행 자체가 틀린 것은 아닙니다.** Spring Boot는 기동 시 Flyway를 실행하는 것이 기본입니다. 다만 다음과 같은 이유로 이 프로젝트는 명령 방식을 택했습니다.
  - PM2 단일 프로세스에서 migration이 실패하면 서비스 전체가 재시작을 반복합니다.
  - TypeORM에는 여러 인스턴스 사이의 실행 잠금이 없습니다.
  - 공유 Dev DB가 누군가의 `start:dev`만으로 바뀌면 안 됩니다.
- **업계에서 흔한 구성**은 "개발 편의 명령"과 "배포용 명령"을 나누는 것입니다.

  | 도구 | 개발 편의 | 배포용 |
  | --- | --- | --- |
  | Prisma | `migrate dev` | `migrate deploy` |
  | Rails | `db:setup` | `db:migrate` |
  | 이 프로젝트 | `db:setup`, `db:reset:test` | `migration:run:prod` |

- 대신 **앱은 기동할 때 적용되지 않은 migration이 있으면 경고만 합니다**(`MigrationStatusService`). 자동으로 고치지는 않지만, 배포 단계를 빠뜨렸다는 것은 바로 알 수 있습니다.

## 5. "Test에서 되던 것이 Dev/Prod에 없으면?"

예: `users.role` 컬럼을 추가한 `AddRoleToUsers1765000000000`

```text
개발자 PC                CI(빈 MariaDB)              Test DB           Dev DB             Prod DB
─────────                ──────────────              ───────           ──────             ───────
entity 수정
migration 생성·리뷰  ─▶  전체 체인 실행               db:setup:test     db:check           백업
커밋 / PR                pending 없음 확인            test:e2e          migration:run      migration:show:prod
                         최신 revert → 재적용                           start:dev          migration:run:prod
                         drift 검사, e2e                                                   pm2:reload → 스모크
```

1. **코드를 바꾸면 migration도 같이 만듭니다.** entity를 바꾸고 `npm run migration:generate -- src/database/migrations/<Name>`으로 초안을 만든 뒤, 생성된 SQL을 직접 읽고 다듬습니다. 자동 생성 결과를 그대로 믿지 않습니다.
2. **CI가 빈 DB에서 처음부터 끝까지 적용해 봅니다.** "기존 DB에서는 우연히 되는" 변경을 걸러냅니다.
3. **Test DB**에서 e2e로 실제 서버 버전과 설정에서 동작을 확인합니다.
4. **Dev DB**는 이미 데이터가 있는 DB입니다. 여기서 기존 데이터 위에 적용되는지 확인합니다(예: NOT NULL 컬럼 추가에 default가 필요한지).
5. **Prod**는 배포 단계에서 명령으로 적용합니다. 순서는 **백업 → 적용 대기 목록 확인 → 적용 → 앱 재시작 → 스모크**입니다.

어느 환경에 migration이 없는지는 그 환경에서 `db:check`(또는 `migration:show`)를 실행하면 `[ ]`로 표시됩니다. "직접 만들어야 하나?"에 대한 답은 **아니요, 그 환경에서 같은 migration 명령을 실행합니다**입니다.

데이터베이스 자체가 없을 때는 환경마다 다르게 처리합니다.
- Dev/Test: `db:setup`이 만듭니다.
- Prod: 관리자 SQL로 만듭니다.

## 6. 하위 호환 변경: expand → contract

배포 중에는 잠깐이라도 **새 스키마와 이전 코드**가 함께 돌아갑니다. migration을 먼저 적용하고 앱을 나중에 재시작하기 때문입니다. 그래서 한 번의 배포에서는 이전 코드가 깨지지 않는 변경만 합니다.

| 하고 싶은 변경 | 안전한 순서 |
| --- | --- |
| 컬럼 추가 | NULL 허용이나 default를 두고 추가합니다(이번 `role`은 `default 'user'`) |
| 컬럼 삭제 | 1) 코드에서 사용을 제거하고 배포 → 2) 다음 릴리스에서 migration으로 삭제 |
| 컬럼 이름 변경 | 1) 새 컬럼 추가와 데이터 복사 → 2) 코드 전환 → 3) 이전 컬럼 삭제 |
| NOT NULL로 강화 | 1) 기존 NULL 데이터 보정 → 2) 제약 추가 |
| 큰 테이블 인덱스 | 트래픽이 적은 시간에 별도 배포로, 소요 시간을 미리 측정 |

## 7. 검증 계층: 어디서 무엇을 증명하나

| 단계 | 명령 | 증명하는 것 |
| --- | --- | --- |
| 단위 테스트 | `npx jest` | 로직(예: `database-admin.spec.ts`의 생성·거부 규칙) |
| CI `database` job | `db:reset:test` → `db:check:test -- --strict` → `migration:revert:test` + `migration:run:test` → `migration:check:test` → `test:e2e` | 빈 DB에서 전체 체인이 적용되는지, 최신 migration의 down/up, entity와 migration 일치(drift), 앱 기동 |
| Test DB | `db:setup:test`, `test:e2e` | 실제 개발 서버 버전과 설정에서 동작 |
| Dev DB | `db:check` → `migration:run` | 기존 데이터 위에서 적용 |
| Prod 배포 | `env:check:prod` → `db:check:prod` → 백업 → `migration:show:prod` → `migration:run:prod` → `/health` | 운영 적용과 서비스 정상 |
| 앱 기동 | `MigrationStatusService` 로그 | 적용 누락 감지(경고만) |

`db:check`는 읽기 전용입니다. 계정 권한(`SHOW GRANTS`)과 TLS 사용 여부도 보여 주므로, 접속 문제와 권한 문제를 가장 먼저 확인하는 도구로 씁니다.

## 8. 실패와 롤백

- **migration 실패:** 배포를 멈춥니다. 앱은 아직 재시작하지 않았으므로 이전 버전이 계속 동작합니다. 원인을 고친 뒤 다시 실행합니다.
- **revert:** `migration:revert`는 마지막 migration 하나의 `down`을 실행합니다. 모든 migration이 되돌릴 수 있는 것은 아닙니다.
  - `ArchiveLegacyMusicSchema`: `down`이 의도적으로 실패합니다(이름 변경 복구는 백업으로).
  - `RepairLegacyMariaDbSchema`: `down`이 아무것도 하지 않습니다(데이터 손실 방지).
- **그래서 운영 migration 전에는 반드시 백업합니다**(`mysqldump --single-transaction`). 최종 복구 수단은 revert가 아니라 백업입니다.
- 빈 DB에서 전체 체인을 실행하면 초기 migration이 만든 음악 테이블이 `ArchiveLegacyMusicSchema`에서 `legacy_*`로 이름이 바뀝니다. 그래서 새 DB에도 빈 `legacy_*` 테이블이 생깁니다. 이는 정상입니다.

## 8.1 사례: CI가 처음 잡아낸 문제 (2026-11-08)

빈 MariaDB에서 전체 체인을 처음 실행하자, 그동안 기존 DB에서는 드러나지 않던 문제 두 가지가 나왔습니다. "빈 DB에서 처음부터 실행해 보기"가 왜 필요한지 보여 주는 사례입니다.

**1) 드라이버가 지원하지 않는 API**

- 오류: `AddUniqueEmailToUsers1761000000000` → `MySql does not support unique constraints. Use unique index instead.`
- **원인:** MariaDB/MySQL에서 UNIQUE는 unique index로 구현됩니다. TypeORM MySQL 드라이버는 `createUniqueConstraint`·`dropUniqueConstraint`를 지원하지 않습니다. 이 migration들은 PostgreSQL 시절에 작성됐습니다.
  - 기존 개발 DB에서는 적용 이력만 기록되어 있어서 이 코드가 실행된 적이 없었습니다.
  - 새 개발 서버처럼 **빈 DB에 `db:setup`을 하면 바로 실패했을 문제**입니다.
- **조치:** `TableIndex({ isUnique: true })`로 같은 이름의 unique index를 만들도록 1761과 1762를 고쳤습니다.
- **이미 적용된 migration을 고쳐도 되는가?**
  - 원칙은 "고치지 않는다"입니다.
  - 예외로, **대상 DB에서 아예 실행될 수 없는 migration**은 결과 스키마가 같게 고칩니다. 이미 기록된 DB는 다시 실행하지 않으므로 영향이 없습니다.

**2) drift: entity와 migration 결과의 차이**

`migration:check:test`가 다음 차이를 보고했습니다(감사 리포트 DB-12).

| 종류 | migration 결과 | entity가 기대하는 것 |
| --- | --- | --- |
| FK·인덱스 이름 | `FK_track_artist`, `UQ_users_email` 등 명시적 이름 | 이름을 선언하지 않아 TypeORM 해시 이름(`FK_2014e…`, `IDX_97672…`) |
| 시간 컬럼 정밀도 | `datetime`(초 단위) | `@CreateDateColumn` 기본값 `datetime(6)` |
| entity에 없는 인덱스 | `IDX_playlist_track_trackId` 등 | 선언 없음 → 삭제 대상으로 보임 |
| 문자셋·타입 표기 | `legacy_artist.name` collation, `tinyint(1)` | 선언 없음 |

데이터나 기능 문제는 아니지만, 이 상태에서 `migration:generate`를 실행하면 의도하지 않은 변경(FK 재생성, 인덱스 삭제)이 섞인 초안이 만들어집니다. 해결 방향은 둘 중 하나입니다.

- **코드를 DB에 맞춤(권장):** entity에 이름과 정밀도를 선언합니다. 예: `@Index('IDX_…')`, `@JoinColumn({ foreignKeyConstraintName })`, `precision: 0`. DB 변경이 없습니다.
- **DB를 코드에 맞춤:** 보정 migration을 만듭니다. 운영 DDL이 필요합니다.

결정하기 전까지 CI의 drift 단계는 보고만 합니다(`continue-on-error`).

## 9. 이 프로젝트의 구현

| 역할 | 코드 |
| --- | --- |
| 환경별 env 파일 선택 | [src/config/env-files.ts](../../src/config/env-files.ts) |
| 환경변수 검증(test는 `*_test`만) | [src/config/app-env.ts](../../src/config/app-env.ts) |
| TypeORM 옵션, migration 경로, TLS | [src/database/database-options.ts](../../src/database/database-options.ts) |
| migration CLI용 data-source | [src/database/data-source.ts](../../src/database/data-source.ts) |
| DB 확인·생성·초기화 로직 | [src/database/database-admin.ts](../../src/database/database-admin.ts) |
| `db:check` / `db:ensure` / `db:reset` CLI | [src/database/cli/db-tool.ts](../../src/database/cli/db-tool.ts) |
| 환경별 실행 래퍼(`--dist` 포함) | [scripts/typeorm-env.cjs](../../scripts/typeorm-env.cjs) |
| 기동 시 pending 경고 | [src/database/migration-status.service.ts](../../src/database/migration-status.service.ts) |
| CI 검증 job | [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `database` |
| migration 파일 | [src/database/migrations/](../../src/database/migrations/) |

설계 포인트:

- **DB를 지정하지 않고 접속합니다.** `db-tool`은 서버에만 연결합니다. 대상 DB가 아직 없어도 확인하고 만들 수 있게 하기 위해서입니다.
- **허용되지 않는 명령은 연결 전에 거부합니다.** prod의 `ensure`, test가 아닌 환경의 `reset`이 해당합니다.
- **DB 이름은 영문, 숫자, `_`만 허용합니다.** 식별자는 SQL 파라미터로 바인딩할 수 없어 백틱으로 직접 넣기 때문입니다.
- **비밀번호는 어디에도 출력하지 않습니다.** `SHOW GRANTS`의 해시도 가립니다.
- **같은 규칙을 한 곳에서 씁니다.** 앱, migration CLI, `db-tool`, e2e가 같은 env 파일 규칙과 같은 검증(`validateAppEnv`)을 씁니다.

## 10. 결정 기록 (2026-11-08)

| 결정 | 이유 |
| --- | --- |
| Dev(`app_db`)와 Test(`app_db_test`)를 같은 외부 개발 서버에 두고, 같은 개발 계정을 사용 | 서버가 하나입니다. 데이터베이스 이름 규칙(`*_test`)으로 e2e가 개발 데이터를 바꾸지 못하게 합니다 |
| 데이터베이스와 테이블은 명령으로 생성(`db:setup`), 기동 시 자동 실행은 하지 않음 | 4장의 실패, 재시작 반복, 공유 DB 문제 |
| 비밀번호는 각 env 파일(`.env`, `.env.test.local`)에 직접 입력 | Git 미추적 파일, 권한 `600`. 채팅·문서·커밋에 남기지 않음 |
| 개발 서버는 TLS 미지원. `DB_SSL=false`를 유지하고 접근을 IP로 제한하거나 SSH 터널 사용 | 인터넷 구간에서 계정 정보가 평문으로 오가므로 노출 범위를 줄입니다 |
| CI에 MariaDB 10.11 job 추가 | 실제 MariaDB에서 migration 전체 체인을 검증한 적이 없었습니다(감사 미검증 항목) |

## 11. 자가 점검 질문

1. 운영에서 `db:ensure`를 막은 이유는 무엇인가? 앱 계정에 어떤 권한이 있으면 위험한가?
2. `synchronize: true`를 운영에서 쓰면 어떤 일이 생길 수 있는가? 컬럼 이름 변경을 예로 설명해 보라.
3. CI에서 빈 DB 전체 실행과 drift 검사는 각각 어떤 실수를 잡는가?
4. 컬럼을 삭제하는 변경을 한 번의 배포로 하면 배포 도중 어떤 오류가 날 수 있는가?
5. `migration:revert`로 되돌릴 수 없는 migration이 있을 때 운영 복구 수단은 무엇인가?
6. 앱 기동 시 pending migration을 발견했을 때 자동 적용 대신 경고만 하는 이유는?

## 12. 실습 과제

1. `npm run db:check`의 출력에서 서버 버전, TLS, 권한, pending 목록을 읽어 보세요.
2. `npm run db:reset:test` 후 `npm run db:check:test`로 빈 DB에서 전체 체인이 적용되는 것을 확인하세요.
3. `users`에 NULL 허용 컬럼을 추가하는 entity 변경을 하고, `migration:generate`로 초안을 만들어 SQL을 리뷰하세요. 실습 후에는 되돌립니다.
4. 3번을 커밋하지 않은 상태에서 `npm run migration:check:test`를 실행해 drift가 어떻게 보고되는지 확인하세요.
5. `migration:revert:test`로 마지막 migration을 되돌리고, 앱 기동 로그에 pending 경고가 나오는지 확인한 뒤 다시 적용하세요.
