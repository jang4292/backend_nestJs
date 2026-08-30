import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLAYLIST_REPOSITORY_PORT } from '../../ports/playlist-repository.port';
import type { PlaylistRepositoryPort } from '../../ports/playlist-repository.port';

@Injectable()
export class DeletePlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY_PORT)
    private readonly playlistRepo: PlaylistRepositoryPort,
  ) {}

  async execute(id: number): Promise<{ deleted: true; id: number }> {
    const playlist = await this.playlistRepo.findById(id);
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }
    await this.playlistRepo.remove(playlist);
    return { deleted: true, id };
  }
}
