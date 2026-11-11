import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { PasswordHasherPort } from '../application/ports/password-hasher.port';

const BCRYPT_ROUNDS = 10;
/** 존재하지 않는 계정 로그인에도 bcrypt 비교 비용을 동일하게 쓰기 위한 고정 해시(평문 미사용). */
const TIMING_EQUALIZER_HASH =
  '$2b$10$M4STLCKcjswf1APu5VQbLeKqvI1ooRjIZgf6FzkoGS3Gv45eQF6/G';

@Injectable()
export class BcryptPasswordHasherAdapter implements PasswordHasherPort {
  hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  }

  async compare(plainPassword: string, hash: string | null): Promise<boolean> {
    if (!hash) {
      await bcrypt.compare(plainPassword, TIMING_EQUALIZER_HASH);
      return false;
    }
    return bcrypt.compare(plainPassword, hash);
  }
}
