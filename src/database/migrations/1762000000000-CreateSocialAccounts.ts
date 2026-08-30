import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

export class CreateSocialAccounts1762000000000 implements MigrationInterface {
  name = 'CreateSocialAccounts1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'social_accounts',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'userId', type: 'integer' },
          { name: 'provider', type: 'varchar' },
          { name: 'providerUserId', type: 'varchar' },
          { name: 'email', type: 'varchar', isNullable: true },
          { name: 'name', type: 'varchar', isNullable: true },
          {
            name: 'createdAt',
            type: 'timestamp without time zone',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp without time zone',
            default: 'now()',
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
      INSERT INTO "social_accounts" ("userId", "provider", "providerUserId", "email", "name")
      SELECT "id", "provider", "googleId", "email", "name"
      FROM "users"
      WHERE "googleId" IS NOT NULL
    `);

    await queryRunner.dropUniqueConstraint('users', 'UQ_users_google_id');
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "googleId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "provider"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "provider" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "googleId" varchar`,
    );

    await queryRunner.query(`
      UPDATE "users" u
      SET "provider" = sa."provider", "googleId" = sa."providerUserId"
      FROM "social_accounts" sa
      WHERE sa."userId" = u."id" AND sa."provider" = 'google'
    `);

    await queryRunner.createUniqueConstraint(
      'users',
      new TableUnique({
        name: 'UQ_users_google_id',
        columnNames: ['googleId'],
      }),
    );

    await queryRunner.dropForeignKey(
      'social_accounts',
      'FK_social_accounts_user',
    );
    await queryRunner.dropTable('social_accounts', true);
  }
}
