import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { SocialIdentity } from '../../../users/domain/social-identity';
import {
  GoogleAuthError,
  GoogleAuthErrorCode,
} from '../domain/google-auth.errors';
import { GoogleTokenVerifierPort } from '../application/ports/google-token-verifier.port';
import {
  GoogleAuthCodeExchangerPort,
  TokenSet,
} from '../application/ports/google-auth-code-exchanger.port';

@Injectable()
export class GoogleOAuthClientAdapter
  implements GoogleTokenVerifierPort, GoogleAuthCodeExchangerPort
{
  private readonly client: OAuth2Client;
  private readonly allowedAudiences: string[];
  private readonly allowedIssuers: string[];
  private readonly allowedRedirectUris: string[];

  constructor(private readonly configService: ConfigService) {
    const clientId = configService.get<string>('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = configService.get<string>(
      'GOOGLE_OAUTH_CLIENT_SECRET',
    );
    this.client = new OAuth2Client(clientId, clientSecret);

    const audienceEnv = configService.get<string>(
      'GOOGLE_ALLOWED_AUDIENCES',
      '',
    );
    this.allowedAudiences = audienceEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const issuerEnv = configService.get<string>(
      'GOOGLE_ALLOWED_ISSUERS',
      'accounts.google.com,https://accounts.google.com',
    );
    this.allowedIssuers = issuerEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const redirectUriEnv = configService.get<string>(
      'GOOGLE_OAUTH_REDIRECT_URIS',
      '',
    );
    this.allowedRedirectUris = redirectUriEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async verifyIdToken(
    idToken: string,
    nonce?: string,
  ): Promise<SocialIdentity> {
    try {
      const audience =
        this.allowedAudiences.length > 0 ? this.allowedAudiences : undefined;
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      const payload = ticket.getPayload();

      if (!payload) {
        throw new GoogleAuthError(
          GoogleAuthErrorCode.AUTH_GOOGLE_INTERNAL_ERROR,
          'Empty token payload.',
        );
      }

      if (!payload.sub) {
        throw new GoogleAuthError(
          GoogleAuthErrorCode.AUTH_GOOGLE_MISSING_SUB,
          'Token is missing the sub claim.',
        );
      }

      if (payload.iss && !this.allowedIssuers.includes(payload.iss)) {
        throw new GoogleAuthError(
          GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_ISSUER,
          `Invalid token issuer: ${payload.iss}`,
        );
      }

      if (nonce && payload.nonce !== nonce) {
        throw new GoogleAuthError(
          GoogleAuthErrorCode.AUTH_GOOGLE_NONCE_MISMATCH,
          'Token nonce does not match.',
        );
      }

      return {
        provider: 'google',
        sub: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified,
        name: payload.name,
        picture: payload.picture,
        nonce: payload.nonce,
      };
    } catch (err) {
      if (err instanceof GoogleAuthError) throw err;
      const message = (err as Error).message ?? '';
      throw this.mapGoogleError(message);
    }
  }

  async exchange(params: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
    state?: string;
    expectedState?: string;
  }): Promise<TokenSet> {
    try {
      if (
        this.allowedRedirectUris.length > 0 &&
        !this.allowedRedirectUris.includes(params.redirectUri)
      ) {
        throw new GoogleAuthError(
          GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST,
          'redirectUri is not allowed.',
        );
      }

      const { tokens } = await this.client.getToken({
        code: params.code,
        codeVerifier: params.codeVerifier,
        redirect_uri: params.redirectUri,
      });

      if (!tokens.id_token) {
        throw new GoogleAuthError(
          GoogleAuthErrorCode.AUTH_GOOGLE_EXCHANGE_FAILED,
          'No id_token returned from token exchange.',
        );
      }

      return {
        idToken: tokens.id_token,
        accessToken: tokens.access_token ?? undefined,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresIn: tokens.expiry_date
          ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
          : undefined,
      };
    } catch (err) {
      if (err instanceof GoogleAuthError) throw err;
      throw new GoogleAuthError(
        GoogleAuthErrorCode.AUTH_GOOGLE_EXCHANGE_FAILED,
        (err as Error).message ?? 'Auth code exchange failed.',
      );
    }
  }

  private mapGoogleError(message: string): GoogleAuthError {
    if (/too late|expir/i.test(message)) {
      return new GoogleAuthError(
        GoogleAuthErrorCode.AUTH_GOOGLE_TOKEN_EXPIRED,
        'Token has expired.',
      );
    }
    if (/audience/i.test(message)) {
      return new GoogleAuthError(
        GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_AUDIENCE,
        'Invalid token audience.',
      );
    }
    if (/issuer/i.test(message)) {
      return new GoogleAuthError(
        GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_ISSUER,
        'Invalid token issuer.',
      );
    }
    return new GoogleAuthError(
      GoogleAuthErrorCode.AUTH_GOOGLE_INTERNAL_ERROR,
      message || 'An unexpected Google auth error occurred.',
    );
  }
}
