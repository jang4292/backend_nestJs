import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ExchangeCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  redirectUri: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsOptional()
  expectedState?: string;
}
