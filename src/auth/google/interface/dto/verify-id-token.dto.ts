import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import {
  OIDC_NONCE_MAX_LENGTH,
  SOCIAL_TOKEN_MAX_LENGTH,
} from '../../../shared/interface/social-auth-input-limits';

export class VerifyIdTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(SOCIAL_TOKEN_MAX_LENGTH)
  idToken: string;

  @IsString()
  @IsOptional()
  @MaxLength(OIDC_NONCE_MAX_LENGTH)
  nonce?: string;
}
