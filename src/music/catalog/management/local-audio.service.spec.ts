import { audioContentType, parseAudioRange } from './local-audio.service';

describe('audio upload validation', () => {
  it('recognizes supported file signatures instead of trusting a claimed MIME type', () => {
    expect(audioContentType(Buffer.from('ID3abcdefghijk'))).toBe('audio/mpeg');
    expect(audioContentType(Buffer.from('RIFFxxxxWAVE'))).toBe('audio/wav');
    expect(audioContentType(Buffer.from('not audio at all'))).toBeNull();
    expect(audioContentType(Buffer.from('ID3'))).toBeNull();
  });
});

describe('audio byte ranges', () => {
  it('supports full, open-ended and suffix ranges', () => {
    expect(parseAudioRange(undefined, 100)).toEqual({ start: 0, end: 99 });
    expect(parseAudioRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(parseAudioRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parseAudioRange('bytes=-20', 100)).toEqual({ start: 80, end: 99 });
    expect(parseAudioRange('bytes=90-999', 100)).toEqual({
      start: 90,
      end: 99,
    });
  });
  it.each([
    'bytes=100-',
    'bytes=20-10',
    'bytes=-0',
    'bytes=1-2,3-4',
    'bytes=-',
    'items=1-2',
  ])('rejects an invalid or unsupported range %s', (range) => {
    expect(parseAudioRange(range, 100)).toBeNull();
  });
});

import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { LocalAudioService } from './local-audio.service';

describe('playlist audio access', () => {
  it('does not serve an anonymous request when anonymous playback is disabled', async () => {
    const findOne = jest.fn().mockResolvedValue({
      playlist: { anonymousPlayable: false },
      audioAssetId: 1,
      track: { id: 2 },
    });
    const db = {
      getRepository: jest.fn().mockReturnValue({ findOne }),
    } as unknown as DataSource;
    const service = new LocalAudioService(
      db,
      new ConfigService({ MUSIC_STORAGE_DIR: '/private/tmp/music-test' }),
    );
    await expect(
      service.streamPlaylistItem(3, 4, true, undefined, {} as Response),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4, playlist: { id: 3, status: 'published' } },
      }),
    );
    expect(db.getRepository).toHaveBeenCalledTimes(1);
  });
});
