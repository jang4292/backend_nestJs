import { Inject, Injectable } from '@nestjs/common';
import type { SocialIdentity } from '../../../../users/domain/social-identity';
import { APPLE_TOKEN_VERIFIER_PORT } from '../ports/apple-token-verifier.port';
import type { AppleTokenVerifierPort } from '../ports/apple-token-verifier.port';

export interface VerifyAppleIdTokenInput {
  idToken: string;
  nonce?: string;
}

@Injectable()
export class VerifyAppleIdTokenUseCase {
  constructor(
    @Inject(APPLE_TOKEN_VERIFIER_PORT)
    private readonly verifier: AppleTokenVerifierPort,
  ) {}

  async execute(input: VerifyAppleIdTokenInput): Promise<SocialIdentity> {
    return this.verifier.verifyIdToken(input.idToken, input.nonce);
  }
}
