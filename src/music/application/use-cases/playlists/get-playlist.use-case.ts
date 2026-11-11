import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Playlist } from '../../../entities/playlist.entity';
import { PLAYLIST_REPOSITORY_PORT } from '../../ports/playlist-repository.port';
import type { PlaylistRepositoryPort } from '../../ports/playlist-repository.port';

@Injectable()
export class GetPlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY_PORT)
    private readonly playlistRepo: PlaylistRepositoryPort,
  ) {}

  async execute(id: number): Promise<Playlist> {
    const playlist = await this.playlistRepo.findByIdWithTracks(id);
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }
    return playlist;
  }
}
