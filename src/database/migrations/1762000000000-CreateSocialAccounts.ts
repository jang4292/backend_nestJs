import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

/**
 * 2026-11-08 수정: TypeORM MySQL 드라이버는 `dropUniqueConstraint`/`createUniqueConstraint`를
 * 지원하지 않아 빈 MariaDB에서 실패했습니다(CI에서 발견).
 * - up: `dropColumn('users', 'googleId')`가 그 컬럼의 단일 unique index(UQ_users_google_id)를 함께 지웁니다.
 * - down: 같은 이름의 unique index로 되돌립니다.
 * 이미 이 migration이 기록된 DB에서는 다시 실행되지 않으므로 영향이 없습니다.
 */

export class CreateSocialAccounts1762000000000 implements MigrationInterface {
  name = 'CreateSocialAccounts1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'social_accounts',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'userId', type: 'integer' },
          { name: 'provider', type: 'varchar' },
          { name: 'providerUserId', type: 'varchar' },
          { name: 'email', type: 'varchar', isNullable: true },
          { name: 'name', type: 'varchar', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        uniques: [
          new TableUnique({
            name: 'UQ_social_accounts_provider_provider_user_id',
            columnNames: ['provider', 'providerUserId'],
          }),
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'social_accounts',
      new TableForeignKey({
        name: 'FK_social_accounts_user',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Migrate existing Google-linked users into social_accounts.
    await queryRunner.query(`
      INSERT INTO social_accounts (userId, provider, providerUserId, email, name)
      SELECT id, provider, googleId, email, name
      FROM users
      WHERE googleId IS NOT NULL
    `);

    // googleId의 unique index(UQ_users_google_id)는 컬럼과 함께 삭제됩니다.
    await queryRunner.dropColumn('users', 'googleId');
    await queryRunner.dropColumn('users', 'provider');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN provider varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN googleId varchar(255)`,
    );

    await queryRunner.query(`
      UPDATE users u
      INNER JOIN social_accounts sa ON sa.userId = u.id AND sa.provider = 'google'
      SET u.provider = sa.provider, u.googleId = sa.providerUserId
    `);

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'UQ_users_google_id',
        columnNames: ['googleId'],
        isUnique: true,
      }),
    );

    await queryRunner.dropForeignKey(
      'social_accounts',
      'FK_social_accounts_user',
    );
    await queryRunner.dropTable('social_accounts', true);
  }
}
