import { UsersController } from './users.controller';
import type { PublicUser } from './dto/public-user.dto';
import type { User } from './entities/user.entity';
import type { UsersService } from './users.service';
import type { AuthenticatedRequest } from '../common/auth/authenticated-request';

type UsersServiceMock = Pick<UsersService, 'create' | 'update'>;

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersServiceMock>;

  const user: User = {
    id: 1,
    username: 'testuser',
    password: 'hashed-password',
    email: 'test@example.com',
    name: 'Test User',
    provider: null,
    googleId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const publicUser: PublicUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    provider: null,
    googleId: null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      update: jest.fn(),
    };
    controller = new UsersController(usersService as UsersService);
  });

  it('register returns a public user without password', async () => {
    usersService.create.mockResolvedValue(user);

    const result = await controller.register({
      username: 'testuser',
      password: 'plain-password',
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(result).toEqual(publicUser);
    expect(result).not.toHaveProperty('password');
  });

  it('profile returns the authenticated public user', () => {
    const request = { user: publicUser } as AuthenticatedRequest;

    expect(controller.getProfile(request)).toEqual(publicUser);
  });

  it('updateProfile returns a public user without password', async () => {
    usersService.update.mockResolvedValue({
      ...user,
      name: 'Updated User',
    });
    const request = { user: publicUser } as AuthenticatedRequest;

    const result = await controller.updateProfile(request, {
      name: 'Updated User',
    });

    expect(result).toMatchObject({
      id: 1,
      username: 'testuser',
      name: 'Updated User',
    });
    expect(result).not.toHaveProperty('password');
  });
});
