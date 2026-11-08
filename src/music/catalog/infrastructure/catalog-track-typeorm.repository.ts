import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CatalogTrackRepositoryPort } from '../application/ports/catalog-track-repository.port';
import { CatalogTrack } from '../entities/catalog-track.entity';

@Injectable()
export class CatalogTrackTypeOrmRepository implements CatalogTrackRepositoryPort {
  constructor(
    @InjectRepository(CatalogTrack)
    private readonly repo: Repository<CatalogTrack>,
  ) {}

  create(data: {
    title: string;
    artist: string;
    bpm: number | null;
  }): CatalogTrack {
    return this.repo.create(data);
  }

  save(track: CatalogTrack): Promise<CatalogTrack> {
    return this.repo.save(track);
  }

  findAll(): Promise<CatalogTrack[]> {
    return this.repo.find({ order: { id: 'DESC' } });
  }

  findById(id: number): Promise<CatalogTrack | null> {
    return this.repo.findOne({ where: { id }, relations: ['audioAssets'] });
  }

  async remove(track: CatalogTrack): Promise<void> {
    await this.repo.remove(track);
  }
}
