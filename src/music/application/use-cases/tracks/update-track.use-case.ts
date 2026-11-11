import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Track } from '../../../entities/track.entity';
import { UpdateTrackDto } from '../../../interface/dto/update-track.dto';
import { ARTIST_REPOSITORY_PORT } from '../../ports/artist-repository.port';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';
import { TRACK_REPOSITORY_PORT } from '../../ports/track-repository.port';
import type { TrackRepositoryPort } from '../../ports/track-repository.port';
import { GetTrackUseCase } from './get-track.use-case';

@Injectable()
export class UpdateTrackUseCase {
  constructor(
    @Inject(TRACK_REPOSITORY_PORT)
    private readonly trackRepo: TrackRepositoryPort,
    @Inject(ARTIST_REPOSITORY_PORT)
    private readonly artistRepo: ArtistRepositoryPort,
    private readonly getTrack: GetTrackUseCase,
  ) {}

  async execute(id: number, dto: UpdateTrackDto): Promise<Track> {
    const track = await this.getTrack.execute(id);

    if (dto.artistId !== undefined) {
      const artist = await this.artistRepo.findById(dto.artistId);
      if (!artist) {
        throw new NotFoundException('Artist not found');
      }
      track.artist = artist;
    }

    Object.assign(track, {
      title: dto.title ?? track.title,
      bpm: dto.bpm ?? track.bpm,
      lengthSec: dto.lengthSec ?? track.lengthSec,
    });

    return this.trackRepo.save(track);
  }
}
