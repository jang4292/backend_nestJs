import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCatalogPlaylistSchema1764000002000 implements MigrationInterface {
  name = 'CreateCatalogPlaylistSchema1764000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
          { name: 'title', type: 'varchar', length: '200' },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          { name: 'playDate', type: 'date', isNullable: true },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'published', 'archived'],
            default: "'draft'",
          },
          {
            name: 'anonymousPlayable',
            type: 'tinyint',
            width: 1,
            default: 0,
          },
          { name: 'publishedAt', type: 'datetime', isNullable: true },
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
      }),
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
          { name: 'position', type: 'int' },
          { name: 'note', type: 'varchar', length: '255', isNullable: true },
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
      }),
    );

    await queryRunner.createForeignKeys('playlist_track', [
      new TableForeignKey({
        name: 'FK_catalog_playlist_track_playlist',
        columnNames: ['playlistId'],
        referencedTableName: 'playlist',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_catalog_playlist_track_track',
        columnNames: ['trackId'],
        referencedTableName: 'track',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    ]);

    await queryRunner.createIndices('playlist_track', [
      // 애플리케이션 검사와 함께 DB에서도 position 중복을 보장합니다.
      new TableIndex({
        name: 'UQ_catalog_playlist_track_playlist_position',
        columnNames: ['playlistId', 'position'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_catalog_playlist_track_trackId',
        columnNames: ['trackId'],
      }),
    ]);

    await queryRunner.createIndex(
      'playlist',
      new TableIndex({
        name: 'IDX_catalog_playlist_status_publishedAt',
        columnNames: ['status', 'publishedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('playlist_track', true);
    await queryRunner.dropTable('playlist', true);
  }
}
