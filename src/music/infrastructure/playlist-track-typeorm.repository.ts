import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playlist } from '../entities/playlist.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { Track } from '../entities/track.entity';
import { PlaylistTrackRepositoryPort } from '../application/ports/playlist-track-repository.port';

@Injectable()
export class PlaylistTrackTypeOrmRepository
  implements PlaylistTrackRepositoryPort
{
  constructor(
    @InjectRepository(PlaylistTrack)
    private readonly repo: Repository<PlaylistTrack>,
  ) {}

  create(data: {
    playlist: Playlist;
    track: Track;
    seq: number;
    note: string | null;
  }): PlaylistTrack {
    return this.repo.create(data);
  }

  save(playlistTrack: PlaylistTrack): Promise<PlaylistTrack> {
    return this.repo.save(playlistTrack);
  }

  async remove(playlistTrack: PlaylistTrack): Promise<void> {
    await this.repo.remove(playlistTrack);
  }

  findByPlaylist(playlistId: number): Promise<PlaylistTrack[]> {
    return this.repo.find({
      where: { playlist: { id: playlistId } },
      relations: ['track', 'track.artist'],
      order: { seq: 'ASC' },
    });
  }

  findOneInPlaylist(
    playlistId: number,
    playlistTrackId: number,
  ): Promise<PlaylistTrack | null> {
    return this.repo.findOne({
      where: { id: playlistTrackId, playlist: { id: playlistId } },
    });
  }
}
