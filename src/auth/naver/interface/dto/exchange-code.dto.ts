import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import {
  AUTH_CODE_MAX_LENGTH,
  OAUTH_STATE_MAX_LENGTH,
  REDIRECT_URI_MAX_LENGTH,
} from '../../../shared/interface/social-auth-input-limits';

export class ExchangeCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(AUTH_CODE_MAX_LENGTH)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(REDIRECT_URI_MAX_LENGTH)
  redirectUri: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(OAUTH_STATE_MAX_LENGTH)
  state: string;

  @IsString()
  @IsOptional()
  @MaxLength(OAUTH_STATE_MAX_LENGTH)
  expectedState?: string;
}
