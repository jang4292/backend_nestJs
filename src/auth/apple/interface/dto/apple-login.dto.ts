import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class AppleUserNameDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;
}

class AppleUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
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
  idToken?: string; // XOR with code

  @ValidateIf((o: AppleLoginDto) => !o.idToken)
  @IsString()
  @IsNotEmpty()
  code?: string; // XOR with idToken

  @IsString()
  @IsOptional()
  redirectUri?: string;

  @IsString()
  @IsOptional()
  nonce?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  expectedState?: string;

  /** Only present on Apple's first-authorization callback */
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => AppleUserDto)
  user?: AppleUserDto;
}
