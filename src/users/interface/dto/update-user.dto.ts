import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  /** 새 비밀번호 (CreateUserDto와 같은 최소 길이) */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password?: string;

  /** 비밀번호가 설정된 계정이 password를 바꿀 때 필수 */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  currentPassword?: string;
}
