import { Inject, Injectable } from '@nestjs/common';
import type { SocialIdentity } from '../../domain/social-identity';
import {
  GOOGLE_TOKEN_VERIFIER_PORT,
} from '../ports/google-token-verifier.port';
import type { GoogleTokenVerifierPort } from '../ports/google-token-verifier.port';

export interface VerifyGoogleIdTokenInput {
  idToken: string;
  nonce?: string;
}

@Injectable()
export class VerifyGoogleIdTokenUseCase {
  constructor(
    @Inject(GOOGLE_TOKEN_VERIFIER_PORT)
    private readonly verifier: GoogleTokenVerifierPort,
  ) {}

  async execute(input: VerifyGoogleIdTokenInput): Promise<SocialIdentity> {
    return this.verifier.verifyIdToken(input.idToken, input.nonce);
  }
}
