import { ConflictException } from '@nestjs/common';
import { CreateArtistUseCase } from './create-artist.use-case';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';

describe('CreateArtistUseCase', () => {
  const buildRepo = (): jest.Mocked<ArtistRepositoryPort> => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  });

  it('creates artist when duplicate does not exist', async () => {
    const dto = { name: 'Artist X', description: 'desc' };
    const created = { id: 1, ...dto };
    const artistRepo = buildRepo();
    artistRepo.findByName.mockResolvedValue(null);
    artistRepo.create.mockReturnValue(created as never);
    artistRepo.save.mockResolvedValue(created as never);
    const useCase = new CreateArtistUseCase(artistRepo);

    const result = await useCase.execute(dto as never);

    expect(artistRepo.create).toHaveBeenCalledWith({
      name: 'Artist X',
      description: 'desc',
    });
    expect(result).toEqual(created);
  });

  it('throws ConflictException when creating duplicate artist', async () => {
    const artistRepo = buildRepo();
    artistRepo.findByName.mockResolvedValue({ id: 1, name: 'Artist X' } as never);
    const useCase = new CreateArtistUseCase(artistRepo);

    await expect(
      useCase.execute({ name: 'Artist X' } as never),
    ).rejects.toThrow(ConflictException);
  });
});
