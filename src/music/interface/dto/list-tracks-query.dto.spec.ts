import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListTracksQueryDto } from './list-tracks-query.dto';

describe('ListTracksQueryDto', () => {
  it('should pass validation with no query params and apply defaults', async () => {
    const dto = plainToInstance(ListTracksQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sortBy).toBe('id');
    expect(dto.sortOrder).toBe('DESC');
  });

  it('should allow artistName sorting', async () => {
    const dto = plainToInstance(ListTracksQueryDto, { sortBy: 'artistName' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.sortBy).toBe('artistName');
  });

  it('should coerce numeric query string params to numbers', async () => {
    const dto = plainToInstance(ListTracksQueryDto, {
      minBpm: '100',
      maxBpm: '140',
      page: '2',
      limit: '10',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.minBpm).toBe(100);
    expect(dto.maxBpm).toBe(140);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
  });

  it('should reject a sortBy column not in the whitelist', async () => {
    const dto = plainToInstance(ListTracksQueryDto, {
      sortBy: 'invalidColumn',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sortBy')).toBe(true);
  });

  it('should reject a limit above 100', async () => {
    const dto = plainToInstance(ListTracksQueryDto, { limit: '101' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
