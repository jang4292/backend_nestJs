import { ConflictException } from '@nestjs/common';
import { UpdateArtistUseCase } from './update-artist.use-case';
import { GetArtistUseCase } from './get-artist.use-case';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';

describe('UpdateArtistUseCase', () => {
  const buildRepo = (): jest.Mocked<ArtistRepositoryPort> => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  });

  it('updates artist and preserves existing fields when omitted', async () => {
    const existing = { id: 1, name: 'Artist X', description: 'old' };
    const saved = { id: 1, name: 'Artist Y', description: 'old' };
    const artistRepo = buildRepo();
    artistRepo.findByName.mockResolvedValue(null);
    artistRepo.save.mockResolvedValue(saved as never);
    const getArtist = {
      execute: jest.fn().mockResolvedValue({ ...existing }),
    } as unknown as GetArtistUseCase;
    const useCase = new UpdateArtistUseCase(artistRepo, getArtist);

    const result = await useCase.execute(1, { name: 'Artist Y' } as never);

    expect(artistRepo.save).toHaveBeenCalledWith({
      id: 1,
      name: 'Artist Y',
      description: 'old',
    });
    expect(result).toEqual(saved);
  });

  it('throws ConflictException when update name conflicts', async () => {
    const existing = { id: 1, name: 'Artist X', description: null };
    const artistRepo = buildRepo();
    artistRepo.findByName.mockResolvedValue({ id: 2, name: 'Artist Y' } as never);
    const getArtist = {
      execute: jest.fn().mockResolvedValue({ ...existing }),
    } as unknown as GetArtistUseCase;
    const useCase = new UpdateArtistUseCase(artistRepo, getArtist);

    await expect(
      useCase.execute(1, { name: 'Artist Y' } as never),
    ).rejects.toThrow(ConflictException);
  });
});
