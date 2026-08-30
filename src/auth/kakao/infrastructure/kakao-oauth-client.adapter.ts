import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialIdentity } from '../../../users/domain/social-identity';
import {
  KakaoAuthError,
  KakaoAuthErrorCode,
} from '../domain/kakao-auth.errors';
import {
  KakaoAccessTokenSet,
  KakaoOAuthPort,
} from '../application/ports/kakao-oauth.port';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_PROFILE_URL = 'https://kapi.kakao.com/v2/user/me';

interface KakaoTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface KakaoProfileResponse {
  id?: number;
  kakao_account?: {
    email?: string;
    is_email_verified?: boolean;
    profile?: { nickname?: string; profile_image_url?: string };
  };
}

@Injectable()
export class KakaoOAuthClientAdapter implements KakaoOAuthPort {
  private readonly restApiKey?: string;
  private readonly clientSecret?: string;
  private readonly allowedRedirectUris: string[];

  constructor(private readonly configService: ConfigService) {
    this.restApiKey = configService.get<string>('KAKAO_REST_API_KEY');
    this.clientSecret = configService.get<string>('KAKAO_CLIENT_SECRET');

    const redirectUriEnv = configService.get<string>('KAKAO_REDIRECT_URIS', '');
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
  }): Promise<KakaoAccessTokenSet> {
    if (
      this.allowedRedirectUris.length > 0 &&
      !this.allowedRedirectUris.includes(params.redirectUri)
    ) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_BAD_REQUEST,
        'redirectUri is not in the allowed list.',
      );
    }
    if (!this.restApiKey) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_CONFIG_MISSING,
        'KAKAO_REST_API_KEY is not configured.',
      );
    }

    let response: Response;
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.restApiKey,
        redirect_uri: params.redirectUri,
        code: params.code,
      });
      if (this.clientSecret) body.set('client_secret', this.clientSecret);

      response = await fetch(KAKAO_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        body,
      });
    } catch (err) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_EXCHANGE_FAILED,
        err instanceof Error ? err.message : 'Network error during exchange.',
      );
    }

    const data = (await response.json()) as KakaoTokenResponse;
    if (!response.ok || !data.access_token) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_EXCHANGE_FAILED,
        data.error_description ?? 'Kakao token exchange failed.',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async fetchProfile(accessToken: string): Promise<SocialIdentity> {
    let response: Response;
    try {
      response = await fetch(KAKAO_PROFILE_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_PROFILE_FETCH_FAILED,
        err instanceof Error ? err.message : 'Network error fetching profile.',
      );
    }

    const data = (await response.json()) as KakaoProfileResponse;
    if (!response.ok || !data.id) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_PROFILE_FETCH_FAILED,
        'Kakao profile fetch failed.',
      );
    }

    return {
      provider: 'kakao',
      sub: String(data.id),
      email: data.kakao_account?.email,
      emailVerified: data.kakao_account?.is_email_verified,
      name: data.kakao_account?.profile?.nickname,
      picture: data.kakao_account?.profile?.profile_image_url,
    };
  }
}
