import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Playlist } from '../../../entities/playlist.entity';
import { UpdatePlaylistDto } from '../../../interface/dto/update-playlist.dto';
import { PLAYLIST_REPOSITORY_PORT } from '../../ports/playlist-repository.port';
import type { PlaylistRepositoryPort } from '../../ports/playlist-repository.port';

@Injectable()
export class UpdatePlaylistUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY_PORT)
    private readonly playlistRepo: PlaylistRepositoryPort,
  ) {}

  async execute(id: number, dto: UpdatePlaylistDto): Promise<Playlist> {
    const playlist = await this.playlistRepo.findById(id);
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    Object.assign(playlist, {
      name: dto.name ?? playlist.name,
      playDate:
        dto.playDate !== undefined ? (dto.playDate ?? null) : playlist.playDate,
      description:
        dto.description !== undefined
          ? (dto.description ?? null)
          : playlist.description,
    });

    return this.playlistRepo.save(playlist);
  }
}
