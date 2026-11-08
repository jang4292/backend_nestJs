import { Injectable, Logger } from '@nestjs/common';
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
import {
  fetchWithTimeout,
  readJsonSafely,
} from '../../shared/infrastructure/fetch-with-timeout';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_PROFILE_URL = 'https://kapi.kakao.com/v2/user/me';
const KAKAO_TOKEN_INFO_URL = 'https://kapi.kakao.com/v1/user/access_token_info';

interface KakaoTokenInfoResponse {
  id?: number;
  expires_in?: number;
  app_id?: number;
}

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
  private readonly logger = new Logger(KakaoOAuthClientAdapter.name);
  private readonly appId?: string;
  private readonly restApiKey?: string;
  private readonly clientSecret?: string;
  private readonly allowedRedirectUris: string[];

  constructor(private readonly configService: ConfigService) {
    this.appId = configService.get<string>('KAKAO_APP_ID');
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

      response = await fetchWithTimeout(KAKAO_TOKEN_URL, {
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

    const data = await readJsonSafely<KakaoTokenResponse>(response);
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
      response = await fetchWithTimeout(KAKAO_PROFILE_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_PROFILE_FETCH_FAILED,
        err instanceof Error ? err.message : 'Network error fetching profile.',
      );
    }

    const data = await readJsonSafely<KakaoProfileResponse>(response);
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

  /**
   * 클라이언트가 직접 보낸 accessToken이 이 앱(KAKAO_APP_ID)에서 발급되었는지 확인합니다.
   * 다른 Kakao 앱에서 받은 사용자 토큰으로 이 서비스에 로그인하는 토큰 치환 공격을 막습니다.
   * production은 app-env.ts가 KAKAO_APP_ID를 필수로 검증하며, 개발 환경에서 미설정이면 경고 후 생략합니다.
   */
  async verifyAccessTokenAudience(accessToken: string): Promise<void> {
    if (!this.appId) {
      this.logger.warn(
        'KAKAO_APP_ID is not configured; skipping Kakao access token app verification.',
      );
      return;
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(KAKAO_TOKEN_INFO_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_PROFILE_FETCH_FAILED,
        err instanceof Error ? err.message : 'Network error verifying token.',
      );
    }

    const data = await readJsonSafely<KakaoTokenInfoResponse>(response);
    if (!response.ok || data.app_id === undefined) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_INVALID_TOKEN,
        'Kakao access token could not be verified.',
      );
    }
    if (String(data.app_id) !== this.appId) {
      throw new KakaoAuthError(
        KakaoAuthErrorCode.AUTH_KAKAO_INVALID_TOKEN,
        'Kakao access token was not issued for this application.',
      );
    }
  }
}
