# Music 원인 분석 및 트러블슈팅

문제를 해결할 때는 먼저 **route -> Entity -> table -> migration 상태**를 같은 기능 단위로 확인합니다.

## 1. `/music/tracks`가 예상과 다른 응답을 반환함

- 증상: Legacy 응답 또는 Catalog 응답이 예상과 다름
- 원인: 과거 두 controller가 같은 `/music/tracks` 경로를 사용했거나, route 변경 후 클라이언트가 이전 경로를 호출함
- 확인:

```bash
rg "Controller\('music|@Get\('tracks'" src/music
npm run migration:show
```

- 해결: Catalog는 `/music/*`, Legacy는 `/music/legacy/*`를 사용하고, API 예시의 경로를 일치시킵니다.

## 2. Entity가 `legacy_*` 테이블을 찾지 못함

- 증상: `Table '...legacy_track' doesn't exist`
- 원인: Legacy Entity가 archive된 테이블을 보도록 설정되어 있는데 Legacy archive Migration이 적용되지 않았거나, 다른 DB에 연결됨
- 확인:

```bash
npm run migration:show
```

MariaDB에서:

```sql
SHOW TABLES LIKE '%track%';
SHOW TABLES LIKE '%playlist%';
```

- 해결: 연결된 DB와 Migration 적용 상태를 확인합니다. 기존 Migration 파일을 임의로 수정하지 않습니다.

## 3. Catalog Entity와 테이블이 불일치함

- 증상: `track`, `audio_asset`, `playlist`, `playlist_track` 관련 metadata 또는 table 오류
- 원인: Entity 등록은 되었지만 Catalog Migration이 적용되지 않음
- 확인:

```bash
npm run migration:show
```

- 해결: 백업 후 명시적으로 `npm run migration:run`을 실행합니다. 현재 프로젝트에서는 2026-09-13 기준 Catalog Migration 3개가 적용된 상태입니다.

## 4. Playlist에 Track이 없거나 순서가 무작위임

- 증상: 상세 응답의 `tracks`가 비어 있거나 순서가 기대와 다름
- 원인: relation loading 누락 또는 position 정렬 누락
- 확인 대상:

- `CatalogPlaylist.playlistItems`
- `CatalogPlaylistTrack.track`
- `getPublicPlaylist()`의 relation 설정
- presenter의 position 정렬

- 예방: 공개 응답은 `toPublicPlaylistResponse()`를 통과시키고 position 오름차순으로 정렬합니다.

## 5. Playlist position unique 오류

- 증상: 같은 Playlist에 이미 사용 중인 position을 추가하거나 reorder할 때 DB constraint 오류
- 원인: `(playlistId, position)`은 하나만 허용됨
- 확인:

```sql
SELECT playlistId, position, COUNT(*)
FROM playlist_track
GROUP BY playlistId, position
HAVING COUNT(*) > 1;
```

- 해결: 추가 API는 충돌을 사전에 검사하고, reorder는 임시 음수 position을 거쳐 transaction으로 처리합니다.

## 6. Draft Playlist가 공개됨

- 증상: 작성 중 Playlist가 익명 목록에 나타남
- 원인: 공개 조회 조건에 `status = published`가 빠짐
- 확인: `CatalogMusicService.listPublicPlaylists()`와 `getPublicPlaylist()`를 확인합니다.
- 예방: 공개 query에서 status를 고정하고, Entity 전체 조회 후 controller에서 필터링하지 않습니다.

## 7. 공개 JSON에 S3 URL이 포함됨

- 증상: 공개 API 응답에 `audio_asset.url` 또는 object key가 나타남
- 원인: Entity 직접 반환, AudioAsset relation eager loading, presenter 누락
- 확인:

```bash
curl -s http://localhost:3000/music/public/playlists/1 | rg "url|objectKey|s3"
```

- 해결: public presenter가 선택한 필드만 반환하도록 합니다. 공개 응답에는 재생 URL을 넣지 않는 것이 현재 계약입니다.

## 8. Unit/build는 통과하지만 E2E가 DB 연결에 실패함

- 증상: `npm test` 또는 `npm run build`는 성공하지만 E2E에서 connection refused 또는 access denied
- 원인: Unit/build는 실제 MariaDB 연결을 요구하지 않지만 E2E는 `.env.test.local`과 DB 권한을 사용함
- 확인:

```bash
NODE_ENV=test npm run migration:show
npm run test:e2e
```

- 해결: `DB_HOST`, port, account, database, 권한, Migration 상태를 확인합니다. 운영 DB를 E2E DB로 사용하지 않습니다.

## 9. Migration이 실행되지 않음

- 증상: 새 Migration 파일이 있는데 `migration:show`에 나타나지 않음
- 원인: TypeORM DataSource의 migration glob 또는 ts-node 실행 환경 문제
- 확인:

```bash
npm run migration:show
npm run build
```

- 예방: source Migration과 production `dist/database/migrations/*.js` 경로를 모두 확인합니다.

## 10. 로그에 음원 URL 또는 token이 남음

- 증상: error log, request log, exception message에 URL/token이 기록됨
- 원인: DTO 또는 예외 객체를 그대로 로깅
- 해결: URL, object key, Authorization, secret은 redaction합니다. S3 public URL을 쓸 때도 URL을 로그에 남기지 않습니다.
