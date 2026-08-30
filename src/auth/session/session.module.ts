import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../../users/users.module';

import { SESSION_ISSUER_PORT } from './application/ports/session-issuer.port';
import { SessionIssuerJwtAdapter } from './infrastructure/session-issuer-jwt.adapter';
import { JwtStrategy } from './interface/jwt.strategy';

/**
 * Provider-agnostic JWT session issuance and verification, shared by every
 * login flow (local password login and all SNS providers). This is the
 * single place in the codebase that registers JwtModule for signing session
 * tokens, and it owns the JwtStrategy used to protect routes.
 */
@Module({
  imports: [
    PassportModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not configured.');
        }
        return {
          secret,
          signOptions: {
            expiresIn: configService.get('JWT_EXPIRES_IN') || '1h',
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    SessionIssuerJwtAdapter,
    { provide: SESSION_ISSUER_PORT, useExisting: SessionIssuerJwtAdapter },
    JwtStrategy,
  ],
  exports: [SESSION_ISSUER_PORT],
})
export class SessionModule {}
