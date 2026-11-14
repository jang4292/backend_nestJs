import { InternalServerErrorException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/auth/authenticated-request';
import type { RequestWithId } from '../../common/request-id/request-with-id';

export type DictionaryAdminRequest = AuthenticatedRequest & RequestWithId;

export function dictionaryRequestId(request: RequestWithId): string {
  if (!request.requestId) {
    throw new InternalServerErrorException('Request ID is unavailable');
  }
  return request.requestId;
}
