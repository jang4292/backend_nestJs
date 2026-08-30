import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

export class AddUniqueEmailToUsers1761000000000 implements MigrationInterface {
  name = 'AddUniqueEmailToUsers1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createUniqueConstraint(
      'users',
      new TableUnique({
        name: 'UQ_users_email',
        columnNames: ['email'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint('users', 'UQ_users_email');
  }
}
