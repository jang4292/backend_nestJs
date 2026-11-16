import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive only: ambiguous existing catalog and legacy records are not guessed. */
export class AddMusicManagement1768000000000 implements MigrationInterface {
  name = 'AddMusicManagement1768000000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE music_artist (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, name varchar(200) NOT NULL, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE music_artist_alias (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, artistId int NOT NULL, name varchar(200) NOT NULL, INDEX IDX_music_artist_alias_artist (artistId), CONSTRAINT FK_music_alias_artist FOREIGN KEY (artistId) REFERENCES music_artist(id) ON DELETE RESTRICT) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE music_work (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, title varchar(200) NOT NULL, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)) ENGINE=InnoDB`,
    );
    await q.query(
      `ALTER TABLE track ADD workId int NULL, ADD recordingType varchar(50) NULL, ADD recordingLocation varchar(200) NULL, ADD recordingDate date NULL, ADD CONSTRAINT FK_music_track_work FOREIGN KEY (workId) REFERENCES music_work(id) ON DELETE RESTRICT`,
    );
    await q.query(
      `CREATE TABLE music_track_artist (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, trackId int NOT NULL, artistId int NOT NULL, UNIQUE INDEX UQ_music_track_artist (trackId, artistId), CONSTRAINT FK_music_track_artist_track FOREIGN KEY (trackId) REFERENCES track(id) ON DELETE RESTRICT, CONSTRAINT FK_music_track_artist_artist FOREIGN KEY (artistId) REFERENCES music_artist(id) ON DELETE RESTRICT) ENGINE=InnoDB`,
    );
    await q.query(
      `ALTER TABLE audio_asset ADD storageKey varchar(80) NULL, ADD contentType varchar(100) NULL, ADD sizeBytes int NULL`,
    );
    await q.query(
      `ALTER TABLE playlist_track ADD audioAssetId int NULL, ADD displayPosition int NULL, ADD CONSTRAINT FK_music_playlist_asset FOREIGN KEY (audioAssetId) REFERENCES audio_asset(id) ON DELETE RESTRICT`,
    );
    await q.query(
      `UPDATE playlist_track SET displayPosition = position WHERE displayPosition IS NULL`,
    );
    await q.query(
      `CREATE TABLE music_playlist_usage (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, playlistId int NOT NULL, playlistTitle varchar(200) NOT NULL, usedAt datetime NOT NULL, location varchar(200) NOT NULL, eventName varchar(200) NULL, status varchar(20) NOT NULL DEFAULT 'draft', createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX IDX_music_usage_date (usedAt), CONSTRAINT FK_music_usage_playlist FOREIGN KEY (playlistId) REFERENCES playlist(id) ON DELETE RESTRICT) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE music_playlist_usage_item (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, usageId int NOT NULL, trackId int NOT NULL, workId int NULL, audioAssetId int NULL, trackTitle varchar(200) NOT NULL, workTitle varchar(200) NULL, position int NOT NULL, playCount int NOT NULL DEFAULT 1, INDEX IDX_music_usage_item_usage (usageId), CONSTRAINT FK_music_usage_item_usage FOREIGN KEY (usageId) REFERENCES music_playlist_usage(id) ON DELETE CASCADE, CONSTRAINT FK_music_usage_item_track FOREIGN KEY (trackId) REFERENCES track(id) ON DELETE RESTRICT, CONSTRAINT FK_music_usage_item_work FOREIGN KEY (workId) REFERENCES music_work(id) ON DELETE RESTRICT, CONSTRAINT FK_music_usage_item_asset FOREIGN KEY (audioAssetId) REFERENCES audio_asset(id) ON DELETE RESTRICT) ENGINE=InnoDB`,
    );
    await q.query(
      `CREATE TABLE music_usage_item_artist (id int NOT NULL AUTO_INCREMENT PRIMARY KEY, usageItemId int NOT NULL, artistId int NOT NULL, artistName varchar(200) NOT NULL, UNIQUE INDEX UQ_music_usage_item_artist (usageItemId, artistId), CONSTRAINT FK_music_usage_artist_item FOREIGN KEY (usageItemId) REFERENCES music_playlist_usage_item(id) ON DELETE CASCADE, CONSTRAINT FK_music_usage_artist_artist FOREIGN KEY (artistId) REFERENCES music_artist(id) ON DELETE RESTRICT) ENGINE=InnoDB`,
    );
  }
  public down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Music management data requires restoration from a database backup',
      ),
    );
  }
}
