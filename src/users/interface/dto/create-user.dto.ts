import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsEmail,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
