import { ConflictError, NotFoundError } from './domain-error';

describe('DomainError', () => {
  it('keeps the subclass name, kind and optional code', () => {
    const error = new ConflictError('Email already exists', 'EMAIL_TAKEN');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ConflictError');
    expect(error.kind).toBe('conflict');
    expect(error.code).toBe('EMAIL_TAKEN');
  });

  it('leaves the code undefined when not provided', () => {
    expect(new NotFoundError('User not found').code).toBeUndefined();
  });
});
