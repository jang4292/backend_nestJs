import { LocalAudioController } from './management/local-audio.controller';
import { LocalAudioService } from './management/local-audio.service';
import { MusicManagementController } from './management/music-management.controller';
import { MusicManagementService } from './management/music-management.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUDIO_ASSET_REPOSITORY_PORT } from './application/ports/audio-asset-repository.port';
import { CATALOG_TRACK_REPOSITORY_PORT } from './application/ports/catalog-track-repository.port';
import { CatalogMusicService } from './catalog-music.service';
import { AudioAsset } from './entities/audio-asset.entity';
import { CatalogTrack } from './entities/catalog-track.entity';
import { CatalogPlaylist } from './entities/catalog-playlist.entity';
import { CatalogPlaylistTrack } from './entities/catalog-playlist-track.entity';
import { AudioAssetTypeOrmRepository } from './infrastructure/audio-asset-typeorm.repository';
import { CatalogTrackTypeOrmRepository } from './infrastructure/catalog-track-typeorm.repository';
import { CatalogMusicController } from './interface/catalog-music.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CatalogTrack,
      AudioAsset,
      CatalogPlaylist,
      CatalogPlaylistTrack,
    ]),
  ],
  controllers: [
    CatalogMusicController,
    MusicManagementController,
    LocalAudioController,
  ],
  providers: [
    CatalogMusicService,
    MusicManagementService,
    LocalAudioService,
    CatalogTrackTypeOrmRepository,
    {
      provide: CATALOG_TRACK_REPOSITORY_PORT,
      useExisting: CatalogTrackTypeOrmRepository,
    },
    AudioAssetTypeOrmRepository,
    {
      provide: AUDIO_ASSET_REPOSITORY_PORT,
      useExisting: AudioAssetTypeOrmRepository,
    },
  ],
})
export class CatalogMusicModule {}
