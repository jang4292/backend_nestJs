import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  ValidateNested,
  IsObject,
  IsEmail,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AUTH_CODE_MAX_LENGTH,
  OAUTH_STATE_MAX_LENGTH,
  OIDC_NONCE_MAX_LENGTH,
  REDIRECT_URI_MAX_LENGTH,
  SOCIAL_EMAIL_MAX_LENGTH,
  SOCIAL_PROFILE_NAME_MAX_LENGTH,
  SOCIAL_TOKEN_MAX_LENGTH,
} from '../../../shared/interface/social-auth-input-limits';

class AppleUserNameDto {
  @IsString()
  @IsOptional()
  @MaxLength(SOCIAL_PROFILE_NAME_MAX_LENGTH)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(SOCIAL_PROFILE_NAME_MAX_LENGTH)
  lastName?: string;
}

class AppleUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(SOCIAL_PROFILE_NAME_MAX_LENGTH)
  name?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(SOCIAL_EMAIL_MAX_LENGTH)
  email?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => AppleUserNameDto)
  nameParts?: AppleUserNameDto;
}

export class AppleLoginDto {
  @ValidateIf((o: AppleLoginDto) => !o.code)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SOCIAL_TOKEN_MAX_LENGTH)
  idToken?: string; // XOR with code

  @ValidateIf((o: AppleLoginDto) => !o.idToken)
  @IsString()
  @IsNotEmpty()
  @MaxLength(AUTH_CODE_MAX_LENGTH)
  code?: string; // XOR with idToken

  @IsString()
  @IsOptional()
  @MaxLength(REDIRECT_URI_MAX_LENGTH)
  redirectUri?: string;

  @IsString()
  @IsOptional()
  @MaxLength(OIDC_NONCE_MAX_LENGTH)
  nonce?: string;

  @IsString()
  @IsOptional()
  @MaxLength(OAUTH_STATE_MAX_LENGTH)
  state?: string;

  @IsString()
  @IsOptional()
  @MaxLength(OAUTH_STATE_MAX_LENGTH)
  expectedState?: string;

  /** Only present on Apple's first-authorization callback */
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => AppleUserDto)
  user?: AppleUserDto;
}
