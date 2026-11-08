import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError, DomainErrorKind } from '../errors/domain-error';
import { errorResponse } from '../http/api-response';
import { redactSensitiveText } from '../logging/redact-sensitive-text';
import { REQUEST_ID_HEADER } from '../request-id/request-id.constants';
import { RequestIdService } from '../request-id/request-id.service';
import type { RequestWithId } from '../request-id/request-with-id';

const ERROR_CODES_BY_STATUS: Readonly<Record<number, string>> = {
  [Number(HttpStatus.BAD_REQUEST)]: 'BAD_REQUEST',
  [Number(HttpStatus.UNAUTHORIZED)]: 'UNAUTHORIZED',
  [Number(HttpStatus.FORBIDDEN)]: 'FORBIDDEN',
  [Number(HttpStatus.NOT_FOUND)]: 'NOT_FOUND',
  [Number(HttpStatus.CONFLICT)]: 'CONFLICT',
  [Number(HttpStatus.PAYLOAD_TOO_LARGE)]: 'PAYLOAD_TOO_LARGE',
  [Number(HttpStatus.UNPROCESSABLE_ENTITY)]: 'UNPROCESSABLE_ENTITY',
  [Number(HttpStatus.TOO_MANY_REQUESTS)]: 'RATE_LIMITED',
  [Number(HttpStatus.SERVICE_UNAVAILABLE)]: 'SERVICE_UNAVAILABLE',
};

/** application/domain 계층의 DomainError를 HTTP 상태로 변환하는 단일 매핑 */
const STATUS_BY_DOMAIN_ERROR_KIND: Readonly<Record<DomainErrorKind, number>> = {
  invalid_argument: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
};

const INTERNAL_SERVER_ERROR_STATUS = Number(HttpStatus.INTERNAL_SERVER_ERROR);

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly requestIdService: RequestIdService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId =
      request.requestId ?? this.requestIdService.resolve(request as Request);
    const status = this.resolveStatus(exception);
    const isServerError = status >= INTERNAL_SERVER_ERROR_STATUS;

    const message = redactSensitiveText(
      this.resolveMessage(exception, isServerError),
    );
    const errorCode = this.resolveErrorCode(exception, status);

    if (isServerError) {
      this.logger.error(message, this.resolveStack(exception), {
        requestId,
        path: request.url,
        method: request.method,
      });
    } else {
      this.logger.warn(message, {
        requestId,
        path: request.url,
        method: request.method,
      });
    }

    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.status(status).json(errorResponse(requestId, errorCode, message));
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (exception instanceof DomainError) {
      return STATUS_BY_DOMAIN_ERROR_KIND[exception.kind];
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(exception: unknown, isServerError: boolean): string {
    if (exception instanceof DomainError) {
      return exception.message;
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const responseMessage = (response as { message?: unknown }).message;
        if (Array.isArray(responseMessage)) {
          return responseMessage.join(', ');
        }
        if (typeof responseMessage === 'string') {
          return responseMessage;
        }
      }
      return exception.message;
    }

    if (isServerError) {
      return 'Internal server error';
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Unexpected error';
  }

  private resolveErrorCode(exception: unknown, status: number): string {
    if (exception instanceof DomainError && exception.code) {
      return exception.code;
    }

    if (
      exception instanceof HttpException &&
      typeof exception.getResponse() === 'object' &&
      exception.getResponse() !== null
    ) {
      const maybeCode = (exception.getResponse() as { errorCode?: unknown })
        .errorCode;
      if (typeof maybeCode === 'string' && maybeCode.trim()) {
        return maybeCode;
      }
    }

    return ERROR_CODES_BY_STATUS[status] ?? 'INTERNAL_SERVER_ERROR';
  }

  private resolveStack(exception: unknown): string | undefined {
    if (exception instanceof Error) {
      return exception.stack ? redactSensitiveText(exception.stack) : undefined;
    }
    return undefined;
  }
}
