import { IsString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

export class KakaoLoginDto {
  @ValidateIf((o: KakaoLoginDto) => !o.code)
  @IsString()
  @IsNotEmpty()
  accessToken?: string; // XOR with code

  @ValidateIf((o: KakaoLoginDto) => !o.accessToken)
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
