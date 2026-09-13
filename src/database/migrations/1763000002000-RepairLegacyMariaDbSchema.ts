import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class RepairLegacyMariaDbSchema1763000002000 implements MigrationInterface {
  name = 'RepairLegacyMariaDbSchema1763000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.ensureArtistTable(queryRunner);
    await this.repairTrackTable(queryRunner);
    await this.repairPlaylistTable(queryRunner);
    await this.repairPlaylistTrackTable(queryRunner);
    await this.ensureUsersEmailUnique(queryRunner);
    await this.ensureSocialAccountsTable(queryRunner);
  }

  public async down(): Promise<void> {
    // This migration normalizes an existing legacy MariaDB schema in place.
    // Down migration is intentionally not destructive because it would risk data loss.
  }

  private async ensureArtistTable(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('artist')) {
      await this.normalizeArtistNameCollation(queryRunner);
      return;
    }

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
    await this.normalizeArtistNameCollation(queryRunner);
  }

  private async repairTrackTable(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasColumn(queryRunner, 'track', 'duration_sec')) {
      if (await this.hasColumn(queryRunner, 'track', 'lengthSec')) {
        await queryRunner.query(`
          UPDATE track
          SET lengthSec = COALESCE(lengthSec, duration_sec)
          WHERE duration_sec IS NOT NULL
        `);
      } else {
        await queryRunner.query(
          'ALTER TABLE track CHANGE duration_sec lengthSec int NULL',
        );
      }
    }

    if (await this.hasColumn(queryRunner, 'track', 'created_at')) {
      if (await this.hasColumn(queryRunner, 'track', 'createdAt')) {
        await queryRunner.query(`
          UPDATE track
          SET createdAt = created_at
          WHERE created_at IS NOT NULL
        `);
      } else {
        await queryRunner.query(
          'ALTER TABLE track CHANGE created_at createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP',
        );
      }
    }

    if (!(await this.hasColumn(queryRunner, 'track', 'updatedAt'))) {
      await queryRunner.query(
        'ALTER TABLE track ADD updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      );
    }

    if (await this.hasColumn(queryRunner, 'track', 'artist_name')) {
      await queryRunner.query(`
        INSERT IGNORE INTO artist (name, description, createdAt, updatedAt)
        SELECT DISTINCT TRIM(artist_name), NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM track
        WHERE artist_name IS NOT NULL AND TRIM(artist_name) <> ''
      `);
      await queryRunner.query(`
        INSERT IGNORE INTO artist (name, description, createdAt, updatedAt)
        SELECT 'Unknown Artist', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        WHERE EXISTS (
          SELECT 1 FROM track WHERE artist_name IS NULL OR TRIM(artist_name) = ''
        )
      `);
      if (!(await this.hasColumn(queryRunner, 'track', 'artistId'))) {
        await queryRunner.query('ALTER TABLE track ADD artistId int NULL');
      }
      await queryRunner.query(`
        UPDATE track t
        INNER JOIN artist a ON a.name = TRIM(t.artist_name) COLLATE utf8mb4_general_ci
        SET t.artistId = a.id
        WHERE t.artistId IS NULL
          AND t.artist_name IS NOT NULL
          AND TRIM(t.artist_name) <> ''
      `);
      await queryRunner.query(`
        UPDATE track t
        INNER JOIN artist a ON a.name = 'Unknown Artist' COLLATE utf8mb4_general_ci
        SET t.artistId = a.id
        WHERE t.artistId IS NULL
      `);
      await queryRunner.query('ALTER TABLE track MODIFY artistId int NOT NULL');
    }

    await this.createIndexIfMissing(
      queryRunner,
      'track',
      'IDX_track_artistId',
      'artistId',
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      'track',
      'FK_track_artist',
      new TableForeignKey({
        name: 'FK_track_artist',
        columnNames: ['artistId'],
        referencedTableName: 'artist',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  private async repairPlaylistTable(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasColumn(queryRunner, 'playlist', 'event_date')) {
      if (await this.hasColumn(queryRunner, 'playlist', 'playDate')) {
        await queryRunner.query(`
          UPDATE playlist
          SET playDate = COALESCE(playDate, event_date)
          WHERE event_date IS NOT NULL
        `);
      } else {
        await queryRunner.query(
          'ALTER TABLE playlist CHANGE event_date playDate date NULL',
        );
      }
    }

    if (!(await this.hasColumn(queryRunner, 'playlist', 'description'))) {
      await queryRunner.query(
        'ALTER TABLE playlist ADD description varchar(500) NULL',
      );
    }

    if (await this.hasColumn(queryRunner, 'playlist', 'created_at')) {
      if (await this.hasColumn(queryRunner, 'playlist', 'createdAt')) {
        await queryRunner.query(`
          UPDATE playlist
          SET createdAt = created_at
          WHERE created_at IS NOT NULL
        `);
      } else {
        await queryRunner.query(
          'ALTER TABLE playlist CHANGE created_at createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP',
        );
      }
    }

    if (!(await this.hasColumn(queryRunner, 'playlist', 'updatedAt'))) {
      await queryRunner.query(
        'ALTER TABLE playlist ADD updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      );
    }
  }

  private async repairPlaylistTrackTable(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await this.dropForeignKeyIfExists(
      queryRunner,
      'playlist_track',
      'fk_pt_track',
    );
    await this.dropForeignKeyIfExists(
      queryRunner,
      'playlist_track',
      'fk_pt_playlist',
    );

    if (await this.hasColumn(queryRunner, 'playlist_track', 'playlist_id')) {
      await queryRunner.query(
        'ALTER TABLE playlist_track CHANGE playlist_id playlistId bigint unsigned NOT NULL',
      );
    }
    if (await this.hasColumn(queryRunner, 'playlist_track', 'track_id')) {
      await queryRunner.query(
        'ALTER TABLE playlist_track CHANGE track_id trackId bigint unsigned NOT NULL',
      );
    }
    if (await this.hasColumn(queryRunner, 'playlist_track', 'track_order')) {
      await queryRunner.query(
        'ALTER TABLE playlist_track CHANGE track_order seq int NOT NULL',
      );
    }
    if (await this.hasColumn(queryRunner, 'playlist_track', 'created_at')) {
      if (await this.hasColumn(queryRunner, 'playlist_track', 'createdAt')) {
        await queryRunner.query(`
          UPDATE playlist_track
          SET createdAt = created_at
          WHERE created_at IS NOT NULL
        `);
      } else {
        await queryRunner.query(
          'ALTER TABLE playlist_track CHANGE created_at createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP',
        );
      }
    }

    if (!(await this.hasColumn(queryRunner, 'playlist_track', 'note'))) {
      await queryRunner.query(
        'ALTER TABLE playlist_track ADD note varchar(255) NULL',
      );
    }
    if (!(await this.hasColumn(queryRunner, 'playlist_track', 'updatedAt'))) {
      await queryRunner.query(
        'ALTER TABLE playlist_track ADD updatedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      );
    }

    await this.createIndexIfMissing(
      queryRunner,
      'playlist_track',
      'IDX_playlist_track_playlistId_seq',
      'playlistId, seq',
    );
    await this.createIndexIfMissing(
      queryRunner,
      'playlist_track',
      'IDX_playlist_track_trackId',
      'trackId',
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      'playlist_track',
      'FK_playlist_track_playlist',
      new TableForeignKey({
        name: 'FK_playlist_track_playlist',
        columnNames: ['playlistId'],
        referencedTableName: 'playlist',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await this.createForeignKeyIfMissing(
      queryRunner,
      'playlist_track',
      'FK_playlist_track_track',
      new TableForeignKey({
        name: 'FK_playlist_track_track',
        columnNames: ['trackId'],
        referencedTableName: 'track',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  private async ensureUsersEmailUnique(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (await this.hasConstraint(queryRunner, 'users', 'UQ_users_email')) {
      return;
    }

    await queryRunner.query(
      'ALTER TABLE users ADD CONSTRAINT UQ_users_email UNIQUE (email)',
    );
  }

  private async ensureSocialAccountsTable(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (await queryRunner.hasTable('social_accounts')) {
      return;
    }

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
    await this.createForeignKeyIfMissing(
      queryRunner,
      'social_accounts',
      'FK_social_accounts_user',
      new TableForeignKey({
        name: 'FK_social_accounts_user',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  private async hasColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const table = await queryRunner.getTable(tableName);
    return table?.findColumnByName(columnName) !== undefined;
  }

  private async normalizeArtistNameCollation(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE artist MODIFY name varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL',
    );
  }

  private async hasConstraint(
    queryRunner: QueryRunner,
    tableName: string,
    constraintName: string,
  ): Promise<boolean> {
    const result = (await queryRunner.query(
      `
        SELECT 1
        FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND CONSTRAINT_NAME = ?
        LIMIT 1
      `,
      [tableName, constraintName],
    )) as unknown[];
    return result.length > 0;
  }

  private async createIndexIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columnsSql: string,
  ): Promise<void> {
    const result = (await queryRunner.query(
      `
        SELECT 1
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND INDEX_NAME = ?
        LIMIT 1
      `,
      [tableName, indexName],
    )) as unknown[];

    if (result.length === 0) {
      await queryRunner.query(
        `CREATE INDEX ${indexName} ON ${tableName} (${columnsSql})`,
      );
    }
  }

  private async createForeignKeyIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    constraintName: string,
    foreignKey: TableForeignKey,
  ): Promise<void> {
    if (await this.hasConstraint(queryRunner, tableName, constraintName)) {
      return;
    }

    await queryRunner.createForeignKey(tableName, foreignKey);
  }

  private async dropForeignKeyIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    constraintName: string,
  ): Promise<void> {
    if (!(await this.hasConstraint(queryRunner, tableName, constraintName))) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE ${tableName} DROP FOREIGN KEY ${constraintName}`,
    );
  }
}
