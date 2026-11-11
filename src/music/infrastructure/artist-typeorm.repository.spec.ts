import { QueryFailedError, Repository } from 'typeorm';
import { Artist } from '../entities/artist.entity';
import { ForeignKeyConstraintError } from '../domain/music.errors';
import { ArtistTypeOrmRepository } from './artist-typeorm.repository';

function mariaDbError(code: string, errno: number): QueryFailedError {
  return new QueryFailedError(
    'DELETE FROM `artist` WHERE `id` = ?',
    [1],
    Object.assign(new Error(code), { code, errno }),
  );
}

describe('ArtistTypeOrmRepository.remove', () => {
  const artist = { id: 1, name: 'Artist X', description: null } as Artist;
  let typeormRepo: { remove: jest.Mock };
  let repository: ArtistTypeOrmRepository;

  beforeEach(() => {
    typeormRepo = { remove: jest.fn() };
    repository = new ArtistTypeOrmRepository(
      typeormRepo as unknown as Repository<Artist>,
    );
  });

  it('translates the MariaDB FK violation (ER_ROW_IS_REFERENCED_2) into ForeignKeyConstraintError', async () => {
    typeormRepo.remove.mockRejectedValue(
      mariaDbError('ER_ROW_IS_REFERENCED_2', 1451),
    );

    await expect(repository.remove(artist)).rejects.toBeInstanceOf(
      ForeignKeyConstraintError,
    );
  });

  it('rethrows unrelated database errors', async () => {
    const error = mariaDbError('ER_LOCK_DEADLOCK', 1213);
    typeormRepo.remove.mockRejectedValue(error);

    await expect(repository.remove(artist)).rejects.toBe(error);
  });
});
