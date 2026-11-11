import { ConfigService } from '@nestjs/config';
import { GoogleAuthErrorCode } from '../domain/google-auth.errors';
import { GoogleOAuthClientAdapter } from './google-oauth-client.adapter';

function adapterWith(config: Record<string, string | undefined>) {
  return new GoogleOAuthClientAdapter({
    get: (key: string, fallback?: string) => config[key] ?? fallback,
  } as unknown as ConfigService);
}

// SEC-17 심층 방어: 설정이 비어 있으면 검증을 생략하지 않고 거부합니다(fail-closed).
describe('GoogleOAuthClientAdapter fail-closed configuration', () => {
  it('rejects ID tokens when GOOGLE_ALLOWED_AUDIENCES is empty instead of skipping the audience check', async () => {
    await expect(
      adapterWith({}).verifyIdToken('header.payload.signature'),
    ).rejects.toMatchObject({
      errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_CONFIG_MISSING,
    });
  });

  it('rejects the code flow when GOOGLE_OAUTH_REDIRECT_URIS is empty', async () => {
    await expect(
      adapterWith({ GOOGLE_ALLOWED_AUDIENCES: 'client.apps' }).exchange({
        code: 'c',
        redirectUri: 'https://evil.example/callback',
      }),
    ).rejects.toMatchObject({
      errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_CONFIG_MISSING,
    });
  });

  it('rejects a redirect URI outside the allowed list', async () => {
    await expect(
      adapterWith({
        GOOGLE_OAUTH_REDIRECT_URIS: 'https://app.example/callback',
      }).exchange({ code: 'c', redirectUri: 'https://evil.example/callback' }),
    ).rejects.toMatchObject({
      errorCode: GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST,
    });
  });
});
