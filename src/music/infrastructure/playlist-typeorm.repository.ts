import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistRepositoryPort } from '../application/ports/playlist-repository.port';

@Injectable()
export class PlaylistTypeOrmRepository implements PlaylistRepositoryPort {
  constructor(
    @InjectRepository(Playlist)
    private readonly repo: Repository<Playlist>,
  ) {}

  create(data: {
    name: string;
    playDate: string | null;
    description: string | null;
  }): Playlist {
    return this.repo.create(data);
  }

  save(playlist: Playlist): Promise<Playlist> {
    return this.repo.save(playlist);
  }

  async remove(playlist: Playlist): Promise<void> {
    await this.repo.remove(playlist);
  }

  findById(id: number): Promise<Playlist | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByIdWithTracks(id: number): Promise<Playlist | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['playlistTracks', 'playlistTracks.track'],
      order: { playlistTracks: { seq: 'ASC' } },
    });
  }

  findByPlayDate(playDate: string): Promise<Playlist | null> {
    return this.repo.findOne({ where: { playDate } });
  }

  findAll(playDate?: string): Promise<Playlist[]> {
    if (playDate) {
      return this.repo.find({
        where: { playDate },
        order: { playDate: 'DESC', id: 'DESC' },
      });
    }
    return this.repo.find({ order: { playDate: 'DESC', id: 'DESC' } });
  }
}
