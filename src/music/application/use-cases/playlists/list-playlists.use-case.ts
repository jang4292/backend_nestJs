import { Inject, Injectable } from '@nestjs/common';
import { Playlist } from '../../../entities/playlist.entity';
import { PLAYLIST_REPOSITORY_PORT } from '../../ports/playlist-repository.port';
import type { PlaylistRepositoryPort } from '../../ports/playlist-repository.port';

@Injectable()
export class ListPlaylistsUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY_PORT)
    private readonly playlistRepo: PlaylistRepositoryPort,
  ) {}

  execute(playDate?: string): Promise<Playlist[]> {
    return this.playlistRepo.findAll(playDate);
  }
}
