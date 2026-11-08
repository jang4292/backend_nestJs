import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  SessionIssuerPort,
  SessionTokens,
} from '../application/ports/session-issuer.port';
import type { SocialUserRecord } from '../../../users/application/ports/social-account-linker.port';
import { parseDurationSeconds } from '../../../config/duration';

@Injectable()
export class SessionIssuerJwtAdapter implements SessionIssuerPort {
  private readonly expiresInSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const raw = this.configService.get<string>('JWT_EXPIRES_IN', '1h');
    // SessionModule의 signOptions.expiresIn과 같은 함수로 해석합니다.
    this.expiresInSeconds = parseDurationSeconds(raw) ?? 3600;
  }

  issue(user: SocialUserRecord): Promise<SessionTokens> {
    const payload = { username: user.username, sub: user.id };
    const accessToken = this.jwtService.sign(payload);
    return Promise.resolve({ accessToken, expiresIn: this.expiresInSeconds });
  }
}
