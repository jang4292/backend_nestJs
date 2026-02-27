import { SocialIdentity } from '../../domain/social-identity';

export const GOOGLE_TOKEN_VERIFIER_PORT = Symbol('GoogleTokenVerifierPort');

export interface GoogleTokenVerifierPort {
  /**
   * Verify a Google ID token.
   * Throws {@link GoogleAuthError} on any validation failure.
   */
  verifyIdToken(idToken: string, nonce?: string): Promise<SocialIdentity>;
}
