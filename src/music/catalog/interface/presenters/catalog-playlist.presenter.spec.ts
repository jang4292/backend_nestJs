import { toPublicPlaylistResponse } from './catalog-playlist.presenter';
import type { CatalogPlaylist } from '../../entities/catalog-playlist.entity';

describe('toPublicPlaylistResponse', () => {
  it('returns playlist items in position order without audio URLs', () => {
    const response = toPublicPlaylistResponse({
      id: 7,
      title: 'Morning set',
      description: 'Public playlist',
      playDate: null,
      status: 'published',
      anonymousPlayable: false,
      publishedAt: new Date('2026-09-13T00:00:00.000Z'),
      createdAt: new Date('2026-09-12T00:00:00.000Z'),
      updatedAt: new Date('2026-09-13T00:00:00.000Z'),
      playlistItems: [
        {
          id: 2,
          position: 2,
          note: null,
          track: {
            id: 20,
            title: 'Second',
            artist: 'Artist B',
            bpm: 120,
            audioAssets: [
              {
                id: 99,
                url: 'https://example.com/private.mp3',
              },
            ],
          },
        },
        {
          id: 1,
          position: 1,
          note: null,
          track: {
            id: 10,
            title: 'First',
            artist: 'Artist A',
            bpm: 100,
            audioAssets: [],
          },
        },
      ],
    } as unknown as CatalogPlaylist);

    expect(response).toEqual({
      id: 7,
      title: 'Morning set',
      description: 'Public playlist',
      playDate: null,
      anonymousPlayable: false,
      trackCount: 2,
      tracks: [
        {
          position: 1,
          track: { id: 10, title: 'First', artist: 'Artist A', bpm: 100 },
        },
        {
          position: 2,
          track: { id: 20, title: 'Second', artist: 'Artist B', bpm: 120 },
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('private.mp3');
  });
});
