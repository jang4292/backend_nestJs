import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ValidatePasswordUseCase {
  execute(
    plainPassword: string,
    hashedPassword: string | null,
  ): Promise<boolean> {
    if (!hashedPassword) return Promise.resolve(false);
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
