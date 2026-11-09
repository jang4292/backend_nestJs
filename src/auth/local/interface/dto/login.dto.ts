import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { LoginIdentifierType } from '../../../../users/domain/login-identifier-type.enum';
import {
  LOGIN_IDENTIFIER_MAX_LENGTH,
  PASSWORD_INPUT_MAX_LENGTH,
} from '../../../../users/domain/user-input-policy';

export class LoginDto {
  @IsEnum(LoginIdentifierType)
  identifierType: LoginIdentifierType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(LOGIN_IDENTIFIER_MAX_LENGTH)
  identifier: string;

  /** 기존 비밀번호 확인용이라 72바이트 제한을 두지 않고 요청 크기만 제한합니다. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_INPUT_MAX_LENGTH)
  password: string;
}
