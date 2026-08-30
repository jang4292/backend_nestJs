import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlaylistTrack } from '../../../entities/playlist-track.entity';
import { AddTrackToPlaylistDto } from '../../../interface/dto/add-track-to-playlist.dto';
import { PLAYLIST_REPOSITORY_PORT } from '../../ports/playlist-repository.port';
import type { PlaylistRepositoryPort } from '../../ports/playlist-repository.port';
import { PLAYLIST_TRACK_REPOSITORY_PORT } from '../../ports/playlist-track-repository.port';
import type { PlaylistTrackRepositoryPort } from '../../ports/playlist-track-repository.port';
import { TRACK_REPOSITORY_PORT } from '../../ports/track-repository.port';
import type { TrackRepositoryPort } from '../../ports/track-repository.port';

@Injectable()
export class AddTrackToPlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY_PORT)
    private readonly playlistRepo: PlaylistRepositoryPort,
    @Inject(TRACK_REPOSITORY_PORT)
    private readonly trackRepo: TrackRepositoryPort,
    @Inject(PLAYLIST_TRACK_REPOSITORY_PORT)
    private readonly playlistTrackRepo: PlaylistTrackRepositoryPort,
  ) {}

  async execute(
    playlistId: number,
    dto: AddTrackToPlaylistDto,
  ): Promise<PlaylistTrack> {
    const playlist = await this.playlistRepo.findById(playlistId);
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    const track = await this.trackRepo.findById(dto.trackId);
    if (!track) {
      throw new NotFoundException('Track not found');
    }

    const playlistTrack = this.playlistTrackRepo.create({
      playlist,
      track,
      seq: dto.seq,
      note: dto.note ?? null,
    });
    return this.playlistTrackRepo.save(playlistTrack);
  }
}
