import { Inject, Injectable } from '@nestjs/common';
import { TRACK_REPOSITORY_PORT } from '../../ports/track-repository.port';
import type { TrackRepositoryPort } from '../../ports/track-repository.port';
import { GetTrackUseCase } from './get-track.use-case';

@Injectable()
export class DeleteTrackUseCase {
  constructor(
    @Inject(TRACK_REPOSITORY_PORT)
    private readonly trackRepo: TrackRepositoryPort,
    private readonly getTrack: GetTrackUseCase,
  ) {}

  async execute(id: number): Promise<{ deleted: true; id: number }> {
    const track = await this.getTrack.execute(id);
    await this.trackRepo.remove(track);
    return { deleted: true, id };
  }
}
