import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlaylistTrack } from '../../../entities/playlist-track.entity';
import { UpdatePlaylistTrackDto } from '../../../interface/dto/update-playlist-track.dto';
import { PLAYLIST_TRACK_REPOSITORY_PORT } from '../../ports/playlist-track-repository.port';
import type { PlaylistTrackRepositoryPort } from '../../ports/playlist-track-repository.port';

@Injectable()
export class UpdatePlaylistTrackUseCase {
  constructor(
    @Inject(PLAYLIST_TRACK_REPOSITORY_PORT)
    private readonly playlistTrackRepo: PlaylistTrackRepositoryPort,
  ) {}

  async execute(
    playlistId: number,
    playlistTrackId: number,
    dto: UpdatePlaylistTrackDto,
  ): Promise<PlaylistTrack> {
    const playlistTrack = await this.playlistTrackRepo.findOneInPlaylist(
      playlistId,
      playlistTrackId,
    );
    if (!playlistTrack) {
      throw new NotFoundException('PlaylistTrack not found');
    }

    if (dto.seq !== undefined) playlistTrack.seq = dto.seq;
    if (dto.note !== undefined) playlistTrack.note = dto.note;

    return this.playlistTrackRepo.save(playlistTrack);
  }
}
