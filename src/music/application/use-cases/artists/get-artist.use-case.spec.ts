import { NotFoundException } from '@nestjs/common';
import { GetArtistUseCase } from './get-artist.use-case';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';

describe('GetArtistUseCase', () => {
  const buildRepo = (): jest.Mocked<ArtistRepositoryPort> => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  });

  it('throws NotFoundException when artist is missing', async () => {
    const artistRepo = buildRepo();
    artistRepo.findById.mockResolvedValue(null);
    const useCase = new GetArtistUseCase(artistRepo);

    await expect(useCase.execute(1)).rejects.toThrow(NotFoundException);
  });

  it('returns the artist when found', async () => {
    const artist = { id: 1, name: 'Artist X' };
    const artistRepo = buildRepo();
    artistRepo.findById.mockResolvedValue(artist as never);
    const useCase = new GetArtistUseCase(artistRepo);

    await expect(useCase.execute(1)).resolves.toEqual(artist);
  });
});
