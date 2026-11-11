import { SocialUserRecord } from '../../../../users/application/ports/social-account-linker.port';

export const SESSION_ISSUER_PORT = Symbol('SessionIssuerPort');

export interface SessionTokens {
  accessToken: string;
  expiresIn?: number;
}

export interface SessionIssuerPort {
  issue(user: SocialUserRecord): Promise<SessionTokens>;
}
