import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Track } from '../../../entities/track.entity';
import { CreateTrackDto } from '../../../interface/dto/create-track.dto';
import { ARTIST_REPOSITORY_PORT } from '../../ports/artist-repository.port';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';
import { TRACK_REPOSITORY_PORT } from '../../ports/track-repository.port';
import type { TrackRepositoryPort } from '../../ports/track-repository.port';

@Injectable()
export class CreateTrackUseCase {
  constructor(
    @Inject(TRACK_REPOSITORY_PORT)
    private readonly trackRepo: TrackRepositoryPort,
    @Inject(ARTIST_REPOSITORY_PORT)
    private readonly artistRepo: ArtistRepositoryPort,
  ) {}

  async execute(dto: CreateTrackDto): Promise<Track> {
    const artist = await this.artistRepo.findById(dto.artistId);
    if (!artist) {
      throw new NotFoundException('Artist not found');
    }

    const track = this.trackRepo.create({
      title: dto.title,
      artist,
      bpm: dto.bpm ?? null,
      lengthSec: dto.lengthSec ?? null,
    });
    return this.trackRepo.save(track);
  }
}
