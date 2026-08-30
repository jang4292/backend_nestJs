import { SocialIdentity } from '../../../../users/domain/social-identity';

export const APPLE_TOKEN_VERIFIER_PORT = Symbol('AppleTokenVerifierPort');

export interface AppleTokenVerifierPort {
  /**
   * Verify an Apple ID token.
   * Throws {@link AppleAuthError} on any validation failure.
   */
  verifyIdToken(idToken: string, nonce?: string): Promise<SocialIdentity>;
}
