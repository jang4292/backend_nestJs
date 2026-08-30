import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Artist } from '../../../entities/artist.entity';
import { CreateArtistDto } from '../../../interface/dto/create-artist.dto';
import { ARTIST_REPOSITORY_PORT } from '../../ports/artist-repository.port';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';

@Injectable()
export class CreateArtistUseCase {
  constructor(
    @Inject(ARTIST_REPOSITORY_PORT)
    private readonly artistRepo: ArtistRepositoryPort,
  ) {}

  async execute(dto: CreateArtistDto): Promise<Artist> {
    const duplicate = await this.artistRepo.findByName(dto.name);
    if (duplicate) {
      throw new ConflictException('Artist already exists');
    }

    const artist = this.artistRepo.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.artistRepo.save(artist);
  }
}
