import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { AudioAssetRepositoryPort } from './application/ports/audio-asset-repository.port';
import type { CatalogTrackRepositoryPort } from './application/ports/catalog-track-repository.port';
import { CatalogMusicService } from './catalog-music.service';
import type { AudioAsset } from './entities/audio-asset.entity';
import type { CatalogPlaylist } from './entities/catalog-playlist.entity';
import type { CatalogPlaylistTrack } from './entities/catalog-playlist-track.entity';
import type { CatalogTrack } from './entities/catalog-track.entity';

describe('CatalogMusicService', () => {
  const track = {
    id: 1,
    title: 'Song A',
    artist: 'Artist A',
    bpm: 120,
    audioAssets: [],
  } as CatalogTrack;
  const audioAsset = {
    id: 2,
    track,
    url: null,
    duration: null,
    bpm: 128,
  } as AudioAsset;

  let trackRepo: jest.Mocked<CatalogTrackRepositoryPort>;
  let audioAssetRepo: jest.Mocked<AudioAssetRepositoryPort>;
  let playlistRepo: jest.Mocked<Pick<Repository<CatalogPlaylist>, 'findOne'>>;
  let playlistTrackRepo: jest.Mocked<
    Pick<
      Repository<CatalogPlaylistTrack>,
      'findOne' | 'save' | 'create' | 'find' | 'manager'
    >
  >;
  let service: CatalogMusicService;

  beforeEach(() => {
    trackRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      remove: jest.fn(),
    };
    audioAssetRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByTrackId: jest.fn(),
      remove: jest.fn(),
    };
    playlistRepo = {
      findOne: jest.fn(),
    };
    playlistTrackRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      manager: {
        transaction: jest.fn(),
      } as never,
    };
    service = new CatalogMusicService(
      trackRepo,
      audioAssetRepo,
      playlistRepo as Repository<CatalogPlaylist>,
      playlistTrackRepo as Repository<CatalogPlaylistTrack>,
    );
  });

  it('creates a track without an audio asset', async () => {
    let savedTrack: CatalogTrack | undefined;
    trackRepo.create.mockImplementation((data) => ({
      ...track,
      ...data,
    }));
    trackRepo.save.mockImplementation((candidate) => {
      savedTrack = candidate;
      return Promise.resolve(track);
    });

    await expect(
      service.createTrack({ title: 'Song A', artist: 'Artist A', bpm: 120 }),
    ).resolves.toBe(track);
    expect(savedTrack).toMatchObject({
      title: 'Song A',
      artist: 'Artist A',
      bpm: 120,
    });
  });

  it('rejects an audio asset for a missing track', async () => {
    trackRepo.findById.mockResolvedValue(null);

    await expect(service.createAudioAsset(999, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('keeps catalog and audio asset BPM values independent', async () => {
    trackRepo.findById.mockResolvedValue(track);
    audioAssetRepo.findById.mockResolvedValue(audioAsset);
    audioAssetRepo.save.mockImplementation((asset) => Promise.resolve(asset));

    const updatedAsset = await service.updateAudioAsset(2, { bpm: 130 });

    expect(updatedAsset.bpm).toBe(130);
    expect(track.bpm).toBe(120);
  });

  it('deletes a track through its repository', async () => {
    trackRepo.findById.mockResolvedValue(track);

    await expect(service.deleteTrack(1)).resolves.toEqual({
      deleted: true,
      id: 1,
    });
    expect(trackRepo.remove.mock.calls).toEqual([[track]]);
  });
});
