import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AudioAssetRepositoryPort } from '../application/ports/audio-asset-repository.port';
import { AudioAsset } from '../entities/audio-asset.entity';
import { CatalogTrack } from '../entities/catalog-track.entity';

@Injectable()
export class AudioAssetTypeOrmRepository implements AudioAssetRepositoryPort {
  constructor(
    @InjectRepository(AudioAsset)
    private readonly repo: Repository<AudioAsset>,
  ) {}

  create(data: {
    track: CatalogTrack;
    url: string | null;
    duration: number | null;
    bpm: number | null;
  }): AudioAsset {
    return this.repo.create(data);
  }

  save(audioAsset: AudioAsset): Promise<AudioAsset> {
    return this.repo.save(audioAsset);
  }

  findById(id: number): Promise<AudioAsset | null> {
    return this.repo.findOne({ where: { id }, relations: ['track'] });
  }

  findByTrackId(trackId: number): Promise<AudioAsset[]> {
    return this.repo.find({
      where: { track: { id: trackId } },
      order: { id: 'ASC' },
    });
  }

  async remove(audioAsset: AudioAsset): Promise<void> {
    await this.repo.remove(audioAsset);
  }
}
