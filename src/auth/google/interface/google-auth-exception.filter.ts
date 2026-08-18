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
  GoogleAuthError,
  GoogleAuthErrorCode,
} from '../domain/google-auth.errors';

@Catch(GoogleAuthError)
@Injectable()
export class GoogleAuthExceptionFilter implements ExceptionFilter<GoogleAuthError> {
  constructor(private readonly requestIdService: RequestIdService) {}

  catch(error: GoogleAuthError, host: ArgumentsHost): void {
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

  private errorCodeToHttpStatus(code: GoogleAuthErrorCode): number {
    switch (code) {
      case GoogleAuthErrorCode.AUTH_GOOGLE_BAD_REQUEST:
        return HttpStatus.BAD_REQUEST;
      case GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_AUDIENCE:
      case GoogleAuthErrorCode.AUTH_GOOGLE_INVALID_ISSUER:
      case GoogleAuthErrorCode.AUTH_GOOGLE_TOKEN_EXPIRED:
      case GoogleAuthErrorCode.AUTH_GOOGLE_MISSING_SUB:
      case GoogleAuthErrorCode.AUTH_GOOGLE_NONCE_MISMATCH:
      case GoogleAuthErrorCode.AUTH_GOOGLE_STATE_MISMATCH:
      case GoogleAuthErrorCode.AUTH_GOOGLE_EXCHANGE_FAILED:
        return HttpStatus.UNAUTHORIZED;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
