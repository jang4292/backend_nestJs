import { CatalogTrack } from '../../entities/catalog-track.entity';

export const CATALOG_TRACK_REPOSITORY_PORT = Symbol(
  'CatalogTrackRepositoryPort',
);

export interface CatalogTrackRepositoryPort {
  create(data: {
    title: string;
    artist: string;
    bpm: number | null;
  }): CatalogTrack;
  save(track: CatalogTrack): Promise<CatalogTrack>;
  findAll(): Promise<CatalogTrack[]>;
  findById(id: number): Promise<CatalogTrack | null>;
  remove(track: CatalogTrack): Promise<void>;
}
