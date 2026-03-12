import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class VerifyIdTokenDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsString()
  @IsOptional()
  nonce?: string;
}
