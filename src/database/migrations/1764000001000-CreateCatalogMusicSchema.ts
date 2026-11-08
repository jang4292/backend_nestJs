import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCatalogMusicSchema1764000001000 implements MigrationInterface {
  name = 'CreateCatalogMusicSchema1764000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
          { name: 'artist', type: 'varchar', length: '200' },
          { name: 'bpm', type: 'int', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
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
        name: 'audio_asset',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'trackId', type: 'int' },
          { name: 'url', type: 'varchar', length: '2000', isNullable: true },
          { name: 'duration', type: 'int', isNullable: true },
          { name: 'bpm', type: 'int', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );
    await queryRunner.createForeignKey(
      'audio_asset',
      new TableForeignKey({
        name: 'FK_audio_asset_track',
        columnNames: ['trackId'],
        referencedTableName: 'track',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createIndex(
      'audio_asset',
      new TableIndex({
        name: 'IDX_audio_asset_trackId',
        columnNames: ['trackId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audio_asset');
    await queryRunner.dropTable('track');
  }
}
