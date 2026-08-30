import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../../../users/users.service';
import { LoginIdentifierType } from '../../../../users/domain/login-identifier-type.enum';
import {
  PublicUser,
  toPublicUser,
} from '../../../../users/interface/presenters/public-user.presenter';
import { SESSION_ISSUER_PORT } from '../../../session/application/ports/session-issuer.port';
import type { SessionIssuerPort } from '../../../session/application/ports/session-issuer.port';

export interface LocalLoginInput {
  identifierType: LoginIdentifierType;
  identifier: string;
  password: string;
}

export interface LocalLoginOutput {
  access_token: string;
  user: PublicUser;
}

@Injectable()
export class LocalLoginUseCase {
  constructor(
    private readonly usersService: UsersService,
    @Inject(SESSION_ISSUER_PORT)
    private readonly sessionIssuer: SessionIssuerPort,
  ) {}

  async execute(input: LocalLoginInput): Promise<LocalLoginOutput> {
    const user = await this.usersService.findByIdentifier(
      input.identifierType,
      input.identifier,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      input.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.sessionIssuer.issue(user);
    return { access_token: session.accessToken, user: toPublicUser(user) };
  }
}
