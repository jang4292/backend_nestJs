import { ConfigService } from '@nestjs/config';
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

  // fail-closed: 설정이 없으면 검증을 건너뛰지 않고 거부합니다(SEC-17 심층 방어).
  it('rejects without calling Kakao when KAKAO_APP_ID is not configured', async () => {
    await expect(
      adapterWith({}).verifyAccessTokenAudience('t'),
    ).rejects.toMatchObject({
      errorCode: KakaoAuthErrorCode.AUTH_KAKAO_CONFIG_MISSING,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('KakaoOAuthClientAdapter.exchange', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('rejects the code flow when KAKAO_REDIRECT_URIS is not configured', async () => {
    await expect(
      adapterWith({ KAKAO_REST_API_KEY: 'k' }).exchange({
        code: 'c',
        redirectUri: 'https://evil.example/callback',
      }),
    ).rejects.toMatchObject({
      errorCode: KakaoAuthErrorCode.AUTH_KAKAO_CONFIG_MISSING,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a redirect URI outside the allowed list', async () => {
    await expect(
      adapterWith({
        KAKAO_REST_API_KEY: 'k',
        KAKAO_REDIRECT_URIS: 'https://app.example/callback',
      }).exchange({ code: 'c', redirectUri: 'https://evil.example/callback' }),
    ).rejects.toMatchObject({
      errorCode: KakaoAuthErrorCode.AUTH_KAKAO_BAD_REQUEST,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
