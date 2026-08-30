import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ARTIST_REPOSITORY_PORT } from '../../ports/artist-repository.port';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';
import { GetArtistUseCase } from './get-artist.use-case';
import { ForeignKeyConstraintError } from '../../../domain/music.errors';

@Injectable()
export class DeleteArtistUseCase {
  constructor(
    @Inject(ARTIST_REPOSITORY_PORT)
    private readonly artistRepo: ArtistRepositoryPort,
    private readonly getArtist: GetArtistUseCase,
  ) {}

  async execute(id: number): Promise<{ deleted: true; id: number }> {
    const artist = await this.getArtist.execute(id);

    try {
      await this.artistRepo.remove(artist);
    } catch (error) {
      if (error instanceof ForeignKeyConstraintError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    return { deleted: true, id };
  }
}
