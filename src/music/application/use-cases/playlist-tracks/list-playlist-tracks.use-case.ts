import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLAYLIST_REPOSITORY_PORT } from '../../ports/playlist-repository.port';
import type { PlaylistRepositoryPort } from '../../ports/playlist-repository.port';
import { PLAYLIST_TRACK_REPOSITORY_PORT } from '../../ports/playlist-track-repository.port';
import type { PlaylistTrackRepositoryPort } from '../../ports/playlist-track-repository.port';

export interface PlaylistTrackSummary {
  playlistTrackId: number;
  seq: number;
  note: string | null;
  track: {
    id: number;
    title: string;
    artist: string;
    bpm: number | null;
    lengthSec: number | null;
  };
}

@Injectable()
export class ListPlaylistTracksUseCase {
  constructor(
    @Inject(PLAYLIST_REPOSITORY_PORT)
    private readonly playlistRepo: PlaylistRepositoryPort,
    @Inject(PLAYLIST_TRACK_REPOSITORY_PORT)
    private readonly playlistTrackRepo: PlaylistTrackRepositoryPort,
  ) {}

  async execute(playlistId: number): Promise<PlaylistTrackSummary[]> {
    const playlist = await this.playlistRepo.findById(playlistId);
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    const playlistTracks = await this.playlistTrackRepo.findByPlaylist(
      playlistId,
    );

    return playlistTracks.map((playlistTrack) => ({
      playlistTrackId: playlistTrack.id,
      seq: playlistTrack.seq,
      note: playlistTrack.note,
      track: {
        id: playlistTrack.track.id,
        title: playlistTrack.track.title,
        artist: playlistTrack.track.artist.name,
        bpm: playlistTrack.track.bpm,
        lengthSec: playlistTrack.track.lengthSec,
      },
    }));
  }
}
