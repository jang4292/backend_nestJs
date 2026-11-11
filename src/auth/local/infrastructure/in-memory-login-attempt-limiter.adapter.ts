import type { LoginAttemptLimiterPort } from '../application/ports/login-attempt-limiter.port';

/** 이 시간 안에 */
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** 이 횟수만큼 실패하면 창이 끝날 때까지 로그인을 거부합니다. */
export const LOGIN_FAILURE_LIMIT = 10;
/** 메모리 상한. 넘으면 만료 항목을 정리하고, 그래도 넘으면 오래된 항목부터 버립니다. */
export const LOGIN_FAILURE_MAX_ENTRIES = 10_000;

interface FailureWindow {
  count: number;
  resetAt: number;
}

/**
 * 프로세스 메모리에 실패 횟수를 저장하는 고정 창(fixed window) 구현입니다.
 *
 * - PM2 단일 인스턴스(fork, instances: 1) 기준입니다. 인스턴스를 늘리면 Redis 같은 공유 저장소 어댑터로 바꿔야 합니다.
 * - 재시작하면 기록이 사라집니다(차단이 풀림). 영구 잠금이 아닌 속도 제한 목적이라 허용합니다.
 * - 생성자 인자(시계, 한도)는 테스트용이며 모듈은 useFactory로 기본값을 사용합니다.
 */
export class InMemoryLoginAttemptLimiterAdapter implements LoginAttemptLimiterPort {
  private readonly windows = new Map<string, FailureWindow>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly limit = LOGIN_FAILURE_LIMIT,
    private readonly windowMs = LOGIN_FAILURE_WINDOW_MS,
    private readonly maxEntries = LOGIN_FAILURE_MAX_ENTRIES,
  ) {}

  retryAfterSeconds(key: string): number {
    const window = this.activeWindow(key);
    if (!window || window.count < this.limit) {
      return 0;
    }
    return Math.max(1, Math.ceil((window.resetAt - this.now()) / 1000));
  }

  recordFailure(key: string): void {
    const window = this.activeWindow(key);
    if (window) {
      window.count += 1;
      return;
    }
    this.windows.set(key, { count: 1, resetAt: this.now() + this.windowMs });
    this.enforceCapacity();
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  /** 테스트·관측용: 현재 추적 중인 키 수 */
  get size(): number {
    return this.windows.size;
  }

  private activeWindow(key: string): FailureWindow | undefined {
    const window = this.windows.get(key);
    if (window && window.resetAt <= this.now()) {
      this.windows.delete(key);
      return undefined;
    }
    return window;
  }

  private enforceCapacity(): void {
    if (this.windows.size <= this.maxEntries) return;

    const now = this.now();
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
    // Map은 삽입 순서를 유지하므로 앞쪽이 가장 오래된 항목입니다.
    for (const key of this.windows.keys()) {
      if (this.windows.size <= this.maxEntries) break;
      this.windows.delete(key);
    }
  }
}
