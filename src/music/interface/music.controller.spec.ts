import { MusicController } from './music.controller';
import type { MusicService } from '../music.service';
import type { Track } from '../entities/track.entity';

describe('MusicController track reads', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const updatedAt = new Date('2026-01-02T00:00:00.000Z');
  const track = {
    id: 1,
    title: 'Song A',
    artist: { id: 10, name: 'Artist X', description: 'hidden' },
    bpm: 120,
    lengthSec: 180,
    createdAt,
    updatedAt,
  } as Track;

  const musicService = {
    getTrackList: jest.fn(),
    getTrack: jest.fn(),
  } as unknown as jest.Mocked<MusicService>;

  let controller: MusicController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MusicController(musicService);
  });

  it('returns public track fields for anonymous list reads', async () => {
    musicService.getTrackList.mockResolvedValue({
      items: [track],
      total: 1,
      page: 1,
      limit: 20,
    });

    await expect(controller.getTrackList({})).resolves.toEqual({
      items: [
        {
          id: 1,
          title: 'Song A',
          artist: { id: 10, name: 'Artist X' },
          bpm: 120,
          lengthSec: 180,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('returns full track fields for authenticated list reads', async () => {
    musicService.getTrackList.mockResolvedValue({
      items: [track],
      total: 1,
      page: 1,
      limit: 20,
    });

    await expect(controller.getFullTrackList({})).resolves.toEqual({
      items: [
        {
          id: 1,
          title: 'Song A',
          artist: { id: 10, name: 'Artist X' },
          bpm: 120,
          lengthSec: 180,
          createdAt,
          updatedAt,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('returns public and full fields for single track reads', async () => {
    musicService.getTrack.mockResolvedValue(track);

    await expect(controller.getTrack(1)).resolves.toEqual({
      id: 1,
      title: 'Song A',
      artist: { id: 10, name: 'Artist X' },
      bpm: 120,
      lengthSec: 180,
    });
    await expect(controller.getFullTrack(1)).resolves.toEqual({
      id: 1,
      title: 'Song A',
      artist: { id: 10, name: 'Artist X' },
      bpm: 120,
      lengthSec: 180,
      createdAt,
      updatedAt,
    });
  });
});
