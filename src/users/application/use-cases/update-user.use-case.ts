import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { UpdateUserDto } from '../../interface/dto/update-user.dto';
import { FindUserUseCase } from './find-user.use-case';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly findUser: FindUserUseCase,
  ) {}

  async execute(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findUser.byId(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }
}
