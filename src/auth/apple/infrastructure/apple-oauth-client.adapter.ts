import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, importPKCS8, type CryptoKey } from 'jose';
import {
  AppleAuthError,
  AppleAuthErrorCode,
} from '../domain/apple-auth.errors';
import {
  AppleAuthCodeExchangerPort,
  TokenSet,
} from '../application/ports/apple-auth-code-exchanger.port';

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_ISSUER = 'https://appleid.apple.com';
const CLIENT_SECRET_TTL_SECONDS = 5 * 60;

interface AppleTokenResponse {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

@Injectable()
export class AppleOAuthClientAdapter implements AppleAuthCodeExchangerPort {
  private readonly teamId?: string;
  private readonly keyId?: string;
  private readonly serviceId?: string;
  private readonly privateKeyPem?: string;
  private readonly allowedRedirectUris: string[];
  private privateKey?: CryptoKey;

  constructor(private readonly configService: ConfigService) {
    this.teamId = configService.get<string>('APPLE_TEAM_ID');
    this.keyId = configService.get<string>('APPLE_KEY_ID');
    this.serviceId = configService.get<string>('APPLE_SERVICE_ID');
    this.privateKeyPem = configService
      .get<string>('APPLE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    const redirectUriEnv = configService.get<string>('APPLE_REDIRECT_URIS', '');
    this.allowedRedirectUris = redirectUriEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async exchange(params: {
    code: string;
    redirectUri: string;
    state?: string;
    expectedState?: string;
  }): Promise<TokenSet> {
    if (
      this.allowedRedirectUris.length > 0 &&
      !this.allowedRedirectUris.includes(params.redirectUri)
    ) {
      throw new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_BAD_REQUEST,
        'redirectUri is not in the allowed list.',
      );
    }

    const clientSecret = await this.generateClientSecret();

    let response: Response;
    try {
      response = await fetch(APPLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.requireConfig(this.serviceId, 'APPLE_SERVICE_ID'),
          client_secret: clientSecret,
          code: params.code,
          grant_type: 'authorization_code',
          redirect_uri: params.redirectUri,
        }),
      });
    } catch (err) {
      throw new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_EXCHANGE_FAILED,
        err instanceof Error ? err.message : 'Network error during exchange.',
      );
    }

    const body = (await response.json()) as AppleTokenResponse;
    if (!response.ok || !body.id_token) {
      throw new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_EXCHANGE_FAILED,
        body.error ?? 'Apple token exchange failed.',
      );
    }

    return {
      idToken: body.id_token,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresIn: body.expires_in,
    };
  }

  /** Generates the ES256 JWT client_secret Apple requires for code exchange. */
  private async generateClientSecret(): Promise<string> {
    const teamId = this.requireConfig(this.teamId, 'APPLE_TEAM_ID');
    const keyId = this.requireConfig(this.keyId, 'APPLE_KEY_ID');
    const serviceId = this.requireConfig(this.serviceId, 'APPLE_SERVICE_ID');
    const privateKeyPem = this.requireConfig(
      this.privateKeyPem,
      'APPLE_PRIVATE_KEY',
    );

    if (!this.privateKey) {
      this.privateKey = await importPKCS8(privateKeyPem, 'ES256');
    }

    return new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt()
      .setExpirationTime(
        Math.floor(Date.now() / 1000) + CLIENT_SECRET_TTL_SECONDS,
      )
      .setAudience(APPLE_ISSUER)
      .setSubject(serviceId)
      .sign(this.privateKey);
  }

  private requireConfig(value: string | undefined, name: string): string {
    if (!value) {
      throw new AppleAuthError(
        AppleAuthErrorCode.AUTH_APPLE_CONFIG_MISSING,
        `${name} is not configured.`,
      );
    }
    return value;
  }
}
