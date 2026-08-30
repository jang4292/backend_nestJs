import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { SocialIdentity } from '../../../users/domain/social-identity';
import {
  AppleAuthError,
  AppleAuthErrorCode,
} from '../domain/apple-auth.errors';
import { AppleTokenVerifierPort } from '../application/ports/apple-token-verifier.port';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

@Injectable()
export class AppleJwksVerifierAdapter implements AppleTokenVerifierPort {
  private readonly jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  private readonly allowedAudiences: string[];

  constructor(private readonly configService: ConfigService) {
    const audienceEnv = configService.get<string>(
      'APPLE_ALLOWED_AUDIENCES',
      '',
    );
    this.allowedAudiences = audienceEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async verifyIdToken(
    idToken: string,
    nonce?: string,
  ): Promise<SocialIdentity> {
    try {
      const { payload } = await jwtVerify(idToken, this.jwks, {
        issuer: APPLE_ISSUER,
        audience:
          this.allowedAudiences.length > 0 ? this.allowedAudiences : undefined,
      });

      if (!payload.sub) {
        throw new AppleAuthError(
          AppleAuthErrorCode.AUTH_APPLE_MISSING_SUB,
          'Token is missing the sub claim.',
        );
      }

      if (nonce && payload.nonce !== nonce) {
        throw new AppleAuthError(
          AppleAuthErrorCode.AUTH_APPLE_BAD_REQUEST,
          'Token nonce does not match.',
        );
      }

      const emailVerifiedClaim = payload.email_verified;
      return {
        provider: 'apple',
        sub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        emailVerified:
          emailVerifiedClaim === true || emailVerifiedClaim === 'true',
        nonce: typeof payload.nonce === 'string' ? payload.nonce : undefined,
      };
    } catch (err) {
      if (err instanceof AppleAuthError) throw err;
      throw this.mapAppleError(err instanceof Error ? err.message : '');
    }
  }

  private mapAppleError(message: string): AppleAuthError {
    if (/exp|expired/i.test(message)) {
      return new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_TOKEN_EXPIRED,
        'Token has expired.',
      );
    }
    if (/aud/i.test(message)) {
      return new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_INVALID_AUDIENCE,
        `Invalid token audience: ${message}`,
      );
    }
    if (/iss/i.test(message)) {
      return new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_INVALID_ISSUER,
        `Invalid token issuer: ${message}`,
      );
    }
    return new AppleAuthError(
      AppleAuthErrorCode.AUTH_APPLE_INTERNAL_ERROR,
      message,
    );
  }
}
