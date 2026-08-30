import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Artist } from '../entities/artist.entity';
import { ArtistRepositoryPort } from '../application/ports/artist-repository.port';
import { ForeignKeyConstraintError } from '../domain/music.errors';

@Injectable()
export class ArtistTypeOrmRepository implements ArtistRepositoryPort {
  constructor(
    @InjectRepository(Artist)
    private readonly repo: Repository<Artist>,
  ) {}

  findAll(): Promise<Artist[]> {
    return this.repo.find({ order: { name: 'ASC', id: 'ASC' } });
  }

  findById(id: number): Promise<Artist | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByName(name: string): Promise<Artist | null> {
    return this.repo.findOne({ where: { name } });
  }

  create(data: { name: string; description: string | null }): Artist {
    return this.repo.create(data);
  }

  save(artist: Artist): Promise<Artist> {
    return this.repo.save(artist);
  }

  async remove(artist: Artist): Promise<void> {
    try {
      await this.repo.remove(artist);
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new ForeignKeyConstraintError(
          'Cannot delete artist because tracks are linked to this artist',
        );
      }
      throw error;
    }
  }

  private isForeignKeyViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = error.driverError as { code?: unknown } | undefined;
    return driverError?.code === '23503';
  }
}
