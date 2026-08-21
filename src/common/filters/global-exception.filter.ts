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
    const isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.resolveMessage(exception, isServerError);
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

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }

  private resolveStack(exception: unknown): string | undefined {
    if (exception instanceof Error) {
      return exception.stack;
    }
    return undefined;
  }
}