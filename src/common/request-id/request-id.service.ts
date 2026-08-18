import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { REQUEST_ID_HEADER } from './request-id.constants';

@Injectable()
export class RequestIdService {
  generate(): string {
    return randomUUID();
  }

  resolve(request: Request): string {
    const fromHeader = request.headers[REQUEST_ID_HEADER];
    const requestId = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader;
    return requestId?.trim() || this.generate();
  }
}
