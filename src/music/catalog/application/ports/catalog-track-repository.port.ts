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
  /** 최신순. take 상한은 interface 계층 DTO가 100으로 제한합니다. */
  findAll(options: { skip: number; take: number }): Promise<CatalogTrack[]>;
  findById(id: number): Promise<CatalogTrack | null>;
  remove(track: CatalogTrack): Promise<void>;
}
