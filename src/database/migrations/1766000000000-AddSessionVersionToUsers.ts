import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * 세션 무효화용 버전: users.sessionVersion(기본 0)을 추가합니다(AUTH-3).
 *
 * - 세션 JWT에 발급 시점의 버전(`sv`)을 넣고, JwtStrategy가 매 요청 DB 값과 비교합니다.
 * - 비밀번호를 바꾸면 버전이 1 오르고, 그 전에 발급된 토큰은 즉시 401이 됩니다.
 * - 이 migration 전에 발급된 토큰은 `sv`가 없으므로 0으로 간주되어 배포 직후에도 유효합니다.
 * - 데이터는 바꾸지 않으며 down은 컬럼만 삭제합니다.
 */
export class AddSessionVersionToUsers1766000000000 implements MigrationInterface {
  name = 'AddSessionVersionToUsers1766000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'sessionVersion',
        type: 'int',
        unsigned: true,
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'sessionVersion');
  }
}
