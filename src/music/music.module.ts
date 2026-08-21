// src/music/music.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MusicService } from './music.service';
import { MusicController } from './music.controller';
import { Artist } from './entities/artist.entity';
import { Track } from './entities/track.entity';
import { Playlist } from './entities/playlist.entity';
import { PlaylistTrack } from './entities/playlist-track.entity';
import { ArtistsService } from './services/artists.service';
import { PlaylistTracksService } from './services/playlist-tracks.service';
import { PlaylistsService } from './services/playlists.service';
import { TracksService } from './services/tracks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Artist, Track, Playlist, PlaylistTrack]),
  ],
  controllers: [MusicController],
  providers: [
    MusicService,
    ArtistsService,
    TracksService,
    PlaylistsService,
    PlaylistTracksService,
  ],
})
export class MusicModule {}
