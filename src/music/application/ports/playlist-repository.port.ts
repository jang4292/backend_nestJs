import { Playlist } from '../../entities/playlist.entity';

export const PLAYLIST_REPOSITORY_PORT = Symbol('PlaylistRepositoryPort');

export interface PlaylistRepositoryPort {
  create(data: {
    name: string;
    playDate: string | null;
    description: string | null;
  }): Playlist;
  save(playlist: Playlist): Promise<Playlist>;
  remove(playlist: Playlist): Promise<void>;
  findById(id: number): Promise<Playlist | null>;
  findByIdWithTracks(id: number): Promise<Playlist | null>;
  findByPlayDate(playDate: string): Promise<Playlist | null>;
  findAll(playDate?: string): Promise<Playlist[]>;
}
