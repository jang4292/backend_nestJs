import { QueryFailedError } from 'typeorm';
import { isDuplicateEntryError, isRowReferencedError } from './mariadb-errors';

function queryFailed(driverError: Record<string, unknown>): QueryFailedError {
  return new QueryFailedError(
    'DELETE FROM x',
    [],
    Object.assign(new Error('driver'), driverError),
  );
}

describe('mariadb-errors', () => {
  it('detects ER_DUP_ENTRY by code or errno', () => {
    expect(isDuplicateEntryError(queryFailed({ code: 'ER_DUP_ENTRY' }))).toBe(
      true,
    );
    expect(isDuplicateEntryError(queryFailed({ errno: 1062 }))).toBe(true);
  });

  it('detects FK "row is referenced" violations by code or errno', () => {
    expect(
      isRowReferencedError(queryFailed({ code: 'ER_ROW_IS_REFERENCED_2' })),
    ).toBe(true);
    expect(isRowReferencedError(queryFailed({ errno: 1451 }))).toBe(true);
    expect(isRowReferencedError(queryFailed({ errno: 1217 }))).toBe(true);
  });

  it('does not treat PostgreSQL SQLSTATE codes as MariaDB errors', () => {
    expect(isRowReferencedError(queryFailed({ code: '23503' }))).toBe(false);
    expect(isDuplicateEntryError(queryFailed({ code: '23505' }))).toBe(false);
  });

  it('ignores non-QueryFailedError values', () => {
    expect(isDuplicateEntryError(new Error('ER_DUP_ENTRY'))).toBe(false);
    expect(isRowReferencedError({ code: 'ER_ROW_IS_REFERENCED_2' })).toBe(
      false,
    );
  });
});
