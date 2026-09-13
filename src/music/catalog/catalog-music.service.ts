import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AUDIO_ASSET_REPOSITORY_PORT } from './application/ports/audio-asset-repository.port';
import type { AudioAssetRepositoryPort } from './application/ports/audio-asset-repository.port';
import { CATALOG_TRACK_REPOSITORY_PORT } from './application/ports/catalog-track-repository.port';
import type { CatalogTrackRepositoryPort } from './application/ports/catalog-track-repository.port';
import { AudioAsset } from './entities/audio-asset.entity';
import { CatalogTrack } from './entities/catalog-track.entity';
import { CreateAudioAssetDto } from './interface/dto/create-audio-asset.dto';
import { CreateCatalogTrackDto } from './interface/dto/create-catalog-track.dto';
import { UpdateAudioAssetDto } from './interface/dto/update-audio-asset.dto';
import { UpdateCatalogTrackDto } from './interface/dto/update-catalog-track.dto';
import { CatalogPlaylist } from './entities/catalog-playlist.entity';
import { CatalogPlaylistTrack } from './entities/catalog-playlist-track.entity';
import { CreateCatalogPlaylistDto } from './interface/dto/create-catalog-playlist.dto';
import { AddCatalogPlaylistTrackDto } from './interface/dto/add-catalog-playlist-track.dto';
import { ReorderCatalogPlaylistDto } from './interface/dto/reorder-catalog-playlist.dto';

@Injectable()
export class CatalogMusicService {
  constructor(
    @Inject(CATALOG_TRACK_REPOSITORY_PORT)
    private readonly trackRepo: CatalogTrackRepositoryPort,
    @Inject(AUDIO_ASSET_REPOSITORY_PORT)
    private readonly audioAssetRepo: AudioAssetRepositoryPort,
    @InjectRepository(CatalogPlaylist)
    private readonly playlistRepo: Repository<CatalogPlaylist>,
    @InjectRepository(CatalogPlaylistTrack)
    private readonly playlistTrackRepo: Repository<CatalogPlaylistTrack>,
  ) {}

  createTrack(dto: CreateCatalogTrackDto): Promise<CatalogTrack> {
    return this.trackRepo.save(
      this.trackRepo.create({
        title: dto.title,
        artist: dto.artist,
        bpm: dto.bpm ?? null,
      }),
    );
  }

  listTracks(): Promise<CatalogTrack[]> {
    return this.trackRepo.findAll();
  }

  async getTrack(id: number): Promise<CatalogTrack> {
    const track = await this.trackRepo.findById(id);
    if (!track) {
      throw new NotFoundException('Track not found');
    }
    return track;
  }

  async updateTrack(
    id: number,
    dto: UpdateCatalogTrackDto,
  ): Promise<CatalogTrack> {
    const track = await this.getTrack(id);
    Object.assign(track, {
      title: dto.title ?? track.title,
      artist: dto.artist ?? track.artist,
      bpm: dto.bpm ?? track.bpm,
    });
    return this.trackRepo.save(track);
  }

  async deleteTrack(id: number): Promise<{ deleted: true; id: number }> {
    await this.trackRepo.remove(await this.getTrack(id));
    return { deleted: true, id };
  }

  async createAudioAsset(
    trackId: number,
    dto: CreateAudioAssetDto,
  ): Promise<AudioAsset> {
    const track = await this.getTrack(trackId);
    return this.audioAssetRepo.save(
      this.audioAssetRepo.create({
        track,
        url: dto.url ?? null,
        duration: dto.duration ?? null,
        bpm: dto.bpm ?? null,
      }),
    );
  }

  listAudioAssets(trackId: number): Promise<AudioAsset[]> {
    return this.audioAssetRepo.findByTrackId(trackId);
  }

  async updateAudioAsset(
    id: number,
    dto: UpdateAudioAssetDto,
  ): Promise<AudioAsset> {
    const audioAsset = await this.getAudioAsset(id);
    Object.assign(audioAsset, {
      url: dto.url ?? audioAsset.url,
      duration: dto.duration ?? audioAsset.duration,
      bpm: dto.bpm ?? audioAsset.bpm,
    });
    return this.audioAssetRepo.save(audioAsset);
  }

  async deleteAudioAsset(id: number): Promise<{ deleted: true; id: number }> {
    await this.audioAssetRepo.remove(await this.getAudioAsset(id));
    return { deleted: true, id };
  }

  createPlaylist(dto: CreateCatalogPlaylistDto): Promise<CatalogPlaylist> {
    return this.playlistRepo.save(
      this.playlistRepo.create({
        title: dto.title,
        description: dto.description ?? null,
        playDate: dto.playDate ?? null,
        status: 'draft',
        anonymousPlayable: dto.anonymousPlayable ?? false,
        publishedAt: null,
      }),
    );
  }

  async publishPlaylist(id: number): Promise<CatalogPlaylist> {
    const playlist = await this.getPlaylist(id);
    playlist.status = 'published';
    playlist.publishedAt = new Date();
    return this.playlistRepo.save(playlist);
  }

  async listPublicPlaylists(page: number, limit: number) {
    // 공개 목록은 published 상태만 조회해 draft와 archived를 DB 단계에서 제외합니다.
    const [items, total] = await this.playlistRepo.findAndCount({
      where: { status: 'published' },
      order: { publishedAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: { playlistItems: { track: true } },
    });
    return { items, total, page, limit };
  }

  async getPublicPlaylist(id: number): Promise<CatalogPlaylist> {
    // Entity를 그대로 반환하지 않고 controller의 public presenter를 거칩니다.
    const playlist = await this.playlistRepo.findOne({
      where: { id, status: 'published' },
      relations: { playlistItems: { track: true } },
    });
    if (!playlist) {
      throw new NotFoundException('Published playlist not found');
    }
    return playlist;
  }

  async addTrackToPlaylist(
    playlistId: number,
    dto: AddCatalogPlaylistTrackDto,
  ): Promise<CatalogPlaylistTrack> {
    const playlist = await this.getPlaylist(playlistId);
    const track = await this.trackRepo.findById(dto.trackId);
    if (!track) {
      throw new NotFoundException('Track not found');
    }
    const existingPosition = await this.playlistTrackRepo.findOne({
      where: { playlist: { id: playlistId }, position: dto.position },
    });
    if (existingPosition) {
      throw new BadRequestException('Playlist position is already occupied');
    }
    return this.playlistTrackRepo.save(
      this.playlistTrackRepo.create({
        playlist,
        track,
        position: dto.position,
        note: dto.note ?? null,
      }),
    );
  }

  async reorderPlaylist(
    playlistId: number,
    dto: ReorderCatalogPlaylistDto,
  ): Promise<CatalogPlaylistTrack[]> {
    await this.getPlaylist(playlistId);
    const items = await this.playlistTrackRepo.find({
      where: { playlist: { id: playlistId } },
    });
    const itemIds = new Set(items.map((item) => item.id));
    const requestedIds = new Set(dto.items.map((item) => item.id));
    const positions = new Set(dto.items.map((item) => item.position));

    if (
      items.length !== dto.items.length ||
      requestedIds.size !== items.length ||
      [...itemIds].some((id) => !requestedIds.has(id)) ||
      positions.size !== dto.items.length
    ) {
      throw new BadRequestException(
        'Reorder must include every playlist item exactly once',
      );
    }

    const positionById = new Map(
      dto.items.map((item) => [item.id, item.position]),
    );
    // 위치를 교환할 때 중간 UPDATE가 unique constraint와 충돌하지 않도록
    // 임시 음수 position을 거친 뒤 최종 값을 저장합니다.
    await this.playlistTrackRepo.manager.transaction(async (manager) => {
      const repository = manager.getRepository(CatalogPlaylistTrack);
      await Promise.all(
        items.map((item, index) =>
          repository.update(item.id, { position: -(index + 1) }),
        ),
      );
      await Promise.all(
        items.map((item) =>
          repository.update(item.id, {
            position: positionById.get(item.id)!,
          }),
        ),
      );
    });

    return this.playlistTrackRepo.find({
      where: { playlist: { id: playlistId } },
      relations: { track: true },
      order: { position: 'ASC' },
    });
  }

  private async getAudioAsset(id: number): Promise<AudioAsset> {
    const audioAsset = await this.audioAssetRepo.findById(id);
    if (!audioAsset) {
      throw new NotFoundException('Audio asset not found');
    }
    return audioAsset;
  }

  private async getPlaylist(id: number): Promise<CatalogPlaylist> {
    const playlist = await this.playlistRepo.findOne({ where: { id } });
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }
    return playlist;
  }
}
