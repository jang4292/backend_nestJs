import { QueryFailedError, Repository } from 'typeorm';
import { ForeignKeyConstraintError } from '../../domain/music.errors';
import { CatalogTrack } from '../entities/catalog-track.entity';
import { CatalogTrackTypeOrmRepository } from './catalog-track-typeorm.repository';

describe('CatalogTrackTypeOrmRepository.remove', () => {
  it('returns a 409 domain error when the track is used in a playlist', async () => {
    const typeormRepo = {
      remove: jest.fn().mockRejectedValue(
        new QueryFailedError(
          'DELETE FROM `track` WHERE `id` = ?',
          [1],
          Object.assign(new Error('fk'), {
            code: 'ER_ROW_IS_REFERENCED_2',
            errno: 1451,
          }),
        ),
      ),
    };
    const repository = new CatalogTrackTypeOrmRepository(
      typeormRepo as unknown as Repository<CatalogTrack>,
    );

    await expect(
      repository.remove({ id: 1 } as CatalogTrack),
    ).rejects.toBeInstanceOf(ForeignKeyConstraintError);
  });
});
