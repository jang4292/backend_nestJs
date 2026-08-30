import type { Request } from 'express';
import type { PublicUser } from '../../users/interface/presenters/public-user.presenter';

export interface AuthenticatedRequest extends Request {
  user: PublicUser;
}
