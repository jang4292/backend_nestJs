export function assertIsolatedTestDatabase(): void {
  const url = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL)
    : undefined;
  const host = url?.hostname ?? process.env.DB_HOST;
  const database = url?.pathname.slice(1) ?? process.env.DB_DATABASE;
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
