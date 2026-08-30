import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Track } from '../../../entities/track.entity';
import { TRACK_REPOSITORY_PORT } from '../../ports/track-repository.port';
import type { TrackRepositoryPort } from '../../ports/track-repository.port';

@Injectable()
export class GetTrackUseCase {
  constructor(
    @Inject(TRACK_REPOSITORY_PORT)
    private readonly trackRepo: TrackRepositoryPort,
  ) {}

  async execute(id: number): Promise<Track> {
    const track = await this.trackRepo.findById(id);
    if (!track) {
      throw new NotFoundException('Track not found');
    }
    return track;
  }
}
