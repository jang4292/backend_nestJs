import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Artist } from '../../../entities/artist.entity';
import { ARTIST_REPOSITORY_PORT } from '../../ports/artist-repository.port';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';

@Injectable()
export class GetArtistUseCase {
  constructor(
    @Inject(ARTIST_REPOSITORY_PORT)
    private readonly artistRepo: ArtistRepositoryPort,
  ) {}

  async execute(id: number): Promise<Artist> {
    const artist = await this.artistRepo.findById(id);
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }
    return artist;
  }
}
