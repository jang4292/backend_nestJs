import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Artist } from '../../../entities/artist.entity';
import { UpdateArtistDto } from '../../../interface/dto/update-artist.dto';
import { ARTIST_REPOSITORY_PORT } from '../../ports/artist-repository.port';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';
import { GetArtistUseCase } from './get-artist.use-case';

@Injectable()
export class UpdateArtistUseCase {
  constructor(
    @Inject(ARTIST_REPOSITORY_PORT)
    private readonly artistRepo: ArtistRepositoryPort,
    private readonly getArtist: GetArtistUseCase,
  ) {}

  async execute(id: number, dto: UpdateArtistDto): Promise<Artist> {
    const artist = await this.getArtist.execute(id);

    if (dto.name && dto.name !== artist.name) {
      const duplicate = await this.artistRepo.findByName(dto.name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Artist already exists');
      }
    }

    Object.assign(artist, {
      name: dto.name ?? artist.name,
      description:
        dto.description !== undefined
          ? (dto.description ?? null)
          : artist.description,
    });

    return this.artistRepo.save(artist);
  }
}
