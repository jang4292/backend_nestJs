import { QueryFailedError } from 'typeorm';

/**
 * MariaDB/MySQL 드라이버(mysql2) 오류 판별 헬퍼.
 *
 * 애플리케이션은 MariaDB만 지원하므로(app-env.ts) PostgreSQL SQLSTATE('23503' 등)가 아니라
 * mysql2의 `code`(ER_*)와 `errno`로 판별합니다.
 * @see https://mariadb.com/kb/en/mariadb-error-code-reference/
 */
const ER_DUP_ENTRY = { code: 'ER_DUP_ENTRY', errno: 1062 } as const;
/** 부모 행 삭제/수정이 자식 행 FK에 막힘 (DELETE artist with tracks 등) */
const ER_ROW_IS_REFERENCED = [
  { code: 'ER_ROW_IS_REFERENCED_2', errno: 1451 },
  { code: 'ER_ROW_IS_REFERENCED', errno: 1217 },
] as const;

interface DriverErrorShape {
  code?: unknown;
  errno?: unknown;
}

function driverErrorOf(error: unknown): DriverErrorShape | undefined {
  if (!(error instanceof QueryFailedError)) {
    return undefined;
  }
  return error.driverError as DriverErrorShape | undefined;
}

function matches(
  driverError: DriverErrorShape | undefined,
  candidate: { code: string; errno: number },
): boolean {
  return (
    driverError !== undefined &&
    (driverError.code === candidate.code ||
      driverError.errno === candidate.errno)
  );
}

/** UNIQUE 제약 위반 여부 */
export function isDuplicateEntryError(error: unknown): boolean {
  return matches(driverErrorOf(error), ER_DUP_ENTRY);
}

/** 다른 행이 참조 중이라 삭제할 수 없는 FK 위반 여부 */
export function isRowReferencedError(error: unknown): boolean {
  const driverError = driverErrorOf(error);
  return ER_ROW_IS_REFERENCED.some((candidate) =>
    matches(driverError, candidate),
  );
}
