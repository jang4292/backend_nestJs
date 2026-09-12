import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateMariaDbSchema1763000000000 implements MigrationInterface {
  name = 'CreateMariaDbSchema1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'username', type: 'varchar', length: '255', isUnique: true },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          { name: 'name', type: 'varchar', length: '255', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

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
          { name: 'userId', type: 'int' },
          { name: 'provider', type: 'varchar', length: '50' },
          { name: 'providerUserId', type: 'varchar', length: '255' },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          { name: 'name', type: 'varchar', length: '255', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        uniques: [
          {
            name: 'UQ_social_accounts_provider_provider_user_id',
            columnNames: ['provider', 'providerUserId'],
          },
        ],
      }),
      true,
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

    await queryRunner.createTable(
      new Table({
        name: 'artist',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '200', isUnique: true },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'track',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'title', type: 'varchar', length: '200' },
          { name: 'artistId', type: 'int' },
          { name: 'bpm', type: 'int', isNullable: true },
          { name: 'lengthSec', type: 'int', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
    await queryRunner.createForeignKey(
      'track',
      new TableForeignKey({
        name: 'FK_track_artist',
        columnNames: ['artistId'],
        referencedTableName: 'artist',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
    await queryRunner.createIndex(
      'track',
      new TableIndex({ name: 'IDX_track_artistId', columnNames: ['artistId'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'playlist',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '200' },
          { name: 'playDate', type: 'date', isNullable: true },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'playlist_track',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'playlistId', type: 'int' },
          { name: 'trackId', type: 'int' },
          { name: 'seq', type: 'int' },
          { name: 'note', type: 'varchar', length: '255', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
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
    await queryRunner.createIndex(
      'playlist_track',
      new TableIndex({
        name: 'IDX_playlist_track_playlistId_seq',
        columnNames: ['playlistId', 'seq'],
      }),
    );
    await queryRunner.createIndex(
      'playlist_track',
      new TableIndex({
        name: 'IDX_playlist_track_trackId',
        columnNames: ['trackId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('playlist_track', true);
    await queryRunner.dropTable('playlist', true);
    await queryRunner.dropTable('track', true);
    await queryRunner.dropTable('artist', true);
    await queryRunner.dropTable('social_accounts', true);
    await queryRunner.dropTable('users', true);
  }
}
