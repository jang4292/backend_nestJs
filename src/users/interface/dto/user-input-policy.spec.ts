import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto } from '../../../auth/local/interface/dto/login.dto';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

function errorsOf<T extends object>(
  cls: new () => T,
  body: Record<string, unknown>,
): string[] {
  return validateSync(plainToInstance(cls, body)).map(
    (error) => error.property,
  );
}

const valid = { username: 'alice', password: 'correct-horse' };

describe('local account input policy (SEC-18)', () => {
  it('accepts a normal registration', () => {
    expect(errorsOf(CreateUserDto, valid)).toEqual([]);
  });

  it('requires new passwords to be at least 8 characters', () => {
    expect(errorsOf(CreateUserDto, { ...valid, password: 'short77' })).toEqual([
      'password',
    ]);
  });

  // bcrypt는 72바이트 이후를 무시하므로 더 긴 새 비밀번호는 받지 않습니다(한글 1자 = UTF-8 3바이트).
  it('rejects new passwords longer than 72 bytes in UTF-8', () => {
    expect(
      errorsOf(CreateUserDto, { ...valid, password: 'a'.repeat(72) }),
    ).toEqual([]);
    expect(
      errorsOf(CreateUserDto, { ...valid, password: 'a'.repeat(73) }),
    ).toEqual(['password']);
    expect(
      errorsOf(CreateUserDto, { ...valid, password: '가'.repeat(25) }),
    ).toEqual(['password']);
  });

  it('limits username, email and name length', () => {
    expect(
      errorsOf(CreateUserDto, {
        ...valid,
        username: 'u'.repeat(51),
        email: `${'e'.repeat(250)}@example.com`,
        name: 'n'.repeat(101),
      }).sort(),
    ).toEqual(['email', 'name', 'username']);
  });

  it('applies the new-password policy to profile updates', () => {
    expect(
      errorsOf(UpdateUserDto, {
        password: 'short77',
        currentPassword: 'old',
      }),
    ).toEqual(['password']);
  });

  // 정책 이전의 짧은·긴 기존 비밀번호로도 로그인과 비밀번호 확인이 가능해야 합니다.
  it('does not apply the new-password policy to existing passwords', () => {
    expect(
      errorsOf(LoginDto, {
        identifierType: 'username',
        identifier: 'alice',
        password: 'a'.repeat(100),
      }),
    ).toEqual([]);
    expect(
      errorsOf(UpdateUserDto, {
        password: 'correct-horse',
        currentPassword: 'old',
      }),
    ).toEqual([]);
  });

  it('bounds login input size', () => {
    expect(
      errorsOf(LoginDto, {
        identifierType: 'username',
        identifier: 'i'.repeat(256),
        password: 'p'.repeat(1025),
      }).sort(),
    ).toEqual(['identifier', 'password']);
  });
});
