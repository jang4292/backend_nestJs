import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MusicManagementService } from './music-management.service';
import {
  MusicPlaylistUsage,
  MusicPlaylistUsageItem,
} from './music-management.entities';

describe('MusicManagementService', () => {
  it('rejects an edit to a confirmed usage before changing any item', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({ id: 4, status: 'confirmed' }),
      findOneBy: jest.fn(),
      save: jest.fn(),
    };
    const db = {
      transaction: (fn: (m: typeof manager) => unknown) => fn(manager),
    } as unknown as DataSource;
    const service = new MusicManagementService(db);
    await expect(
      service.updateUsageItem(4, 8, { playCount: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.findOneBy).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.findOne).toHaveBeenCalledWith(
      MusicPlaylistUsage,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });
  it('updates a draft usage item including zero for an excluded track', async () => {
    const item = { id: 8, usageId: 4, playCount: 1 };
    const manager = {
      findOne: jest.fn().mockResolvedValue({ id: 4, status: 'draft' }),
      findOneBy: jest.fn().mockResolvedValue(item),
      save: jest
        .fn()
        .mockImplementation((value: unknown) => Promise.resolve(value)),
    };
    const db = {
      transaction: (fn: (m: typeof manager) => unknown) => fn(manager),
    } as unknown as DataSource;
    const service = new MusicManagementService(db);
    await expect(
      service.updateUsageItem(4, 8, { playCount: 0 }),
    ).resolves.toMatchObject({ playCount: 0 });
    expect(manager.findOneBy).toHaveBeenCalledWith(MusicPlaylistUsageItem, {
      id: 8,
      usageId: 4,
    });
  });
  it('uses only confirmed, nonzero usage within a half-open interval for every statistic', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 1, count: '3' }]);
    const service = new MusicManagementService({
      query,
    } as unknown as DataSource);
    const result = await service.statistics({
      from: '2026-01-01T00:00:00Z',
      to: '2026-02-01T00:00:00Z',
      location: 'Seoul',
    });
    expect(query).toHaveBeenCalledTimes(4);
    for (const [sql, params] of query.mock.calls as [string, unknown[]][]) {
      expect(sql).toContain("u.status = 'confirmed'");
      expect(sql).toContain('u.usedAt >= ? AND u.usedAt < ?');
      expect(sql).toContain('i.playCount > 0');
      expect(params[2]).toBe('Seoul');
    }
    expect(result.artists[0].count).toBe(3);
  });
});
