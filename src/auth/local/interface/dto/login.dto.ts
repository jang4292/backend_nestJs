import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { LoginIdentifierType } from '../../../../users/domain/login-identifier-type.enum';

export class LoginDto {
  @IsEnum(LoginIdentifierType)
  identifierType: LoginIdentifierType;

  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
