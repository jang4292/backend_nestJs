import { Inject, Injectable } from '@nestjs/common';
import { ListTracksQueryDto } from '../../../interface/dto/list-tracks-query.dto';
import {
  PaginatedTracks,
  TRACK_REPOSITORY_PORT,
} from '../../ports/track-repository.port';
import type { TrackRepositoryPort } from '../../ports/track-repository.port';

@Injectable()
export class ListTracksUseCase {
  constructor(
    @Inject(TRACK_REPOSITORY_PORT)
    private readonly trackRepo: TrackRepositoryPort,
  ) {}

  execute(query: ListTracksQueryDto): Promise<PaginatedTracks> {
    return this.trackRepo.search(query);
  }
}
