import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { LoginIdentifierType } from '../../domain/login-identifier-type.enum';

@Injectable()
export class FindUserUseCase {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  byUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  byEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  byIdentifier(
    identifierType: LoginIdentifierType,
    identifier: string,
  ): Promise<User | null> {
    return identifierType === LoginIdentifierType.EMAIL
      ? this.byEmail(identifier)
      : this.byUsername(identifier);
  }

  byId(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }
}
