import { IsString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

export class GoogleLoginDto {
  /** ID token from Google Identity Services (Web flow). Mutually exclusive with `code`. */
  @ValidateIf((o: GoogleLoginDto) => !o.code)
  @IsString()
  @IsNotEmpty()
  idToken?: string;

  /** Authorization code (Native/Android/iOS flow). Mutually exclusive with `idToken`. */
  @ValidateIf((o: GoogleLoginDto) => !o.idToken)
  @IsString()
  @IsNotEmpty()
  code?: string;

  /** Required when using auth code flow. */
  @IsString()
  @IsOptional()
  redirectUri?: string;

  @IsString()
  @IsOptional()
  nonce?: string;

  @IsString()
  @IsOptional()
  codeVerifier?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  expectedState?: string;
}
