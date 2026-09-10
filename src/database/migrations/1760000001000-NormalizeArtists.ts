import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class NormalizeArtists1760000001000 implements MigrationInterface {
  name = 'NormalizeArtists1760000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
          { name: 'name', type: 'varchar', length: '200', isNullable: false },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
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
        uniques: [{ name: 'UQ_artist_name', columnNames: ['name'] }],
      }),
      true,
    );

    await queryRunner.addColumn(
      'track',
      new TableColumn({
        name: 'artistId',
        type: 'integer',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      INSERT IGNORE INTO artist (name, description, createdAt, updatedAt)
      SELECT DISTINCT TRIM(artist) AS name, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM track
      WHERE TRIM(artist) <> ''
    `);

    await queryRunner.query(`
      UPDATE track t
      INNER JOIN artist a ON a.name = TRIM(t.artist)
      SET t.artistId = a.id
    `);

    await queryRunner.changeColumn(
      'track',
      'artistId',
      new TableColumn({
        name: 'artistId',
        type: 'integer',
        isNullable: false,
      }),
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
      new TableIndex({
        name: 'IDX_track_artistId',
        columnNames: ['artistId'],
      }),
    );

    await queryRunner.dropColumn('track', 'artist');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'track',
      new TableColumn({
        name: 'artist',
        type: 'varchar',
        length: '200',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      UPDATE track t
      INNER JOIN artist a ON t.artistId = a.id
      SET t.artist = a.name
    `);

    await queryRunner.changeColumn(
      'track',
      'artist',
      new TableColumn({
        name: 'artist',
        type: 'varchar',
        length: '200',
        isNullable: false,
      }),
    );

    await queryRunner.dropIndex('track', 'IDX_track_artistId');
    await queryRunner.dropForeignKey('track', 'FK_track_artist');
    await queryRunner.dropColumn('track', 'artistId');
    await queryRunner.dropTable('artist', true);
  }
}
