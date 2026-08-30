import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LocalLoginUseCase } from '../application/use-cases/local-login.use-case';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthLocalController {
  constructor(private readonly localLoginUseCase: LocalLoginUseCase) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body(ValidationPipe) loginDto: LoginDto) {
    return this.localLoginUseCase.execute(loginDto);
  }
}
