// src/music/music.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MusicService } from './music.service';
import { MusicController } from './interface/music.controller';
import { Artist } from './entities/artist.entity';
import { Track } from './entities/track.entity';
import { Playlist } from './entities/playlist.entity';
import { PlaylistTrack } from './entities/playlist-track.entity';

import { ARTIST_REPOSITORY_PORT } from './application/ports/artist-repository.port';
import { TRACK_REPOSITORY_PORT } from './application/ports/track-repository.port';
import { PLAYLIST_REPOSITORY_PORT } from './application/ports/playlist-repository.port';
import { PLAYLIST_TRACK_REPOSITORY_PORT } from './application/ports/playlist-track-repository.port';

import { ArtistTypeOrmRepository } from './infrastructure/artist-typeorm.repository';
import { TrackTypeOrmRepository } from './infrastructure/track-typeorm.repository';
import { PlaylistTypeOrmRepository } from './infrastructure/playlist-typeorm.repository';
import { PlaylistTrackTypeOrmRepository } from './infrastructure/playlist-track-typeorm.repository';

import { ListArtistsUseCase } from './application/use-cases/artists/list-artists.use-case';
import { GetArtistUseCase } from './application/use-cases/artists/get-artist.use-case';
import { CreateArtistUseCase } from './application/use-cases/artists/create-artist.use-case';
import { UpdateArtistUseCase } from './application/use-cases/artists/update-artist.use-case';
import { DeleteArtistUseCase } from './application/use-cases/artists/delete-artist.use-case';

import { CreateTrackUseCase } from './application/use-cases/tracks/create-track.use-case';
import { ListTracksUseCase } from './application/use-cases/tracks/list-tracks.use-case';
import { GetTrackUseCase } from './application/use-cases/tracks/get-track.use-case';
import { UpdateTrackUseCase } from './application/use-cases/tracks/update-track.use-case';
import { DeleteTrackUseCase } from './application/use-cases/tracks/delete-track.use-case';

import { CreatePlaylistUseCase } from './application/use-cases/playlists/create-playlist.use-case';
import { ListPlaylistsUseCase } from './application/use-cases/playlists/list-playlists.use-case';
import { GetPlaylistUseCase } from './application/use-cases/playlists/get-playlist.use-case';
import { GetPlaylistByDateUseCase } from './application/use-cases/playlists/get-playlist-by-date.use-case';
import { UpdatePlaylistUseCase } from './application/use-cases/playlists/update-playlist.use-case';
import { DeletePlaylistUseCase } from './application/use-cases/playlists/delete-playlist.use-case';

import { ListPlaylistTracksUseCase } from './application/use-cases/playlist-tracks/list-playlist-tracks.use-case';
import { AddTrackToPlaylistUseCase } from './application/use-cases/playlist-tracks/add-track-to-playlist.use-case';
import { UpdatePlaylistTrackUseCase } from './application/use-cases/playlist-tracks/update-playlist-track.use-case';
import { RemoveTrackFromPlaylistUseCase } from './application/use-cases/playlist-tracks/remove-track-from-playlist.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([Artist, Track, Playlist, PlaylistTrack])],
  controllers: [MusicController],
  providers: [
    MusicService,

    ArtistTypeOrmRepository,
    { provide: ARTIST_REPOSITORY_PORT, useExisting: ArtistTypeOrmRepository },
    TrackTypeOrmRepository,
    { provide: TRACK_REPOSITORY_PORT, useExisting: TrackTypeOrmRepository },
    PlaylistTypeOrmRepository,
    {
      provide: PLAYLIST_REPOSITORY_PORT,
      useExisting: PlaylistTypeOrmRepository,
    },
    PlaylistTrackTypeOrmRepository,
    {
      provide: PLAYLIST_TRACK_REPOSITORY_PORT,
      useExisting: PlaylistTrackTypeOrmRepository,
    },

    ListArtistsUseCase,
    GetArtistUseCase,
    CreateArtistUseCase,
    UpdateArtistUseCase,
    DeleteArtistUseCase,

    CreateTrackUseCase,
    ListTracksUseCase,
    GetTrackUseCase,
    UpdateTrackUseCase,
    DeleteTrackUseCase,

    CreatePlaylistUseCase,
    ListPlaylistsUseCase,
    GetPlaylistUseCase,
    GetPlaylistByDateUseCase,
    UpdatePlaylistUseCase,
    DeletePlaylistUseCase,

    ListPlaylistTracksUseCase,
    AddTrackToPlaylistUseCase,
    UpdatePlaylistTrackUseCase,
    RemoveTrackFromPlaylistUseCase,
  ],
})
export class MusicModule {}
