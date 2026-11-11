import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
  IsByteLength,
} from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_INPUT_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from '../../domain/user-input-policy';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  name?: string;

  /**
   * 새 비밀번호(CreateUserDto와 같은 정책: 8자 이상, UTF-8 72바이트 이하).
   * 바꾸면 기존 세션 토큰이 모두 무효가 되므로 클라이언트는 다시 로그인해야 합니다.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  @IsByteLength(0, PASSWORD_MAX_BYTES, {
    message: `password must be at most ${PASSWORD_MAX_BYTES} bytes in UTF-8`,
  })
  password?: string;

  /** 비밀번호가 설정된 계정이 password를 바꿀 때 필수. 기존 비밀번호이므로 최소 길이·72바이트 제한을 두지 않습니다. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_INPUT_MAX_LENGTH)
  currentPassword?: string;
}
