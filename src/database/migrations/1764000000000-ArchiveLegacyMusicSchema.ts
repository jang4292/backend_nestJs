import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArchiveLegacyMusicSchema1764000000000 implements MigrationInterface {
  name = 'ArchiveLegacyMusicSchema1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const legacyTables = [
      'legacy_artist',
      'legacy_track',
      'legacy_playlist',
      'legacy_playlist_track',
    ];
    const activeTables = ['artist', 'track', 'playlist', 'playlist_track'];

    const existingLegacyTables = await Promise.all(
      legacyTables.map((tableName) => queryRunner.hasTable(tableName)),
    );
    if (existingLegacyTables.some(Boolean)) {
      throw new Error(
        'Cannot archive music schema because one or more legacy tables already exist',
      );
    }

    const existingActiveTables = await Promise.all(
      activeTables.map((tableName) => queryRunner.hasTable(tableName)),
    );
    if (existingActiveTables.some((exists) => !exists)) {
      throw new Error(
        'Cannot archive music schema because the current music tables are incomplete',
      );
    }

    await queryRunner.query(`
      RENAME TABLE
        artist TO legacy_artist,
        track TO legacy_track,
        playlist TO legacy_playlist,
        playlist_track TO legacy_playlist_track
    `);
  }

  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'ArchiveLegacyMusicSchema cannot be reverted automatically; restore a database backup instead',
      ),
    );
  }
}
