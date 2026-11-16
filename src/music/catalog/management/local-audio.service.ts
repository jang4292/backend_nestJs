import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { AudioAsset } from '../entities/audio-asset.entity';
import { CatalogTrack } from '../entities/catalog-track.entity';
import { CatalogPlaylistTrack } from '../entities/catalog-playlist-track.entity';

export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export interface AudioUpload {
  buffer: Buffer;
  size: number;
}

/** Signatures are checked independently of the client supplied file name and MIME type. */
export function audioContentType(data: Buffer): string | null {
  if (data.length < 12) return null;
  if (
    data.subarray(0, 3).toString('ascii') === 'ID3' ||
    (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
  )
    return 'audio/mpeg';
  if (
    data.subarray(0, 4).toString('ascii') === 'RIFF' &&
    data.subarray(8, 12).toString('ascii') === 'WAVE'
  )
    return 'audio/wav';
  if (data.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (data.subarray(0, 4).toString('ascii') === 'fLaC') return 'audio/flac';
  if (data.subarray(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4';
  return null;
}

export function parseAudioRange(
  value: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!value) return { start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start >= size ||
      start > end
    )
      return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

@Injectable()
export class LocalAudioService {
  private readonly root: string;
  constructor(
    private readonly db: DataSource,
    config: ConfigService,
  ) {
    this.root = resolve(
      config.get<string>('MUSIC_STORAGE_DIR') ||
        join(process.cwd(), 'data', 'music'),
    );
  }
  async upload(trackId: number, file?: AudioUpload) {
    if (
      !file ||
      !file.buffer ||
      file.size > MAX_AUDIO_BYTES ||
      file.size !== file.buffer.length
    )
      throw new BadRequestException(
        'Audio file is required and must be at most 50 MiB',
      );
    const contentType = audioContentType(file.buffer);
    if (!contentType) throw new BadRequestException('Unsupported audio file');
    const track = await this.db
      .getRepository(CatalogTrack)
      .findOneBy({ id: trackId });
    if (!track) throw new NotFoundException('Track not found');
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const storageKey = randomUUID();
    const filePath = join(this.root, storageKey);
    await writeFile(filePath, file.buffer, { flag: 'wx', mode: 0o600 });
    try {
      const asset = await this.db.getRepository(AudioAsset).save({
        track,
        storageKey,
        contentType,
        sizeBytes: file.size,
        url: null,
        duration: null,
        bpm: null,
      });
      return { id: asset.id, trackId, contentType, sizeBytes: file.size };
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }
  async streamPlaylistItem(
    playlistId: number,
    itemId: number,
    anonymous: boolean,
    range: string | undefined,
    response: Response,
  ) {
    const item = await this.db.getRepository(CatalogPlaylistTrack).findOne({
      where: {
        id: itemId,
        playlist: { id: playlistId, status: 'published' },
      },
      relations: { playlist: true, track: true },
    });
    if (
      !item ||
      (anonymous && !item.playlist.anonymousPlayable) ||
      item.audioAssetId == null
    )
      throw new NotFoundException('Playable audio not found');
    const asset = await this.db.getRepository(AudioAsset).findOne({
      where: { id: item.audioAssetId },
      relations: { track: true },
    });
    if (!asset || asset.track.id !== item.track.id)
      throw new NotFoundException('Playable audio not found');
    return this.streamAsset(asset, range, response);
  }
  async streamAdminAsset(
    id: number,
    range: string | undefined,
    response: Response,
  ) {
    const asset = await this.db.getRepository(AudioAsset).findOneBy({ id });
    if (!asset) throw new NotFoundException('Playable audio not found');
    return this.streamAsset(asset, range, response);
  }
  private async streamAsset(
    asset: AudioAsset,
    range: string | undefined,
    response: Response,
  ) {
    if (
      !asset.storageKey ||
      !/^[a-f0-9-]{36}$/.test(asset.storageKey) ||
      !asset.contentType
    )
      throw new NotFoundException('Playable audio not found');
    const path = join(this.root, asset.storageKey);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile() || info.size <= 0)
      throw new NotFoundException('Playable audio not found');
    const requested = parseAudioRange(range, info.size);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (!requested) {
      response.status(416).setHeader('Content-Range', `bytes */${info.size}`);
      response.end();
      return;
    }
    response.status(range ? 206 : 200);
    response.setHeader('Content-Type', asset.contentType);
    response.setHeader(
      'Content-Length',
      String(requested.end - requested.start + 1),
    );
    if (range)
      response.setHeader(
        'Content-Range',
        `bytes ${requested.start}-${requested.end}/${info.size}`,
      );
    await pipeline(createReadStream(path, requested), response);
  }
}
