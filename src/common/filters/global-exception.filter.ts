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
import { errorResponse } from '../http/api-response';
import { REQUEST_ID_HEADER } from '../request-id/request-id.constants';
import { RequestIdService } from '../request-id/request-id.service';
import type { RequestWithId } from '../request-id/request-with-id';

const ERROR_CODES_BY_STATUS: Readonly<Record<number, string>> = {
  [Number(HttpStatus.BAD_REQUEST)]: 'BAD_REQUEST',
  [Number(HttpStatus.UNAUTHORIZED)]: 'UNAUTHORIZED',
  [Number(HttpStatus.FORBIDDEN)]: 'FORBIDDEN',
  [Number(HttpStatus.NOT_FOUND)]: 'NOT_FOUND',
  [Number(HttpStatus.TOO_MANY_REQUESTS)]: 'RATE_LIMITED',
};

const INTERNAL_SERVER_ERROR_STATUS = Number(HttpStatus.INTERNAL_SERVER_ERROR);
const SENSITIVE_VALUE_PLACEHOLDER = '<redacted>';
const SENSITIVE_KEY_PATTERN =
  '(?:password|passwd|pwd|secret|token|authorization|api[_-]?key|access[_-]?key|private[_-]?key|database_url|jwt_secret|db_password|google_oauth_client_secret)';
const KEY_VALUE_SECRET_PATTERN = new RegExp(
  `(${SENSITIVE_KEY_PATTERN}\\s*[:=]\\s*)(["']?)([^"',\\s}\\]]+)(\\2)`,
  'gi',
);
const DATABASE_URL_SECRET_PATTERN =
  /((?:postgres(?:ql)?|mariadb):\/\/[^:\s/@]+:)([^@\s]+)(@)/gi;
const BEARER_TOKEN_PATTERN = /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi;

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
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const isServerError = status >= INTERNAL_SERVER_ERROR_STATUS;

    const message = this.redactSensitiveText(
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

  private resolveMessage(exception: unknown, isServerError: boolean): string {
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
      return exception.stack
        ? this.redactSensitiveText(exception.stack)
        : undefined;
    }
    return undefined;
  }

  private redactSensitiveText(value: string): string {
    return value
      .replace(
        DATABASE_URL_SECRET_PATTERN,
        `$1${SENSITIVE_VALUE_PLACEHOLDER}$3`,
      )
      .replace(KEY_VALUE_SECRET_PATTERN, `$1$2${SENSITIVE_VALUE_PLACEHOLDER}$4`)
      .replace(BEARER_TOKEN_PATTERN, `$1${SENSITIVE_VALUE_PLACEHOLDER}`);
  }
}
