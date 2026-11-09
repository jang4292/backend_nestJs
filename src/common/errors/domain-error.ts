/**
 * 애플리케이션/도메인 계층이 HTTP 프레임워크에 의존하지 않고 실패를 표현하기 위한 오류 계층.
 *
 * - use-case와 domain은 이 오류만 던지고 `@nestjs/common`의 HttpException을 직접 만들지 않습니다.
 * - HTTP 상태 코드와 응답 envelope 변환은 GlobalExceptionFilter가 한 곳에서 담당합니다.
 */
export type DomainErrorKind =
  | 'invalid_argument'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  /**
   * @param message 클라이언트에 노출해도 되는 설명
   * @param code    안정적인 오류 코드(선택). 없으면 kind 기본 코드를 사용합니다.
   */
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidArgumentError extends DomainError {
  readonly kind = 'invalid_argument' as const;
}

export class UnauthorizedError extends DomainError {
  readonly kind = 'unauthorized' as const;
}

export class ForbiddenError extends DomainError {
  readonly kind = 'forbidden' as const;
}

export class NotFoundError extends DomainError {
  readonly kind = 'not_found' as const;
}

export class ConflictError extends DomainError {
  readonly kind = 'conflict' as const;
}

/** 요청 횟수 제한에 걸림(429). retryAfterSeconds가 있으면 Retry-After 헤더로 내려갑니다. */
export class RateLimitedError extends DomainError {
  readonly kind = 'rate_limited' as const;

  constructor(
    message: string,
    readonly retryAfterSeconds?: number,
    code?: string,
  ) {
    super(message, code);
  }
}
