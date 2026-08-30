import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  SessionIssuerPort,
  SessionTokens,
} from '../application/ports/session-issuer.port';
import type { SocialUserRecord } from '../../../users/application/ports/social-account-linker.port';

@Injectable()
export class SessionIssuerJwtAdapter implements SessionIssuerPort {
  private readonly expiresInSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const raw = this.configService.get<string>('JWT_EXPIRES_IN', '1h');
    this.expiresInSeconds = this.parseExpiresIn(raw);
  }

  issue(user: SocialUserRecord): Promise<SessionTokens> {
    const payload = { username: user.username, sub: user.id };
    const accessToken = this.jwtService.sign(payload);
    return Promise.resolve({ accessToken, expiresIn: this.expiresInSeconds });
  }

  private parseExpiresIn(value: string): number {
    const match = /^(\d+)([smhd]?)$/.exec(value.trim());
    if (!match) return 3600;
    const amount = parseInt(match[1], 10);
    const unit = match[2] || 's';
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return amount * (multipliers[unit] ?? 1);
  }
}
