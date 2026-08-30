import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTrackDto } from './create-track.dto';

describe('CreateTrackDto', () => {
  const valid = { title: 'Song A', artistId: 1, bpm: 120 };

  it('should pass validation with valid data', async () => {
    const dto = plainToInstance(CreateTrackDto, valid);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should trim leading/trailing whitespace from title', () => {
    const dto = plainToInstance(CreateTrackDto, {
      ...valid,
      title: '  Song A  ',
    });
    expect(dto.title).toBe('Song A');
  });

  it('should reject title longer than 200 characters', async () => {
    const dto = plainToInstance(CreateTrackDto, {
      ...valid,
      title: 'a'.repeat(201),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('should reject a negative bpm', async () => {
    const dto = plainToInstance(CreateTrackDto, { ...valid, bpm: -1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'bpm')).toBe(true);
  });

  it('should reject a bpm above 400', async () => {
    const dto = plainToInstance(CreateTrackDto, { ...valid, bpm: 401 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'bpm')).toBe(true);
  });

  it('should reject invalid artistId', async () => {
    const dto = plainToInstance(CreateTrackDto, { ...valid, artistId: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'artistId')).toBe(true);
  });
});
