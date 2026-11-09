import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsByteLength,
  IsOptional,
  IsEmail,
} from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from '../../domain/user-input-policy';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(USERNAME_MIN_LENGTH)
  @MaxLength(USERNAME_MAX_LENGTH)
  username: string;

  /** 8자 이상, UTF-8 72바이트 이하(bcrypt가 72바이트 이후를 무시하므로) */
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  @IsByteLength(0, PASSWORD_MAX_BYTES, {
    message: `password must be at most ${PASSWORD_MAX_BYTES} bytes in UTF-8`,
  })
  password: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  name?: string;
}
