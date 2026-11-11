import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLAYLIST_TRACK_REPOSITORY_PORT } from '../../ports/playlist-track-repository.port';
import type { PlaylistTrackRepositoryPort } from '../../ports/playlist-track-repository.port';

@Injectable()
export class RemoveTrackFromPlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_TRACK_REPOSITORY_PORT)
    private readonly playlistTrackRepo: PlaylistTrackRepositoryPort,
  ) {}

  async execute(
    playlistId: number,
    playlistTrackId: number,
  ): Promise<{ deleted: true; playlistTrackId: number }> {
    const playlistTrack = await this.playlistTrackRepo.findOneInPlaylist(
      playlistId,
      playlistTrackId,
    );
    if (!playlistTrack) {
      throw new NotFoundException('PlaylistTrack not found');
    }

    await this.playlistTrackRepo.remove(playlistTrack);
    return { deleted: true, playlistTrackId };
  }
}
