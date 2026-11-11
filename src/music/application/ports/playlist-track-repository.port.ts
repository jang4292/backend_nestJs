import { Playlist } from '../../entities/playlist.entity';
import { PlaylistTrack } from '../../entities/playlist-track.entity';
import { Track } from '../../entities/track.entity';

export const PLAYLIST_TRACK_REPOSITORY_PORT = Symbol(
  'PlaylistTrackRepositoryPort',
);

export interface PlaylistTrackRepositoryPort {
  create(data: {
    playlist: Playlist;
    track: Track;
    seq: number;
    note: string | null;
  }): PlaylistTrack;
  save(playlistTrack: PlaylistTrack): Promise<PlaylistTrack>;
  remove(playlistTrack: PlaylistTrack): Promise<void>;
  findByPlaylist(playlistId: number): Promise<PlaylistTrack[]>;
  findOneInPlaylist(
    playlistId: number,
    playlistTrackId: number,
  ): Promise<PlaylistTrack | null>;
}
