import { Artist } from '../../entities/artist.entity';
import { Track } from '../../entities/track.entity';

export const TRACK_REPOSITORY_PORT = Symbol('TrackRepositoryPort');

export interface PaginatedTracks {
  items: Track[];
  total: number;
  page: number;
  limit: number;
}

export interface TrackSearchCriteria {
  search?: string;
  artistId?: number;
  artistName?: string;
  title?: string;
  minBpm?: number;
  maxBpm?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface TrackRepositoryPort {
  create(data: {
    title: string;
    artist: Artist;
    bpm: number | null;
    lengthSec: number | null;
  }): Track;
  save(track: Track): Promise<Track>;
  findById(id: number): Promise<Track | null>;
  remove(track: Track): Promise<void>;
  search(criteria: TrackSearchCriteria): Promise<PaginatedTracks>;
}
