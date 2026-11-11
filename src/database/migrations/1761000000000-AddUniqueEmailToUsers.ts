import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * users.email에 UNIQUE를 추가합니다.
 *
 * MariaDB/MySQL에서 UNIQUE 제약은 unique index로 구현되며, TypeORM MySQL 드라이버는
 * `createUniqueConstraint`를 지원하지 않습니다("MySql does not support unique constraints").
 * 그래서 같은 이름(UQ_users_email)의 unique index로 만듭니다. 결과 스키마는
 * `ALTER TABLE users ADD CONSTRAINT UQ_users_email UNIQUE (email)`과 같습니다.
 *
 * 2026-11-08 수정: 빈 MariaDB에서 전체 체인을 처음 실행한 CI에서 발견했습니다.
 * 이미 이 migration이 기록된 DB에서는 다시 실행되지 않으므로 영향이 없습니다.
 */
export class AddUniqueEmailToUsers1761000000000 implements MigrationInterface {
  name = 'AddUniqueEmailToUsers1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'UQ_users_email',
        columnNames: ['email'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'UQ_users_email');
  }
}
