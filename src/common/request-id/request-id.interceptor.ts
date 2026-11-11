import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Response } from 'express';
import { REQUEST_ID_HEADER } from './request-id.constants';
import { RequestIdService } from './request-id.service';
import type { RequestWithId } from './request-with-id';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  constructor(private readonly requestIdService: RequestIdService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const requestId = this.requestIdService.resolve(request);

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    return next.handle();
  }
}
