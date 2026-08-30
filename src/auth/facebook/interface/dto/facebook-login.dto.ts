import { IsString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

export class FacebookLoginDto {
  @ValidateIf((o: FacebookLoginDto) => !o.code)
  @IsString()
  @IsNotEmpty()
  accessToken?: string; // XOR with code

  @ValidateIf((o: FacebookLoginDto) => !o.accessToken)
  @IsString()
  @IsNotEmpty()
  code?: string; // XOR with accessToken

  @IsString()
  @IsOptional()
  redirectUri?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  expectedState?: string;
}
