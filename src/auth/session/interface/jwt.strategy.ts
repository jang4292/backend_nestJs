import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JWT_ALGORITHM } from './jwt.constants';
import { UsersService } from '../../../users/users.service';
import {
  PublicUser,
  toPublicUser,
} from '../../../users/interface/presenters/public-user.presenter';

interface JwtPayload {
  sub: number;
  username: string;
  /** 세션 무효화 버전. 이 필드가 생기기 전에 발급된 토큰에는 없으며 0으로 간주합니다. */
  sv?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET is not configured. Please set JWT_SECRET in your environment variables.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate(payload: JwtPayload): Promise<PublicUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    // 비밀번호 변경 등으로 세션 버전이 올라가면 그 전에 발급된 토큰을 거부합니다(AUTH-3).
    if ((payload.sv ?? 0) !== (user.sessionVersion ?? 0)) {
      throw new UnauthorizedException('Session has been revoked');
    }
    return toPublicUser(user);
  }
}
