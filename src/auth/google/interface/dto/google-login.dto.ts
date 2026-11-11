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
  OIDC_NONCE_MAX_LENGTH,
  PKCE_VERIFIER_MAX_LENGTH,
  REDIRECT_URI_MAX_LENGTH,
  SOCIAL_TOKEN_MAX_LENGTH,
} from '../../../shared/interface/social-auth-input-limits';

export class GoogleLoginDto {
  /** ID token from Google Identity Services (Web flow). Mutually exclusive with `code`. */
  @ValidateIf((o: GoogleLoginDto) => !o.code)
  @IsString()
  @IsNotEmpty()
  @MaxLength(SOCIAL_TOKEN_MAX_LENGTH)
  idToken?: string;

  /** Authorization code (Native/Android/iOS flow). Mutually exclusive with `idToken`. */
  @ValidateIf((o: GoogleLoginDto) => !o.idToken)
  @IsString()
  @IsNotEmpty()
  @MaxLength(AUTH_CODE_MAX_LENGTH)
  code?: string;

  /** Required when using auth code flow. */
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
  @MaxLength(PKCE_VERIFIER_MAX_LENGTH)
  codeVerifier?: string;

  @IsString()
  @IsOptional()
  @MaxLength(OAUTH_STATE_MAX_LENGTH)
  state?: string;

  @IsString()
  @IsOptional()
  @MaxLength(OAUTH_STATE_MAX_LENGTH)
  expectedState?: string;
}
