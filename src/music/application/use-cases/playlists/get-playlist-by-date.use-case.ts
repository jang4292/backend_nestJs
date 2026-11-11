import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Playlist } from '../../../entities/playlist.entity';
import { PLAYLIST_REPOSITORY_PORT } from '../../ports/playlist-repository.port';
import type { PlaylistRepositoryPort } from '../../ports/playlist-repository.port';
import { GetPlaylistUseCase } from './get-playlist.use-case';

@Injectable()
export class GetPlaylistByDateUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY_PORT)
    private readonly playlistRepo: PlaylistRepositoryPort,
    private readonly getPlaylist: GetPlaylistUseCase,
  ) {}

  async execute(playDate: string): Promise<Playlist> {
    const playlist = await this.playlistRepo.findByPlayDate(playDate);
    if (!playlist) {
      throw new NotFoundException('Playlist not found for that date');
    }
    return this.getPlaylist.execute(playlist.id);
  }
}
