import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * 최소 RBAC: users.role(user|admin)을 추가합니다. 기존 사용자는 모두 'user'가 됩니다.
 * admin 지정은 배포 후 수동으로 수행합니다.
 *   UPDATE users SET role = 'admin' WHERE username = '<admin-username>';
 */
export class AddRoleToUsers1765000000000 implements MigrationInterface {
  name = 'AddRoleToUsers1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'role',
        type: 'enum',
        enum: ['user', 'admin'],
        default: "'user'",
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'role');
  }
}
