import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { REQUEST_ID_HEADER } from './request-id.constants';

/**
 * 클라이언트·proxy가 보낸 x-request-id를 그대로 쓸 수 있는 형식(SEC-14).
 * UUID, ALB trace id(Root=1-…), base64 같은 값은 통과하고, 공백·제어 문자·과도한 길이는 거부해
 * 로그 위조(가짜 줄 삽입)와 거대한 로그 항목을 막습니다.
 */
const ACCEPTABLE_REQUEST_ID = /^[A-Za-z0-9._:=+/-]{1,128}$/;

@Injectable()
export class RequestIdService {
  generate(): string {
    return randomUUID();
  }

  resolve(request: Request): string {
    const fromHeader = request.headers[REQUEST_ID_HEADER];
    const requestId = (
      Array.isArray(fromHeader) ? fromHeader[0] : fromHeader
    )?.trim();
    return requestId && ACCEPTABLE_REQUEST_ID.test(requestId)
      ? requestId
      : this.generate();
  }
}
