export function assertIsolatedTestDatabase(): void {
  const url = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL)
    : undefined;
  const host = url?.hostname ?? process.env.DB_HOST;
  const database = url?.pathname.slice(1) ?? process.env.DB_DATABASE;
  // 이 검사는 실수 방지용 최소 조건입니다. localhost와 *_test라는 이름만으로 전용 DB임이 증명되지는 않습니다.
  // These are minimum safeguards: localhost and a *_test name do not prove the database is disposable.
  if (
    process.env.ISOLATED_DATABASE_E2E !== 'true' ||
    process.env.NODE_ENV !== 'test' ||
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host ?? '') ||
    !database?.endsWith('_test')
  ) {
    throw new Error(
      'These tests require an explicitly isolated local *_test database',
    );
  }
}
