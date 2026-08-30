import { Injectable } from '@nestjs/common';
import { AddTrackToPlaylistDto } from './interface/dto/add-track-to-playlist.dto';
import { CreatePlaylistDto } from './interface/dto/create-playlist.dto';
import { CreateTrackDto } from './interface/dto/create-track.dto';
import { ListTracksQueryDto } from './interface/dto/list-tracks-query.dto';
import { UpdatePlaylistTrackDto } from './interface/dto/update-playlist-track.dto';
import { UpdatePlaylistDto } from './interface/dto/update-playlist.dto';
import { UpdateTrackDto } from './interface/dto/update-track.dto';
import { Artist } from './entities/artist.entity';
import { PlaylistTrack } from './entities/playlist-track.entity';
import { Playlist } from './entities/playlist.entity';
import { Track } from './entities/track.entity';
import { CreateArtistDto } from './interface/dto/create-artist.dto';
import { UpdateArtistDto } from './interface/dto/update-artist.dto';

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
import { PaginatedTracks } from './application/ports/track-repository.port';

import { CreatePlaylistUseCase } from './application/use-cases/playlists/create-playlist.use-case';
import { ListPlaylistsUseCase } from './application/use-cases/playlists/list-playlists.use-case';
import { GetPlaylistUseCase } from './application/use-cases/playlists/get-playlist.use-case';
import { GetPlaylistByDateUseCase } from './application/use-cases/playlists/get-playlist-by-date.use-case';
import { UpdatePlaylistUseCase } from './application/use-cases/playlists/update-playlist.use-case';
import { DeletePlaylistUseCase } from './application/use-cases/playlists/delete-playlist.use-case';

import {
  ListPlaylistTracksUseCase,
  PlaylistTrackSummary,
} from './application/use-cases/playlist-tracks/list-playlist-tracks.use-case';
import { AddTrackToPlaylistUseCase } from './application/use-cases/playlist-tracks/add-track-to-playlist.use-case';
import { UpdatePlaylistTrackUseCase } from './application/use-cases/playlist-tracks/update-playlist-track.use-case';
import { RemoveTrackFromPlaylistUseCase } from './application/use-cases/playlist-tracks/remove-track-from-playlist.use-case';

/** Thin facade over the music use-cases, kept so the controller needs no changes. */
@Injectable()
export class MusicService {
  constructor(
    private readonly listArtistsUseCase: ListArtistsUseCase,
    private readonly getArtistUseCase: GetArtistUseCase,
    private readonly createArtistUseCase: CreateArtistUseCase,
    private readonly updateArtistUseCase: UpdateArtistUseCase,
    private readonly deleteArtistUseCase: DeleteArtistUseCase,
    private readonly createTrackUseCase: CreateTrackUseCase,
    private readonly listTracksUseCase: ListTracksUseCase,
    private readonly getTrackUseCase: GetTrackUseCase,
    private readonly updateTrackUseCase: UpdateTrackUseCase,
    private readonly deleteTrackUseCase: DeleteTrackUseCase,
    private readonly createPlaylistUseCase: CreatePlaylistUseCase,
    private readonly listPlaylistsUseCase: ListPlaylistsUseCase,
    private readonly getPlaylistUseCase: GetPlaylistUseCase,
    private readonly getPlaylistByDateUseCase: GetPlaylistByDateUseCase,
    private readonly updatePlaylistUseCase: UpdatePlaylistUseCase,
    private readonly deletePlaylistUseCase: DeletePlaylistUseCase,
    private readonly listPlaylistTracksUseCase: ListPlaylistTracksUseCase,
    private readonly addTrackToPlaylistUseCase: AddTrackToPlaylistUseCase,
    private readonly updatePlaylistTrackUseCase: UpdatePlaylistTrackUseCase,
    private readonly removeTrackFromPlaylistUseCase: RemoveTrackFromPlaylistUseCase,
  ) {}

  getArtistList(): Promise<Artist[]> {
    return this.listArtistsUseCase.execute();
  }

  getArtist(id: number): Promise<Artist> {
    return this.getArtistUseCase.execute(id);
  }

  createArtist(dto: CreateArtistDto): Promise<Artist> {
    return this.createArtistUseCase.execute(dto);
  }

  updateArtist(id: number, dto: UpdateArtistDto): Promise<Artist> {
    return this.updateArtistUseCase.execute(id, dto);
  }

  deleteArtist(id: number): Promise<{ deleted: true; id: number }> {
    return this.deleteArtistUseCase.execute(id);
  }

  createTrack(dto: CreateTrackDto): Promise<Track> {
    return this.createTrackUseCase.execute(dto);
  }

  getTrackList(query: ListTracksQueryDto): Promise<PaginatedTracks> {
    return this.listTracksUseCase.execute(query);
  }

  getTrack(id: number): Promise<Track> {
    return this.getTrackUseCase.execute(id);
  }

  updateTrack(id: number, dto: UpdateTrackDto): Promise<Track> {
    return this.updateTrackUseCase.execute(id, dto);
  }

  deleteTrack(id: number): Promise<{ deleted: true; id: number }> {
    return this.deleteTrackUseCase.execute(id);
  }

  createPlaylist(dto: CreatePlaylistDto): Promise<Playlist> {
    return this.createPlaylistUseCase.execute(dto);
  }

  getPlaylistList(playDate?: string): Promise<Playlist[]> {
    return this.listPlaylistsUseCase.execute(playDate);
  }

  getPlaylist(id: number): Promise<Playlist> {
    return this.getPlaylistUseCase.execute(id);
  }

  getPlaylistByDate(playDate: string): Promise<Playlist> {
    return this.getPlaylistByDateUseCase.execute(playDate);
  }

  updatePlaylist(id: number, dto: UpdatePlaylistDto): Promise<Playlist> {
    return this.updatePlaylistUseCase.execute(id, dto);
  }

  deletePlaylist(id: number): Promise<{ deleted: true; id: number }> {
    return this.deletePlaylistUseCase.execute(id);
  }

  getTracksOfPlaylist(playlistId: number): Promise<PlaylistTrackSummary[]> {
    return this.listPlaylistTracksUseCase.execute(playlistId);
  }

  addTrackToPlaylist(
    playlistId: number,
    dto: AddTrackToPlaylistDto,
  ): Promise<PlaylistTrack> {
    return this.addTrackToPlaylistUseCase.execute(playlistId, dto);
  }

  updatePlaylistTrack(
    playlistId: number,
    playlistTrackId: number,
    dto: UpdatePlaylistTrackDto,
  ): Promise<PlaylistTrack> {
    return this.updatePlaylistTrackUseCase.execute(
      playlistId,
      playlistTrackId,
      dto,
    );
  }

  removeTrackFromPlaylist(
    playlistId: number,
    playlistTrackId: number,
  ): Promise<{ deleted: true; playlistTrackId: number }> {
    return this.removeTrackFromPlaylistUseCase.execute(
      playlistId,
      playlistTrackId,
    );
  }
}
