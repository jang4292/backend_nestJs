import { IsString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

export class NaverLoginDto {
  @ValidateIf((o: NaverLoginDto) => !o.code)
  @IsString()
  @IsNotEmpty()
  accessToken?: string; // XOR with code

  @ValidateIf((o: NaverLoginDto) => !o.accessToken)
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
