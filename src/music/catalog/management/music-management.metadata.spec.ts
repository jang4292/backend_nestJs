import { DataSource } from 'typeorm';
import { databaseEntities } from '../../../database/database-options';
import { MusicPlaylistUsageItem } from './music-management.entities';
import { CatalogPlaylistTrack } from '../entities/catalog-playlist-track.entity';

describe('music management schema metadata', () => {
  it('registers usage and selected-audio foreign keys for schema comparison', async () => {
    const source = new DataSource({
      type: 'mariadb',
      host: 'localhost',
      username: 'unused',
      database: 'unused',
      entities: databaseEntities,
      synchronize: false,
    });
    await (
      source as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();
    const usage = source.getMetadata(MusicPlaylistUsageItem);
    expect(usage.foreignKeys.map((key) => key.name)).toEqual(
      expect.arrayContaining([
        'FK_music_usage_item_usage',
        'FK_music_usage_item_track',
        'FK_music_usage_item_work',
        'FK_music_usage_item_asset',
      ]),
    );
    expect(
      source
        .getMetadata(CatalogPlaylistTrack)
        .foreignKeys.map((key) => key.name),
    ).toContain('FK_music_playlist_asset');
  });
});
