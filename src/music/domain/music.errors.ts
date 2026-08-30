/** Raised by infrastructure when a delete violates a foreign-key constraint. */
export class ForeignKeyConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForeignKeyConstraintError';
  }
}
