export const LOGIN_ATTEMPT_LIMITER_PORT = Symbol('LoginAttemptLimiterPort');

/**
 * 계정(로그인 식별자) 단위 실패 횟수 제한(SEC-19).
 *
 * IP 단위 제한(@Throttle)만으로는 여러 IP로 나눠 한 계정을 공격하는 무차별 대입을 막지 못합니다.
 * 존재하지 않는 계정도 같은 방식으로 세므로 차단 여부로 계정 존재를 알 수 없습니다.
 */
export interface LoginAttemptLimiterPort {
  /** 차단 중이면 남은 시간(초), 아니면 0 */
  retryAfterSeconds(key: string): number;
  /** 로그인 실패 1회를 기록합니다. */
  recordFailure(key: string): void;
  /** 로그인 성공 시 실패 기록을 지웁니다. */
  reset(key: string): void;
}
