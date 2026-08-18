import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePlaylistDto } from '../dto/create-playlist.dto';
import { UpdatePlaylistDto } from '../dto/update-playlist.dto';
import { Playlist } from '../entities/playlist.entity';

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist)
    private readonly playlistRepo: Repository<Playlist>,
  ) {}

  async createPlaylist(dto: CreatePlaylistDto): Promise<Playlist> {
    const playlist = this.playlistRepo.create({
      name: dto.name,
      playDate: dto.playDate ?? null,
      description: dto.description ?? null,
    });
    return this.playlistRepo.save(playlist);
  }

  async getPlaylistList(playDate?: string): Promise<Playlist[]> {
    if (playDate) {
      return this.playlistRepo.find({
        where: { playDate },
        order: { playDate: 'DESC', id: 'DESC' },
      });
    }

    return this.playlistRepo.find({
      order: { playDate: 'DESC', id: 'DESC' },
    });
  }

  async getPlaylist(id: number): Promise<Playlist> {
    const playlist = await this.playlistRepo.findOne({
      where: { id },
      relations: ['playlistTracks', 'playlistTracks.track'],
      order: { playlistTracks: { seq: 'ASC' } },
    });

    if (!playlist) throw new NotFoundException('Playlist not found');
    return playlist;
  }

  async getPlaylistEntity(id: number): Promise<Playlist> {
    const playlist = await this.playlistRepo.findOne({ where: { id } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    return playlist;
  }

  async getPlaylistByDate(playDate: string): Promise<Playlist> {
    const playlist = await this.playlistRepo.findOne({
      where: { playDate },
    });
    if (!playlist) {
      throw new NotFoundException('Playlist not found for that date');
    }
    return this.getPlaylist(playlist.id);
  }

  async updatePlaylist(id: number, dto: UpdatePlaylistDto): Promise<Playlist> {
    const playlist = await this.getPlaylistEntity(id);

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

  async deletePlaylist(id: number): Promise<{ deleted: true; id: number }> {
    const playlist = await this.getPlaylistEntity(id);
    await this.playlistRepo.remove(playlist);
    return { deleted: true, id };
  }
}
