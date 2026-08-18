import { IssueSessionTokenUseCase } from './issue-session-token.use-case';
import {
  SESSION_ISSUER_PORT,
  SessionIssuerPort,
  SessionTokens,
} from '../ports/session-issuer.port';
import { SocialUserRecord } from '../ports/social-user-repository.port';
import { Test } from '@nestjs/testing';

describe('IssueSessionTokenUseCase', () => {
  let useCase: IssueSessionTokenUseCase;
  let issuer: jest.Mocked<SessionIssuerPort>;

  const user: SocialUserRecord = {
    id: 1,
    username: 'google_117123456789',
    email: 'user@example.com',
  };

  const tokens: SessionTokens = {
    accessToken: 'jwt.token.here',
    expiresIn: 3600,
  };

  beforeEach(async () => {
    issuer = { issue: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        IssueSessionTokenUseCase,
        { provide: SESSION_ISSUER_PORT, useValue: issuer },
      ],
    }).compile();

    useCase = module.get(IssueSessionTokenUseCase);
  });

  it('should return session tokens for valid user', async () => {
    issuer.issue.mockResolvedValue(tokens);
    const result = await useCase.execute(user);
    expect(result).toEqual(tokens);
    expect(issuer.issue.mock.calls[0]).toEqual([user]);
  });
});
