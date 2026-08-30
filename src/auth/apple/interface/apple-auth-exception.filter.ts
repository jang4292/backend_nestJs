import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';
import { errorResponse } from '../../../common/http/api-response';
import { REQUEST_ID_HEADER } from '../../../common/request-id/request-id.constants';
import { RequestIdService } from '../../../common/request-id/request-id.service';
import type { RequestWithId } from '../../../common/request-id/request-with-id';
import {
  AppleAuthError,
  AppleAuthErrorCode,
} from '../domain/apple-auth.errors';

@Catch(AppleAuthError)
@Injectable()
export class AppleAuthExceptionFilter implements ExceptionFilter<AppleAuthError> {
  constructor(private readonly requestIdService: RequestIdService) {}

  catch(error: AppleAuthError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId =
      request.requestId ?? this.requestIdService.resolve(request);

    response.setHeader(REQUEST_ID_HEADER, requestId);
    response
      .status(this.errorCodeToHttpStatus(error.errorCode))
      .json(errorResponse(requestId, error.errorCode, error.message));
  }

  private errorCodeToHttpStatus(code: AppleAuthErrorCode): number {
    switch (code) {
      case AppleAuthErrorCode.AUTH_APPLE_BAD_REQUEST:
        return HttpStatus.BAD_REQUEST;
      case AppleAuthErrorCode.AUTH_APPLE_CONFIG_MISSING:
        return HttpStatus.SERVICE_UNAVAILABLE;
      case AppleAuthErrorCode.AUTH_APPLE_INVALID_AUDIENCE:
      case AppleAuthErrorCode.AUTH_APPLE_INVALID_ISSUER:
      case AppleAuthErrorCode.AUTH_APPLE_TOKEN_EXPIRED:
      case AppleAuthErrorCode.AUTH_APPLE_MISSING_SUB:
      case AppleAuthErrorCode.AUTH_APPLE_STATE_MISMATCH:
      case AppleAuthErrorCode.AUTH_APPLE_EXCHANGE_FAILED:
        return HttpStatus.UNAUTHORIZED;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
