import { Inject, Injectable } from '@nestjs/common';
import { Artist } from '../../../entities/artist.entity';
import { ARTIST_REPOSITORY_PORT } from '../../ports/artist-repository.port';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';

@Injectable()
export class ListArtistsUseCase {
  constructor(
    @Inject(ARTIST_REPOSITORY_PORT)
    private readonly artistRepo: ArtistRepositoryPort,
  ) {}

  execute(): Promise<Artist[]> {
    return this.artistRepo.findAll();
  }
}
