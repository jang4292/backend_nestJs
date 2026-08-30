import { ConflictException } from '@nestjs/common';
import { DeleteArtistUseCase } from './delete-artist.use-case';
import { GetArtistUseCase } from './get-artist.use-case';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';
import { ForeignKeyConstraintError } from '../../../domain/music.errors';

describe('DeleteArtistUseCase', () => {
  const buildRepo = (): jest.Mocked<ArtistRepositoryPort> => ({
    findAll: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  });

  it('translates FK violation to ConflictException on delete', async () => {
    const existing = { id: 1, name: 'Artist X', description: null };
    const artistRepo = buildRepo();
    artistRepo.remove.mockRejectedValue(
      new ForeignKeyConstraintError('Cannot delete artist'),
    );
    const getArtist = {
      execute: jest.fn().mockResolvedValue(existing),
    } as unknown as GetArtistUseCase;
    const useCase = new DeleteArtistUseCase(artistRepo, getArtist);

    await expect(useCase.execute(1)).rejects.toThrow(ConflictException);
  });

  it('deletes artist when no linked tracks exist', async () => {
    const existing = { id: 1, name: 'Artist X', description: null };
    const artistRepo = buildRepo();
    artistRepo.remove.mockResolvedValue(undefined);
    const getArtist = {
      execute: jest.fn().mockResolvedValue(existing),
    } as unknown as GetArtistUseCase;
    const useCase = new DeleteArtistUseCase(artistRepo, getArtist);

    const result = await useCase.execute(1);

    expect(artistRepo.remove).toHaveBeenCalledWith(existing);
    expect(result).toEqual({ deleted: true, id: 1 });
  });
});
