import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { errorResponse } from '../../../common/http/api-response';
import { redactSensitiveText } from '../../../common/logging/redact-sensitive-text';
import { REQUEST_ID_HEADER } from '../../../common/request-id/request-id.constants';
import { RequestIdService } from '../../../common/request-id/request-id.service';
import type { RequestWithId } from '../../../common/request-id/request-with-id';
import {
  SocialAuthError,
  SocialAuthErrorKind,
} from '../domain/social-auth.error';

const STATUS_BY_KIND: Readonly<Record<SocialAuthErrorKind, number>> = {
  bad_request: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  internal: HttpStatus.INTERNAL_SERVER_ERROR,
};

const INTERNAL_ERROR_MESSAGE = 'Internal server error';

/**
 * 모든 SNS 인증 컨트롤러가 공유하는 예외 필터.
 * 응답 형식 `{ ok:false, requestId, errorCode, message }`와 오류 코드는 provider별 필터와 동일합니다.
 * 내부 오류(DB 오류 등)는 메시지를 가리고 원인을 requestId와 함께 서버 로그에만 남깁니다.
 */
@Catch(SocialAuthError)
@Injectable()
export class SocialAuthExceptionFilter implements ExceptionFilter<SocialAuthError> {
  private readonly logger = new Logger(SocialAuthExceptionFilter.name);

  constructor(private readonly requestIdService: RequestIdService) {}

  catch(error: SocialAuthError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId =
      request.requestId ?? this.requestIdService.resolve(request);
    const kind = error.kind;
    const context = {
      requestId,
      errorCode: error.errorCode,
      path: request.url,
      method: request.method,
    };

    let message = error.message;
    if (kind === 'internal') {
      this.logger.error(
        redactSensitiveText(error.message),
        redactSensitiveText(describeCause(error)),
        context,
      );
      message = INTERNAL_ERROR_MESSAGE;
    } else {
      this.logger.warn(redactSensitiveText(error.message), context);
    }

    response.setHeader(REQUEST_ID_HEADER, requestId);
    response
      .status(STATUS_BY_KIND[kind])
      .json(errorResponse(requestId, error.errorCode, message));
  }
}

function describeCause(error: Error): string {
  const cause = error.cause;
  if (cause instanceof Error) {
    return cause.stack ?? `${cause.name}: ${cause.message}`;
  }
  if (typeof cause === 'string') {
    return cause;
  }
  if (cause !== undefined) {
    try {
      return JSON.stringify(cause);
    } catch {
      return '[unserializable cause]';
    }
  }
  return error.stack ?? error.message;
}
