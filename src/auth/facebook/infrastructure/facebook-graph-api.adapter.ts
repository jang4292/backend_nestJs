import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialIdentity } from '../../../users/domain/social-identity';
import {
  FacebookAuthError,
  FacebookAuthErrorCode,
} from '../domain/facebook-auth.errors';
import {
  FacebookAccessTokenSet,
  FacebookOAuthPort,
} from '../application/ports/facebook-oauth.port';

interface FacebookTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: { message?: string };
}

interface FacebookDebugTokenResponse {
  data?: { is_valid?: boolean; app_id?: string; error?: { message?: string } };
}

interface FacebookProfileResponse {
  id?: string;
  name?: string;
  email?: string;
  error?: { message?: string };
}

@Injectable()
export class FacebookGraphApiAdapter implements FacebookOAuthPort {
  private readonly appId?: string;
  private readonly appSecret?: string;
  private readonly graphApiVersion: string;
  private readonly allowedRedirectUris: string[];

  constructor(private readonly configService: ConfigService) {
    this.appId = configService.get<string>('FACEBOOK_APP_ID');
    this.appSecret = configService.get<string>('FACEBOOK_APP_SECRET');
    this.graphApiVersion = configService.get<string>(
      'FACEBOOK_GRAPH_API_VERSION',
      'v20.0',
    );

    const redirectUriEnv = configService.get<string>(
      'FACEBOOK_REDIRECT_URIS',
      '',
    );
    this.allowedRedirectUris = redirectUriEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private get graphBaseUrl(): string {
    return `https://graph.facebook.com/${this.graphApiVersion}`;
  }

  async exchange(params: {
    code: string;
    redirectUri: string;
    state?: string;
    expectedState?: string;
  }): Promise<FacebookAccessTokenSet> {
    if (
      this.allowedRedirectUris.length > 0 &&
      !this.allowedRedirectUris.includes(params.redirectUri)
    ) {
      throw new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_BAD_REQUEST,
        'redirectUri is not in the allowed list.',
      );
    }
    if (!this.appId || !this.appSecret) {
      throw new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_CONFIG_MISSING,
        'FACEBOOK_APP_ID/FACEBOOK_APP_SECRET are not configured.',
      );
    }

    const query = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: params.redirectUri,
      code: params.code,
    });

    let response: Response;
    try {
      response = await fetch(
        `${this.graphBaseUrl}/oauth/access_token?${query.toString()}`,
      );
    } catch (err) {
      throw new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_EXCHANGE_FAILED,
        err instanceof Error ? err.message : 'Network error during exchange.',
      );
    }

    const data = (await response.json()) as FacebookTokenResponse;
    if (!response.ok || !data.access_token) {
      throw new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_EXCHANGE_FAILED,
        data.error?.message ?? 'Facebook token exchange failed.',
      );
    }

    return { accessToken: data.access_token, expiresIn: data.expires_in };
  }

  async fetchProfile(accessToken: string): Promise<SocialIdentity> {
    await this.validateAccessToken(accessToken);

    let response: Response;
    try {
      const query = new URLSearchParams({
        fields: 'id,name,email',
        access_token: accessToken,
      });
      response = await fetch(`${this.graphBaseUrl}/me?${query.toString()}`);
    } catch (err) {
      throw new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_PROFILE_FETCH_FAILED,
        err instanceof Error ? err.message : 'Network error fetching profile.',
      );
    }

    const data = (await response.json()) as FacebookProfileResponse;
    if (!response.ok || !data.id) {
      throw new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_PROFILE_FETCH_FAILED,
        data.error?.message ?? 'Facebook profile fetch failed.',
      );
    }

    return {
      provider: 'facebook',
      sub: data.id,
      email: data.email,
      name: data.name,
    };
  }

  /** Confirms the token belongs to this app before trusting it (mitigates token substitution). */
  private async validateAccessToken(accessToken: string): Promise<void> {
    if (!this.appId || !this.appSecret) {
      throw new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_CONFIG_MISSING,
        'FACEBOOK_APP_ID/FACEBOOK_APP_SECRET are not configured.',
      );
    }

    const query = new URLSearchParams({
      input_token: accessToken,
      access_token: `${this.appId}|${this.appSecret}`,
    });

    let response: Response;
    try {
      response = await fetch(
        `${this.graphBaseUrl}/debug_token?${query.toString()}`,
      );
    } catch (err) {
      throw new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_INVALID_TOKEN,
        err instanceof Error ? err.message : 'Network error validating token.',
      );
    }

    const data = (await response.json()) as FacebookDebugTokenResponse;
    if (
      !response.ok ||
      !data.data?.is_valid ||
      data.data.app_id !== this.appId
    ) {
      throw new FacebookAuthError(
        FacebookAuthErrorCode.AUTH_FACEBOOK_INVALID_TOKEN,
        data.data?.error?.message ?? 'Facebook access token is invalid.',
      );
    }
  }
}
