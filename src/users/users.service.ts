import { Injectable } from '@nestjs/common';
import { User } from './entities/user.entity';
import { CreateUserDto } from './interface/dto/create-user.dto';
import { UpdateUserDto } from './interface/dto/update-user.dto';
import { LoginIdentifierType } from './domain/login-identifier-type.enum';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { FindUserUseCase } from './application/use-cases/find-user.use-case';
import { ValidatePasswordUseCase } from './application/use-cases/validate-password.use-case';

/** Thin facade over the users use-cases, kept for backward-compatible callers (auth). */
@Injectable()
export class UsersService {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly findUserUseCase: FindUserUseCase,
    private readonly validatePasswordUseCase: ValidatePasswordUseCase,
  ) {}

  create(createUserDto: CreateUserDto): Promise<User> {
    return this.createUserUseCase.execute(createUserDto);
  }

  findOne(username: string): Promise<User | null> {
    return this.findUserUseCase.byUsername(username);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findUserUseCase.byEmail(email);
  }

  findByIdentifier(
    identifierType: LoginIdentifierType,
    identifier: string,
  ): Promise<User | null> {
    return this.findUserUseCase.byIdentifier(identifierType, identifier);
  }

  findById(id: number): Promise<User | null> {
    return this.findUserUseCase.byId(id);
  }

  update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    return this.updateUserUseCase.execute(id, updateUserDto);
  }

  validatePassword(
    plainPassword: string,
    hashedPassword: string | null,
  ): Promise<boolean> {
    return this.validatePasswordUseCase.execute(plainPassword, hashedPassword);
  }
}
