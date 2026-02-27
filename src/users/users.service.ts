import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SocialIdentity } from '../auth/google/domain/social-identity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { username: createUserDto.username },
    });

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return await this.usersRepository.save(user);
  }

  async findOne(username: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { username } });
  }

  async findById(id: number): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { id } });
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    return await this.usersRepository.save(user);
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string | null,
  ): Promise<boolean> {
    if (!hashedPassword) return false;
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  async upsertGoogleUser(identity: SocialIdentity): Promise<User> {
    const existing = await this.findByGoogleId(identity.sub);
    if (existing) {
      existing.email = identity.email ?? existing.email;
      existing.name = identity.name ?? existing.name;
      return this.usersRepository.save(existing);
    }

    const username = `google_${identity.sub}`;
    const user = this.usersRepository.create({
      username,
      password: null,
      email: identity.email,
      name: identity.name,
      provider: identity.provider,
      googleId: identity.sub,
    });
    return this.usersRepository.save(user);
  }
}
