import { BcryptPasswordHasherAdapter } from './bcrypt-password-hasher.adapter';

describe('BcryptPasswordHasherAdapter', () => {
  const hasher = new BcryptPasswordHasherAdapter();

  it('hashes and verifies a password', async () => {
    const hash = await hasher.hash('correct horse');

    expect(hash).not.toBe('correct horse');
    await expect(hasher.compare('correct horse', hash)).resolves.toBe(true);
    await expect(hasher.compare('wrong', hash)).resolves.toBe(false);
  });

  it('returns false for a missing hash after doing the same bcrypt work', async () => {
    await expect(hasher.compare('anything', null)).resolves.toBe(false);
  });
});
