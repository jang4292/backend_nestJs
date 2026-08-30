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
  KakaoAuthError,
  KakaoAuthErrorCode,
} from '../domain/kakao-auth.errors';

@Catch(KakaoAuthError)
@Injectable()
export class KakaoAuthExceptionFilter implements ExceptionFilter<KakaoAuthError> {
  constructor(private readonly requestIdService: RequestIdService) {}

  catch(error: KakaoAuthError, host: ArgumentsHost): void {
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

  private errorCodeToHttpStatus(code: KakaoAuthErrorCode): number {
    switch (code) {
      case KakaoAuthErrorCode.AUTH_KAKAO_BAD_REQUEST:
        return HttpStatus.BAD_REQUEST;
      case KakaoAuthErrorCode.AUTH_KAKAO_CONFIG_MISSING:
        return HttpStatus.SERVICE_UNAVAILABLE;
      case KakaoAuthErrorCode.AUTH_KAKAO_STATE_MISMATCH:
      case KakaoAuthErrorCode.AUTH_KAKAO_EXCHANGE_FAILED:
      case KakaoAuthErrorCode.AUTH_KAKAO_PROFILE_FETCH_FAILED:
        return HttpStatus.UNAUTHORIZED;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }
}
