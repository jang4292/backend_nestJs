import { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { SessionIssuerJwtAdapter } from './session-issuer-jwt.adapter';

describe('SessionIssuerJwtAdapter', () => {
  const jwtService = new JwtService({
    secret: 'test-secret-0123456789abcdef0123456789',
    signOptions: { algorithm: 'HS256', expiresIn: 3600 },
  });
  const issuer = new SessionIssuerJwtAdapter(jwtService, {
    get: () => '1h',
  } as never as ConfigService);

  it('embeds the session version (sv) so a later bump revokes the token', async () => {
    const { accessToken, expiresIn } = await issuer.issue({
      id: 7,
      username: 'alice',
      sessionVersion: 4,
    });

    expect(expiresIn).toBe(3600);
    expect(jwtService.decode(accessToken)).toMatchObject({
      sub: 7,
      username: 'alice',
      sv: 4,
    });
  });

  it('defaults sv to 0 when the record has no session version', async () => {
    const { accessToken } = await issuer.issue({ id: 7, username: 'alice' });

    expect(jwtService.decode(accessToken)).toMatchObject({ sv: 0 });
  });
});
