import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { KakaoAuthErrorCode } from '../domain/kakao-auth.errors';
import { KakaoOAuthClientAdapter } from './kakao-oauth-client.adapter';

function adapterWith(config: Record<string, string | undefined>) {
  return new KakaoOAuthClientAdapter({
    get: (key: string, fallback?: string) => config[key] ?? fallback,
  } as unknown as ConfigService);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('KakaoOAuthClientAdapter.verifyAccessTokenAudience', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('accepts a token whose app_id matches KAKAO_APP_ID', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, { id: 1, expires_in: 100, app_id: 123456 }),
    );

    await expect(
      adapterWith({ KAKAO_APP_ID: '123456' }).verifyAccessTokenAudience('t'),
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://kapi.kakao.com/v1/user/access_token_info',
      expect.objectContaining({
        headers: { Authorization: 'Bearer t' },
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    );
  });

  it('rejects a token issued for another app', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(200, { id: 1, app_id: 999 }));

    await expect(
      adapterWith({ KAKAO_APP_ID: '123456' }).verifyAccessTokenAudience('t'),
    ).rejects.toMatchObject({
      errorCode: KakaoAuthErrorCode.AUTH_KAKAO_INVALID_TOKEN,
    });
  });

  it('rejects an invalid or expired token', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(401, { code: -401 }));

    await expect(
      adapterWith({ KAKAO_APP_ID: '123456' }).verifyAccessTokenAudience('t'),
    ).rejects.toMatchObject({
      errorCode: KakaoAuthErrorCode.AUTH_KAKAO_INVALID_TOKEN,
    });
  });

  it('treats a non-JSON provider response as an invalid token instead of crashing', async () => {
    fetchSpy.mockResolvedValue(
      new Response('<html>bad gateway</html>', { status: 502 }),
    );

    await expect(
      adapterWith({ KAKAO_APP_ID: '123456' }).verifyAccessTokenAudience('t'),
    ).rejects.toMatchObject({
      errorCode: KakaoAuthErrorCode.AUTH_KAKAO_INVALID_TOKEN,
    });
  });

  it('skips the check with a warning when KAKAO_APP_ID is not configured (non-production only)', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await expect(
      adapterWith({}).verifyAccessTokenAudience('t'),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
