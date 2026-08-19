import { Injectable } from '@nestjs/common';
import { AddTrackToPlaylistDto } from './dto/add-track-to-playlist.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { CreateTrackDto } from './dto/create-track.dto';
import { ListTracksQueryDto } from './dto/list-tracks-query.dto';
import { UpdatePlaylistTrackDto } from './dto/update-playlist-track.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { PlaylistTrack } from './entities/playlist-track.entity';
import { Playlist } from './entities/playlist.entity';
import { Track } from './entities/track.entity';
import {
  PlaylistTracksService,
  PlaylistTrackSummary,
} from './services/playlist-tracks.service';
import { PlaylistsService } from './services/playlists.service';
import { PaginatedTracks, TracksService } from './services/tracks.service';

@Injectable()
export class MusicService {
  constructor(
    private readonly tracksService: TracksService,
    private readonly playlistsService: PlaylistsService,
    private readonly playlistTracksService: PlaylistTracksService,
  ) {}

  createTrack(dto: CreateTrackDto): Promise<Track> {
    return this.tracksService.createTrack(dto);
  }

  getTrackList(query: ListTracksQueryDto): Promise<PaginatedTracks> {
    return this.tracksService.getTrackList(query);
  }

  getTrack(id: number): Promise<Track> {
    return this.tracksService.getTrack(id);
  }

  updateTrack(id: number, dto: UpdateTrackDto): Promise<Track> {
    return this.tracksService.updateTrack(id, dto);
  }

  deleteTrack(id: number): Promise<{ deleted: true; id: number }> {
    return this.tracksService.deleteTrack(id);
  }

  createPlaylist(dto: CreatePlaylistDto): Promise<Playlist> {
    return this.playlistsService.createPlaylist(dto);
  }

  getPlaylistList(playDate?: string): Promise<Playlist[]> {
    return this.playlistsService.getPlaylistList(playDate);
  }

  getPlaylist(id: number): Promise<Playlist> {
    return this.playlistsService.getPlaylist(id);
  }

  getPlaylistByDate(playDate: string): Promise<Playlist> {
    return this.playlistsService.getPlaylistByDate(playDate);
  }

  updatePlaylist(id: number, dto: UpdatePlaylistDto): Promise<Playlist> {
    return this.playlistsService.updatePlaylist(id, dto);
  }

  deletePlaylist(id: number): Promise<{ deleted: true; id: number }> {
    return this.playlistsService.deletePlaylist(id);
  }

  getTracksOfPlaylist(playlistId: number): Promise<PlaylistTrackSummary[]> {
    return this.playlistTracksService.getTracksOfPlaylist(playlistId);
  }

  addTrackToPlaylist(
    playlistId: number,
    dto: AddTrackToPlaylistDto,
  ): Promise<PlaylistTrack> {
    return this.playlistTracksService.addTrackToPlaylist(playlistId, dto);
  }

  updatePlaylistTrack(
    playlistId: number,
    playlistTrackId: number,
    dto: UpdatePlaylistTrackDto,
  ): Promise<PlaylistTrack> {
    return this.playlistTracksService.updatePlaylistTrack(
      playlistId,
      playlistTrackId,
      dto,
    );
  }

  removeTrackFromPlaylist(
    playlistId: number,
    playlistTrackId: number,
  ): Promise<{ deleted: true; playlistTrackId: number }> {
    return this.playlistTracksService.removeTrackFromPlaylist(
      playlistId,
      playlistTrackId,
    );
  }
}
