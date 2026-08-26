import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Artist } from '../entities/artist.entity';
import { ArtistsService } from './artists.service';

const mockArtistRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
});

describe('ArtistsService', () => {
  let service: ArtistsService;
  let artistRepo: ReturnType<typeof mockArtistRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtistsService,
        { provide: getRepositoryToken(Artist), useFactory: mockArtistRepo },
      ],
    }).compile();

    service = module.get<ArtistsService>(ArtistsService);
    artistRepo = module.get(getRepositoryToken(Artist));
  });

  it('returns artist list sorted by name then id', async () => {
    const items = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    artistRepo.find.mockResolvedValue(items);

    const result = await service.getArtistList();

    expect(artistRepo.find).toHaveBeenCalledWith({
      order: { name: 'ASC', id: 'ASC' },
    });
    expect(result).toEqual(items);
  });

  it('throws NotFoundException when artist is missing', async () => {
    artistRepo.findOne.mockResolvedValue(null);

    await expect(service.getArtist(1)).rejects.toThrow(NotFoundException);
  });

  it('creates artist when duplicate does not exist', async () => {
    const dto = { name: 'Artist X', description: 'desc' };
    const created = { id: 1, ...dto };

    artistRepo.findOne.mockResolvedValue(null);
    artistRepo.create.mockReturnValue(created);
    artistRepo.save.mockResolvedValue(created);

    const result = await service.createArtist(dto);

    expect(artistRepo.create).toHaveBeenCalledWith({
      name: 'Artist X',
      description: 'desc',
    });
    expect(result).toEqual(created);
  });

  it('throws ConflictException when creating duplicate artist', async () => {
    artistRepo.findOne.mockResolvedValue({ id: 1, name: 'Artist X' });

    await expect(service.createArtist({ name: 'Artist X' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('updates artist and preserves existing fields when omitted', async () => {
    const existing = { id: 1, name: 'Artist X', description: 'old' };
    const saved = { id: 1, name: 'Artist Y', description: 'old' };

    artistRepo.findOne
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null);
    artistRepo.save.mockResolvedValue(saved);

    const result = await service.updateArtist(1, { name: 'Artist Y' });

    expect(artistRepo.save).toHaveBeenCalledWith({
      id: 1,
      name: 'Artist Y',
      description: 'old',
    });
    expect(result).toEqual(saved);
  });

  it('throws ConflictException when update name conflicts', async () => {
    const existing = { id: 1, name: 'Artist X', description: null };

    artistRepo.findOne
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ id: 2, name: 'Artist Y' });

    await expect(service.updateArtist(1, { name: 'Artist Y' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('translates FK violation to ConflictException on delete', async () => {
    const existing = { id: 1, name: 'Artist X', description: null };
    const fkError = new QueryFailedError('DELETE ...', [], {
      code: '23503',
    } as never);

    artistRepo.findOne.mockResolvedValue(existing);
    artistRepo.remove.mockRejectedValue(fkError);

    await expect(service.deleteArtist(1)).rejects.toThrow(ConflictException);
  });

  it('deletes artist when no linked tracks exist', async () => {
    const existing = { id: 1, name: 'Artist X', description: null };

    artistRepo.findOne.mockResolvedValue(existing);
    artistRepo.remove.mockResolvedValue(existing);

    const result = await service.deleteArtist(1);

    expect(artistRepo.remove).toHaveBeenCalledWith(existing);
    expect(result).toEqual({ deleted: true, id: 1 });
  });
});
