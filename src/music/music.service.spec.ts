import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { MusicService } from './music.service';
import { Artist } from './entities/artist.entity';
import { Track } from './entities/track.entity';
import { Playlist } from './entities/playlist.entity';
import { PlaylistTrack } from './entities/playlist-track.entity';

import { ARTIST_REPOSITORY_PORT } from './application/ports/artist-repository.port';
import { TRACK_REPOSITORY_PORT } from './application/ports/track-repository.port';
import { PLAYLIST_REPOSITORY_PORT } from './application/ports/playlist-repository.port';
import { PLAYLIST_TRACK_REPOSITORY_PORT } from './application/ports/playlist-track-repository.port';

import { ArtistTypeOrmRepository } from './infrastructure/artist-typeorm.repository';
import { TrackTypeOrmRepository } from './infrastructure/track-typeorm.repository';
import { PlaylistTypeOrmRepository } from './infrastructure/playlist-typeorm.repository';
import { PlaylistTrackTypeOrmRepository } from './infrastructure/playlist-track-typeorm.repository';

import { ListArtistsUseCase } from './application/use-cases/artists/list-artists.use-case';
import { GetArtistUseCase } from './application/use-cases/artists/get-artist.use-case';
import { CreateArtistUseCase } from './application/use-cases/artists/create-artist.use-case';
import { UpdateArtistUseCase } from './application/use-cases/artists/update-artist.use-case';
import { DeleteArtistUseCase } from './application/use-cases/artists/delete-artist.use-case';

import { CreateTrackUseCase } from './application/use-cases/tracks/create-track.use-case';
import { ListTracksUseCase } from './application/use-cases/tracks/list-tracks.use-case';
import { GetTrackUseCase } from './application/use-cases/tracks/get-track.use-case';
import { UpdateTrackUseCase } from './application/use-cases/tracks/update-track.use-case';
import { DeleteTrackUseCase } from './application/use-cases/tracks/delete-track.use-case';

import { CreatePlaylistUseCase } from './application/use-cases/playlists/create-playlist.use-case';
import { ListPlaylistsUseCase } from './application/use-cases/playlists/list-playlists.use-case';
import { GetPlaylistUseCase } from './application/use-cases/playlists/get-playlist.use-case';
import { GetPlaylistByDateUseCase } from './application/use-cases/playlists/get-playlist-by-date.use-case';
import { UpdatePlaylistUseCase } from './application/use-cases/playlists/update-playlist.use-case';
import { DeletePlaylistUseCase } from './application/use-cases/playlists/delete-playlist.use-case';

import { ListPlaylistTracksUseCase } from './application/use-cases/playlist-tracks/list-playlist-tracks.use-case';
import { AddTrackToPlaylistUseCase } from './application/use-cases/playlist-tracks/add-track-to-playlist.use-case';
import { UpdatePlaylistTrackUseCase } from './application/use-cases/playlist-tracks/update-playlist-track.use-case';
import { RemoveTrackFromPlaylistUseCase } from './application/use-cases/playlist-tracks/remove-track-from-playlist.use-case';

const mockQueryBuilder = () => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
});

const mockTrackRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockArtistRepo = () => ({
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
  let artistRepo: ReturnType<typeof mockArtistRepo>;
  let trackRepo: ReturnType<typeof mockTrackRepo>;
  let playlistRepo: ReturnType<typeof mockPlaylistRepo>;
  let playlistTrackRepo: ReturnType<typeof mockPlaylistTrackRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicService,

        ArtistTypeOrmRepository,
        { provide: ARTIST_REPOSITORY_PORT, useExisting: ArtistTypeOrmRepository },
        TrackTypeOrmRepository,
        { provide: TRACK_REPOSITORY_PORT, useExisting: TrackTypeOrmRepository },
        PlaylistTypeOrmRepository,
        {
          provide: PLAYLIST_REPOSITORY_PORT,
          useExisting: PlaylistTypeOrmRepository,
        },
        PlaylistTrackTypeOrmRepository,
        {
          provide: PLAYLIST_TRACK_REPOSITORY_PORT,
          useExisting: PlaylistTrackTypeOrmRepository,
        },

        ListArtistsUseCase,
        GetArtistUseCase,
        CreateArtistUseCase,
        UpdateArtistUseCase,
        DeleteArtistUseCase,

        CreateTrackUseCase,
        ListTracksUseCase,
        GetTrackUseCase,
        UpdateTrackUseCase,
        DeleteTrackUseCase,

        CreatePlaylistUseCase,
        ListPlaylistsUseCase,
        GetPlaylistUseCase,
        GetPlaylistByDateUseCase,
        UpdatePlaylistUseCase,
        DeletePlaylistUseCase,

        ListPlaylistTracksUseCase,
        AddTrackToPlaylistUseCase,
        UpdatePlaylistTrackUseCase,
        RemoveTrackFromPlaylistUseCase,

        { provide: getRepositoryToken(Artist), useFactory: mockArtistRepo },
        { provide: getRepositoryToken(Track), useFactory: mockTrackRepo },
        { provide: getRepositoryToken(Playlist), useFactory: mockPlaylistRepo },
        {
          provide: getRepositoryToken(PlaylistTrack),
          useFactory: mockPlaylistTrackRepo,
        },
      ],
    }).compile();

    service = module.get<MusicService>(MusicService);
    artistRepo = module.get(getRepositoryToken(Artist));
    trackRepo = module.get(getRepositoryToken(Track));
    playlistRepo = module.get(getRepositoryToken(Playlist));
    playlistTrackRepo = module.get(getRepositoryToken(PlaylistTrack));
  });

  // ===== Artist (see application/use-cases/artists/*.spec.ts for full coverage) =====

  describe('artist operations', () => {
    it('should list artists', async () => {
      const artists = [{ id: 1, name: 'Artist X', description: null }];
      artistRepo.find.mockResolvedValue(artists);

      const result = await service.getArtistList();
      expect(result).toEqual(artists);
    });

    it('should create artist', async () => {
      const dto = { name: 'Artist X' };
      artistRepo.findOne.mockResolvedValue(null);
      artistRepo.create.mockReturnValue({ id: 1, ...dto, description: null });
      artistRepo.save.mockResolvedValue({ id: 1, ...dto, description: null });

      const result = await service.createArtist(dto);
      expect(result).toHaveProperty('name', 'Artist X');
    });
  });

  // ===== Track =====

  describe('createTrack', () => {
    it('should create and save a track', async () => {
      const artist = { id: 1, name: 'Artist X' };
      const dto = { title: 'Song A', artistId: 1, bpm: 120 };
      const created = { id: 1, title: dto.title, artist, bpm: 120 };
      artistRepo.findOne.mockResolvedValue(artist);
      trackRepo.create.mockReturnValue(created);
      trackRepo.save.mockResolvedValue(created);

      const result = await service.createTrack(dto);

      expect(trackRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Song A', artist }),
      );
      expect(trackRepo.save).toHaveBeenCalledWith(created);
      expect(result).toEqual(created);
    });
  });

  describe('getTrackList', () => {
    it('should apply search/filter conditions and return paginated result', async () => {
      const qb = mockQueryBuilder();
      const items = [
        {
          id: 1,
          title: 'Song A',
          artist: { id: 1, name: 'Artist X' },
          bpm: 120,
        },
      ];
      qb.getManyAndCount.mockResolvedValue([items, 1]);
      trackRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getTrackList({
        search: 'Song',
        minBpm: 100,
        maxBpm: 140,
        page: 1,
        limit: 10,
        sortBy: 'id',
        sortOrder: 'DESC',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(track.title ILIKE :search OR artist.name ILIKE :search)',
        { search: '%Song%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('track.bpm >= :minBpm', {
        minBpm: 100,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('track.bpm <= :maxBpm', {
        maxBpm: 140,
      });
      expect(qb.orderBy).toHaveBeenCalledWith('track.id', 'DESC');
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({ items, total: 1, page: 1, limit: 10 });
    });

    it('should default to page 1 and limit 20 when not provided', async () => {
      const qb = mockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      trackRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getTrackList({});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    });
  });

  describe('getTrack', () => {
    it('should return a track by id', async () => {
      const track = {
        id: 1,
        title: 'Song A',
        artist: { id: 1, name: 'Artist X' },
      };
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
      const artist = { id: 1, name: 'Artist X' };
      const track = { id: 1, title: 'Old', artist, bpm: 100 };
      const dto = { title: 'New Title' };
      trackRepo.findOne.mockResolvedValue(track);
      trackRepo.save.mockResolvedValue({ ...track, ...dto });

      const result = await service.updateTrack(1, dto);
      expect(result.title).toBe('New Title');
    });
  });

  describe('deleteTrack', () => {
    it('should delete a track and return confirmation', async () => {
      const track = {
        id: 1,
        title: 'Song A',
        artist: { id: 1, name: 'Artist X' },
      };
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
      const track = {
        id: 2,
        title: 'Song A',
        artist: { id: 1, name: 'Artist X' },
      };
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
