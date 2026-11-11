import { Artist } from '../../entities/artist.entity';

export const ARTIST_REPOSITORY_PORT = Symbol('ArtistRepositoryPort');

export interface ArtistRepositoryPort {
  findAll(): Promise<Artist[]>;
  findById(id: number): Promise<Artist | null>;
  findByName(name: string): Promise<Artist | null>;
  create(data: { name: string; description: string | null }): Artist;
  save(artist: Artist): Promise<Artist>;
  remove(artist: Artist): Promise<void>;
}
