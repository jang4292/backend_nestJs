import { ListArtistsUseCase } from './list-artists.use-case';
import type { ArtistRepositoryPort } from '../../ports/artist-repository.port';

describe('ListArtistsUseCase', () => {
  it('returns artist list sorted by name then id', async () => {
    const items = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    const artistRepo: jest.Mocked<ArtistRepositoryPort> = {
      findAll: jest.fn().mockResolvedValue(items),
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    const useCase = new ListArtistsUseCase(artistRepo);

    const result = await useCase.execute();

    expect(artistRepo.findAll).toHaveBeenCalled();
    expect(result).toEqual(items);
  });
});
