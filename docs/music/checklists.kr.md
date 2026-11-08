# Music 체크리스트

## 학습 체크리스트

- [ ] 요청 route가 Legacy인지 Catalog인지 확인했다.
- [ ] route가 실제로 사용하는 Entity와 DB table을 확인했다.
- [ ] Track과 AudioAsset의 역할 차이를 설명할 수 있다.
- [ ] Playlist와 PlaylistTrack을 별도 관계 Entity로 둔 이유를 설명할 수 있다.
- [ ] `position`이 재생 순서를 결정한다는 것을 확인했다.
- [ ] Controller, service/facade, use case, repository의 책임을 구분했다.
- [ ] Entity와 public presenter의 차이를 이해했다.
- [ ] 공개 API와 JWT 보호 API를 구분했다.
- [ ] Migration 상태를 `npm run migration:show`로 확인했다.

## 기능 개발 체크리스트

- [ ] 새 DTO에 `class-validator` 검증을 추가했다.
- [ ] 공개 route와 관리 route를 분리했다.
- [ ] 관리 route에 JWT 보호를 추가했다.
- [ ] 공개 Playlist query가 `status = published`를 강제한다.
- [ ] 공개 응답은 presenter/response DTO를 통과한다.
- [ ] 공개 응답에 `url`, object key, token이 없다.
- [ ] Playlist item position 충돌을 검사한다.
- [ ] reorder 요청이 모든 item을 정확히 한 번 포함하는지 검증한다.
- [ ] 여러 position 변경을 transaction으로 처리한다.
- [ ] Not Found, Bad Request, Conflict 응답을 구분한다.
- [ ] 페이지네이션과 정렬 기본값을 문서화했다.
- [ ] unit test와 E2E 계약을 추가했다.

## DB 및 Migration 체크리스트

- [ ] 운영 DB는 MariaDB 기준으로 확인했다.
- [ ] `DB_SYNCHRONIZE=false`인지 확인했다.
- [ ] 기존 Migration을 수정하지 않고 새 Migration을 추가했다.
- [ ] Migration 실행 전 DB backup을 만들었다.
- [ ] `npm run migration:show` 결과를 기록했다.
- [ ] FK 대상 table과 실행 순서를 확인했다.
- [ ] `(playlistId, position)` 중복 데이터를 사전 점검했다.
- [ ] `CASCADE`와 `RESTRICT` 삭제 정책을 확인했다.
- [ ] Migration 실패 시 API 재시작을 중단한다.
- [ ] 적용 후 table, index, FK를 MariaDB에서 확인한다.

## 음원 보안 체크리스트

- [ ] 공개 Playlist 응답에 음원 URL이 없다.
- [ ] AudioAsset 관리 조회가 인증되어 있다.
- [ ] S3 public URL의 복사·공유 가능성을 문서화했다.
- [ ] URL과 token을 로그에 기록하지 않는다.
- [ ] 향후 private bucket과 presigned URL 전환 조건을 정했다.
- [ ] presigned URL 사용 시 TTL, Range 요청, CORS를 검증한다.
- [ ] 파일 교체와 비활성화 시 기존 URL 정책을 정했다.

## 배포 체크리스트

- [ ] `npm ci`가 성공했다.
- [ ] `npm run build`가 성공했다.
- [ ] Migration 상태를 확인했다.
- [ ] 백업과 복구 절차를 확인했다.
- [ ] `npm run migration:run`을 명시적으로 실행했다.
- [ ] API reload 후 `/health`를 확인했다.
- [ ] 공개 Playlist 목록과 상세 API를 smoke test했다.
- [ ] draft Playlist가 공개되지 않는지 확인했다.
- [ ] 공개 응답에 음원 URL이 없는지 확인했다.
- [ ] MariaDB와 API 로그에 오류가 없는지 확인했다.

## 장애 대응 체크리스트

- [ ] request ID와 endpoint를 확보했다.
- [ ] API 오류인지 DB connection 오류인지 분리했다.
- [ ] `npm run migration:show` 결과를 확인했다.
- [ ] 최근 Migration과 배포 시점을 확인했다.
- [ ] affected table의 FK/index/row 상태를 확인했다.
- [ ] 공개 응답의 민감정보 노출 여부를 확인했다.
- [ ] 필요한 경우 API를 중지하고 DB backup을 보존했다.
- [ ] 원인과 재발 방지 조치를 `docs/music/troubleshooting.kr.md`에 추가했다.
