import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MusicService } from './music.service';
import { Track } from './entities/track.entity';
import { Playlist } from './entities/playlist.entity';
import { PlaylistTrack } from './entities/playlist-track.entity';
import { PlaylistTracksService } from './services/playlist-tracks.service';
import { PlaylistsService } from './services/playlists.service';
import { TracksService } from './services/tracks.service';

const mockTrackRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

const mockPlaylistRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

const mockPlaylistTrackRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

describe('MusicService', () => {
  let service: MusicService;
  let trackRepo: ReturnType<typeof mockTrackRepo>;
  let playlistRepo: ReturnType<typeof mockPlaylistRepo>;
  let playlistTrackRepo: ReturnType<typeof mockPlaylistTrackRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicService,
        TracksService,
        PlaylistsService,
        PlaylistTracksService,
        { provide: getRepositoryToken(Track), useFactory: mockTrackRepo },
        { provide: getRepositoryToken(Playlist), useFactory: mockPlaylistRepo },
        {
          provide: getRepositoryToken(PlaylistTrack),
          useFactory: mockPlaylistTrackRepo,
        },
      ],
    }).compile();

    service = module.get<MusicService>(MusicService);
    trackRepo = module.get(getRepositoryToken(Track));
    playlistRepo = module.get(getRepositoryToken(Playlist));
    playlistTrackRepo = module.get(getRepositoryToken(PlaylistTrack));
  });

  // ===== Track =====

  describe('createTrack', () => {
    it('should create and save a track', async () => {
      const dto = { title: 'Song A', artist: 'Artist X', bpm: 120 };
      const created = { id: 1, ...dto };
      trackRepo.create.mockReturnValue(created);
      trackRepo.save.mockResolvedValue(created);

      const result = await service.createTrack(dto);

      expect(trackRepo.create).toHaveBeenCalledWith(dto);
      expect(trackRepo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });
  });

  describe('getTrack', () => {
    it('should return a track by id', async () => {
      const track = { id: 1, title: 'Song A', artist: 'Artist X' };
      trackRepo.findOne.mockResolvedValue(track);

      const result = await service.getTrack(1);
      expect(result).toEqual(track);
    });

    it('should throw NotFoundException when track not found', async () => {
      trackRepo.findOne.mockResolvedValue(null);
      await expect(service.getTrack(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTrack', () => {
    it('should update and return the track', async () => {
      const track = { id: 1, title: 'Old', artist: 'Artist X', bpm: 100 };
      const dto = { title: 'New Title' };
      trackRepo.findOne.mockResolvedValue(track);
      trackRepo.save.mockResolvedValue({ ...track, ...dto });

      const result = await service.updateTrack(1, dto);
      expect(result.title).toBe('New Title');
    });
  });

  describe('deleteTrack', () => {
    it('should delete a track and return confirmation', async () => {
      const track = { id: 1, title: 'Song A', artist: 'Artist X' };
      trackRepo.findOne.mockResolvedValue(track);
      trackRepo.remove.mockResolvedValue(track);

      const result = await service.deleteTrack(1);
      expect(trackRepo.remove).toHaveBeenCalledWith(track);
      expect(result).toEqual({ deleted: true, id: 1 });
    });

    it('should throw NotFoundException when track not found', async () => {
      trackRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteTrack(99)).rejects.toThrow(NotFoundException);
    });
  });

  // ===== Playlist =====

  describe('createPlaylist', () => {
    it('should create and save a playlist', async () => {
      const dto = { name: 'My Playlist', playDate: '2025-12-24' };
      const created = { id: 1, ...dto, description: null };
      playlistRepo.create.mockReturnValue(created);
      playlistRepo.save.mockResolvedValue(created);

      const result = await service.createPlaylist(dto);
      expect(playlistRepo.save).toHaveBeenCalled();
      expect(result).toEqual(created);
    });
  });

  describe('getPlaylist', () => {
    it('should return a playlist with tracks', async () => {
      const playlist = { id: 1, name: 'My Playlist', playlistTracks: [] };
      playlistRepo.findOne.mockResolvedValue(playlist);

      const result = await service.getPlaylist(1);
      expect(result).toEqual(playlist);
    });

    it('should throw NotFoundException when playlist not found', async () => {
      playlistRepo.findOne.mockResolvedValue(null);
      await expect(service.getPlaylist(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePlaylist', () => {
    it('should update and return the playlist', async () => {
      const playlist = {
        id: 1,
        name: 'Old Name',
        playDate: null,
        description: null,
      };
      const dto = { name: 'New Name' };
      playlistRepo.findOne.mockResolvedValue(playlist);
      playlistRepo.save.mockResolvedValue({ ...playlist, name: 'New Name' });

      const result = await service.updatePlaylist(1, dto);
      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundException when playlist not found', async () => {
      playlistRepo.findOne.mockResolvedValue(null);
      await expect(service.updatePlaylist(99, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deletePlaylist', () => {
    it('should delete a playlist and return confirmation', async () => {
      const playlist = { id: 1, name: 'My Playlist' };
      playlistRepo.findOne.mockResolvedValue(playlist);
      playlistRepo.remove.mockResolvedValue(playlist);

      const result = await service.deletePlaylist(1);
      expect(playlistRepo.remove).toHaveBeenCalledWith(playlist);
      expect(result).toEqual({ deleted: true, id: 1 });
    });

    it('should throw NotFoundException when playlist not found', async () => {
      playlistRepo.findOne.mockResolvedValue(null);
      await expect(service.deletePlaylist(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===== PlaylistTrack =====

  describe('addTrackToPlaylist', () => {
    it('should add a track to a playlist', async () => {
      const playlist = { id: 1, name: 'My Playlist' };
      const track = { id: 2, title: 'Song A', artist: 'Artist X' };
      const dto = { trackId: 2, seq: 1 };
      const pt = { id: 10, playlist, track, seq: 1, note: null };

      playlistRepo.findOne.mockResolvedValue(playlist);
      trackRepo.findOne.mockResolvedValue(track);
      playlistTrackRepo.create.mockReturnValue(pt);
      playlistTrackRepo.save.mockResolvedValue(pt);

      const result = await service.addTrackToPlaylist(1, dto);
      expect(result).toEqual(pt);
    });

    it('should throw NotFoundException when playlist not found', async () => {
      playlistRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addTrackToPlaylist(99, { trackId: 1, seq: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when track not found', async () => {
      playlistRepo.findOne.mockResolvedValue({ id: 1 });
      trackRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addTrackToPlaylist(1, { trackId: 99, seq: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePlaylistTrack', () => {
    it('should update seq and note', async () => {
      const pt = { id: 10, seq: 1, note: null };
      const dto = { seq: 2, note: 'intro' };
      playlistTrackRepo.findOne.mockResolvedValue(pt);
      playlistTrackRepo.save.mockResolvedValue({ ...pt, ...dto });

      const result = await service.updatePlaylistTrack(1, 10, dto);
      expect(result.seq).toBe(2);
      expect(result.note).toBe('intro');
    });

    it('should throw NotFoundException when PlaylistTrack not found', async () => {
      playlistTrackRepo.findOne.mockResolvedValue(null);
      await expect(service.updatePlaylistTrack(1, 99, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeTrackFromPlaylist', () => {
    it('should remove a track from a playlist and return confirmation', async () => {
      const pt = { id: 10, seq: 1 };
      playlistTrackRepo.findOne.mockResolvedValue(pt);
      playlistTrackRepo.remove.mockResolvedValue(pt);

      const result = await service.removeTrackFromPlaylist(1, 10);
      expect(playlistTrackRepo.remove).toHaveBeenCalledWith(pt);
      expect(result).toEqual({ deleted: true, playlistTrackId: 10 });
    });

    it('should throw NotFoundException when PlaylistTrack not found', async () => {
      playlistTrackRepo.findOne.mockResolvedValue(null);
      await expect(service.removeTrackFromPlaylist(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
