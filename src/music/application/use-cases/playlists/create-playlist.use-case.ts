import { Inject, Injectable } from '@nestjs/common';
import { Playlist } from '../../../entities/playlist.entity';
import { CreatePlaylistDto } from '../../../interface/dto/create-playlist.dto';
import { PLAYLIST_REPOSITORY_PORT } from '../../ports/playlist-repository.port';
import type { PlaylistRepositoryPort } from '../../ports/playlist-repository.port';

@Injectable()
export class CreatePlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY_PORT)
    private readonly playlistRepo: PlaylistRepositoryPort,
  ) {}

  async execute(dto: CreatePlaylistDto): Promise<Playlist> {
    const playlist = this.playlistRepo.create({
      name: dto.name,
      playDate: dto.playDate ?? null,
      description: dto.description ?? null,
    });
    return this.playlistRepo.save(playlist);
  }
}
