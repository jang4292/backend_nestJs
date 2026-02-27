/** Pure domain type – no framework or SDK imports */
export interface SocialIdentity {
  provider: 'google';
  /** Google's stable unique user identifier */
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  /** Optional nonce for replay-attack prevention */
  nonce?: string;
}
