import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

export class CreateInitialSchema1760000000000 implements MigrationInterface {
  name = 'CreateInitialSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          { name: 'username', type: 'varchar', isUnique: true },
          { name: 'password', type: 'varchar', isNullable: true },
          { name: 'email', type: 'varchar', isNullable: true },
          { name: 'name', type: 'varchar', isNullable: true },
          { name: 'provider', type: 'varchar', isNullable: true },
          { name: 'googleId', type: 'varchar', isNullable: true },
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
            name: 'UQ_users_google_id',
            columnNames: ['googleId'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'track',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'title', type: 'varchar', length: '200' },
          { name: 'artist', type: 'varchar', length: '200' },
          { name: 'bpm', type: 'integer', isNullable: true },
          { name: 'lengthSec', type: 'integer', isNullable: true },
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
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'playlist',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'name', type: 'varchar', length: '200' },
          { name: 'playDate', type: 'date', isNullable: true },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
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
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'playlist_track',
        columns: [
          { name: 'id', type: 'serial', isPrimary: true },
          { name: 'playlistId', type: 'integer' },
          { name: 'trackId', type: 'integer' },
          { name: 'seq', type: 'integer' },
          { name: 'note', type: 'varchar', length: '255', isNullable: true },
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
      }),
      true,
    );

    await queryRunner.createForeignKeys('playlist_track', [
      new TableForeignKey({
        name: 'FK_playlist_track_playlist',
        columnNames: ['playlistId'],
        referencedTableName: 'playlist',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_playlist_track_track',
        columnNames: ['trackId'],
        referencedTableName: 'track',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('playlist_track', true);
    await queryRunner.dropTable('playlist', true);
    await queryRunner.dropTable('track', true);
    await queryRunner.dropTable('users', true);
  }
}
