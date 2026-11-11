import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isRowReferencedError } from '../../../database/mariadb-errors';
import { ForeignKeyConstraintError } from '../../domain/music.errors';
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

  findAll(options: { skip: number; take: number }): Promise<CatalogTrack[]> {
    return this.repo.find({
      order: { id: 'DESC' },
      skip: options.skip,
      take: options.take,
    });
  }

  findById(id: number): Promise<CatalogTrack | null> {
    return this.repo.findOne({ where: { id }, relations: ['audioAssets'] });
  }

  async remove(track: CatalogTrack): Promise<void> {
    try {
      await this.repo.remove(track);
    } catch (error) {
      // playlist_track.trackId는 ON DELETE RESTRICT입니다(1764000002000 migration).
      if (isRowReferencedError(error)) {
        throw new ForeignKeyConstraintError(
          'Cannot delete track because it is used in a playlist',
        );
      }
      throw error;
    }
  }
}
