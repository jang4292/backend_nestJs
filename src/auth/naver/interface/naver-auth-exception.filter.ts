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
  NaverAuthError,
  NaverAuthErrorCode,
} from '../domain/naver-auth.errors';

@Catch(NaverAuthError)
@Injectable()
export class NaverAuthExceptionFilter implements ExceptionFilter<NaverAuthError> {
  constructor(private readonly requestIdService: RequestIdService) {}

  catch(error: NaverAuthError, host: ArgumentsHost): void {
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

  private errorCodeToHttpStatus(code: NaverAuthErrorCode): number {
    switch (code) {
      case NaverAuthErrorCode.AUTH_NAVER_BAD_REQUEST:
        return HttpStatus.BAD_REQUEST;
      case NaverAuthErrorCode.AUTH_NAVER_CONFIG_MISSING:
        return HttpStatus.SERVICE_UNAVAILABLE;
      case NaverAuthErrorCode.AUTH_NAVER_STATE_MISMATCH:
      case NaverAuthErrorCode.AUTH_NAVER_EXCHANGE_FAILED:
      case NaverAuthErrorCode.AUTH_NAVER_PROFILE_FETCH_FAILED:
        return HttpStatus.UNAUTHORIZED;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
