import { Inject, Injectable } from '@nestjs/common';
import { ARTIST_REPOSITORY_PORT } from '../../ports/artist-repository.port';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';
import { GetArtistUseCase } from './get-artist.use-case';

@Injectable()
export class DeleteArtistUseCase {
  constructor(
    @Inject(ARTIST_REPOSITORY_PORT)
    private readonly artistRepo: ArtistRepositoryPort,
    private readonly getArtist: GetArtistUseCase,
  ) {}

  /**
   * 연결된 track이 있으면 repository가 ForeignKeyConstraintError(409)를 던집니다.
   */
  async execute(id: number): Promise<{ deleted: true; id: number }> {
    const artist = await this.getArtist.execute(id);
    await this.artistRepo.remove(artist);
    return { deleted: true, id };
  }
}
