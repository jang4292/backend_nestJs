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
  FacebookAuthError,
  FacebookAuthErrorCode,
} from '../domain/facebook-auth.errors';

@Catch(FacebookAuthError)
@Injectable()
export class FacebookAuthExceptionFilter implements ExceptionFilter<FacebookAuthError> {
  constructor(private readonly requestIdService: RequestIdService) {}

  catch(error: FacebookAuthError, host: ArgumentsHost): void {
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

  private errorCodeToHttpStatus(code: FacebookAuthErrorCode): number {
    switch (code) {
      case FacebookAuthErrorCode.AUTH_FACEBOOK_BAD_REQUEST:
        return HttpStatus.BAD_REQUEST;
      case FacebookAuthErrorCode.AUTH_FACEBOOK_CONFIG_MISSING:
        return HttpStatus.SERVICE_UNAVAILABLE;
      case FacebookAuthErrorCode.AUTH_FACEBOOK_STATE_MISMATCH:
      case FacebookAuthErrorCode.AUTH_FACEBOOK_EXCHANGE_FAILED:
      case FacebookAuthErrorCode.AUTH_FACEBOOK_INVALID_TOKEN:
      case FacebookAuthErrorCode.AUTH_FACEBOOK_PROFILE_FETCH_FAILED:
        return HttpStatus.UNAUTHORIZED;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
