import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialIdentity } from '../../../users/domain/social-identity';
import {
  NaverAuthError,
  NaverAuthErrorCode,
} from '../domain/naver-auth.errors';
import {
  NaverAccessTokenSet,
  NaverOAuthPort,
} from '../application/ports/naver-oauth.port';

const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_PROFILE_URL = 'https://openapi.naver.com/v1/nid/me';

interface NaverTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string;
  error?: string;
  error_description?: string;
}

interface NaverProfileResponse {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    email?: string;
    name?: string;
    nickname?: string;
    profile_image?: string;
  };
}

@Injectable()
export class NaverOAuthClientAdapter implements NaverOAuthPort {
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly allowedRedirectUris: string[];

  constructor(private readonly configService: ConfigService) {
    this.clientId = configService.get<string>('NAVER_CLIENT_ID');
    this.clientSecret = configService.get<string>('NAVER_CLIENT_SECRET');

    const redirectUriEnv = configService.get<string>('NAVER_REDIRECT_URIS', '');
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
  }): Promise<NaverAccessTokenSet> {
    if (
      this.allowedRedirectUris.length > 0 &&
      !this.allowedRedirectUris.includes(params.redirectUri)
    ) {
      throw new NaverAuthError(
        NaverAuthErrorCode.AUTH_NAVER_BAD_REQUEST,
        'redirectUri is not in the allowed list.',
      );
    }
    if (!this.clientId || !this.clientSecret) {
      throw new NaverAuthError(
        NaverAuthErrorCode.AUTH_NAVER_CONFIG_MISSING,
        'NAVER_CLIENT_ID/NAVER_CLIENT_SECRET are not configured.',
      );
    }
    if (!params.state) {
      throw new NaverAuthError(
        NaverAuthErrorCode.AUTH_NAVER_BAD_REQUEST,
        'state is required by Naver OAuth.',
      );
    }

    let response: Response;
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: params.code,
        state: params.state,
      });

      response = await fetch(NAVER_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        body,
      });
    } catch (err) {
      throw new NaverAuthError(
        NaverAuthErrorCode.AUTH_NAVER_EXCHANGE_FAILED,
        err instanceof Error ? err.message : 'Network error during exchange.',
      );
    }

    const data = (await response.json()) as NaverTokenResponse;
    if (!response.ok || !data.access_token) {
      throw new NaverAuthError(
        NaverAuthErrorCode.AUTH_NAVER_EXCHANGE_FAILED,
        data.error_description ?? 'Naver token exchange failed.',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in ? Number(data.expires_in) : undefined,
    };
  }

  async fetchProfile(accessToken: string): Promise<SocialIdentity> {
    let response: Response;
    try {
      response = await fetch(NAVER_PROFILE_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      throw new NaverAuthError(
        NaverAuthErrorCode.AUTH_NAVER_PROFILE_FETCH_FAILED,
        err instanceof Error ? err.message : 'Network error fetching profile.',
      );
    }

    const data = (await response.json()) as NaverProfileResponse;
    if (!response.ok || data.resultcode !== '00' || !data.response?.id) {
      throw new NaverAuthError(
        NaverAuthErrorCode.AUTH_NAVER_PROFILE_FETCH_FAILED,
        data.message ?? 'Naver profile fetch failed.',
      );
    }

    return {
      provider: 'naver',
      sub: data.response.id,
      email: data.response.email,
      name: data.response.name ?? data.response.nickname,
      picture: data.response.profile_image,
    };
  }
}
