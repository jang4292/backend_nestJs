import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddTrackToPlaylistDto } from '../dto/add-track-to-playlist.dto';
import { UpdatePlaylistTrackDto } from '../dto/update-playlist-track.dto';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { PlaylistsService } from './playlists.service';
import { TracksService } from './tracks.service';

export interface PlaylistTrackSummary {
  playlistTrackId: number;
  seq: number;
  note: string | null;
  track: {
    id: number;
    title: string;
    artist: string;
    bpm: number | null;
    lengthSec: number | null;
  };
}

@Injectable()
export class PlaylistTracksService {
  constructor(
    @InjectRepository(PlaylistTrack)
    private readonly playlistTrackRepo: Repository<PlaylistTrack>,
    private readonly playlistsService: PlaylistsService,
    private readonly tracksService: TracksService,
  ) {}

  async getTracksOfPlaylist(
    playlistId: number,
  ): Promise<PlaylistTrackSummary[]> {
    await this.playlistsService.getPlaylistEntity(playlistId);

    const playlistTracks = await this.playlistTrackRepo.find({
      where: { playlist: { id: playlistId } },
      relations: ['track', 'track.artist'],
      order: { seq: 'ASC' },
    });

    return playlistTracks.map((playlistTrack) => ({
      playlistTrackId: playlistTrack.id,
      seq: playlistTrack.seq,
      note: playlistTrack.note,
      track: {
        id: playlistTrack.track.id,
        title: playlistTrack.track.title,
        artist: playlistTrack.track.artist.name,
        bpm: playlistTrack.track.bpm,
        lengthSec: playlistTrack.track.lengthSec,
      },
    }));
  }

  async addTrackToPlaylist(
    playlistId: number,
    dto: AddTrackToPlaylistDto,
  ): Promise<PlaylistTrack> {
    const playlist = await this.playlistsService.getPlaylistEntity(playlistId);
    const track = await this.tracksService.getTrack(dto.trackId);

    const playlistTrack = this.playlistTrackRepo.create({
      playlist,
      track,
      seq: dto.seq,
      note: dto.note ?? null,
    });
    return this.playlistTrackRepo.save(playlistTrack);
  }

  async updatePlaylistTrack(
    playlistId: number,
    playlistTrackId: number,
    dto: UpdatePlaylistTrackDto,
  ): Promise<PlaylistTrack> {
    const playlistTrack = await this.playlistTrackRepo.findOne({
      where: { id: playlistTrackId, playlist: { id: playlistId } },
    });
    if (!playlistTrack) {
      throw new NotFoundException('PlaylistTrack not found');
    }

    if (dto.seq !== undefined) playlistTrack.seq = dto.seq;
    if (dto.note !== undefined) playlistTrack.note = dto.note;

    return this.playlistTrackRepo.save(playlistTrack);
  }

  async removeTrackFromPlaylist(
    playlistId: number,
    playlistTrackId: number,
  ): Promise<{ deleted: true; playlistTrackId: number }> {
    const playlistTrack = await this.playlistTrackRepo.findOne({
      where: { id: playlistTrackId, playlist: { id: playlistId } },
    });
    if (!playlistTrack) {
      throw new NotFoundException('PlaylistTrack not found');
    }

    await this.playlistTrackRepo.remove(playlistTrack);
    return { deleted: true, playlistTrackId };
  }
}
