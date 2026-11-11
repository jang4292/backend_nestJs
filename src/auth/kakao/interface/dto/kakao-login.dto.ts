import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  MaxLength,
} from 'class-validator';
import {
  AUTH_CODE_MAX_LENGTH,
  OAUTH_STATE_MAX_LENGTH,
  REDIRECT_URI_MAX_LENGTH,
  SOCIAL_TOKEN_MAX_LENGTH,
} from '../../../shared/interface/social-auth-input-limits';

export class KakaoLoginDto {
  @ValidateIf((o: KakaoLoginDto) => !o.code)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SOCIAL_TOKEN_MAX_LENGTH)
  accessToken?: string; // XOR with code

  @ValidateIf((o: KakaoLoginDto) => !o.accessToken)
  @IsString()
  @IsNotEmpty()
  @MaxLength(AUTH_CODE_MAX_LENGTH)
  code?: string; // XOR with accessToken

  @IsString()
  @IsOptional()
  @MaxLength(REDIRECT_URI_MAX_LENGTH)
  redirectUri?: string;

  @IsString()
  @IsOptional()
  @MaxLength(OAUTH_STATE_MAX_LENGTH)
  state?: string;

  @IsString()
  @IsOptional()
  @MaxLength(OAUTH_STATE_MAX_LENGTH)
  expectedState?: string;
}
