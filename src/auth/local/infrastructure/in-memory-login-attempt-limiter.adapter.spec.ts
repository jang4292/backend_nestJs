import { InMemoryLoginAttemptLimiterAdapter } from './in-memory-login-attempt-limiter.adapter';

describe('InMemoryLoginAttemptLimiterAdapter', () => {
  let now: number;
  const clock = () => now;

  beforeEach(() => {
    now = 1_000_000;
  });

  it('allows attempts until the limit is reached within the window', () => {
    const limiter = new InMemoryLoginAttemptLimiterAdapter(clock, 3, 60_000);

    limiter.recordFailure('k');
    limiter.recordFailure('k');
    expect(limiter.retryAfterSeconds('k')).toBe(0);

    limiter.recordFailure('k');
    expect(limiter.retryAfterSeconds('k')).toBe(60);
  });

  it('unblocks after the window ends', () => {
    const limiter = new InMemoryLoginAttemptLimiterAdapter(clock, 2, 60_000);
    limiter.recordFailure('k');
    limiter.recordFailure('k');

    now += 30_000;
    expect(limiter.retryAfterSeconds('k')).toBe(30);

    now += 30_000;
    expect(limiter.retryAfterSeconds('k')).toBe(0);
    expect(limiter.size).toBe(0);
  });

  it('starts a new window for failures after the previous one expired', () => {
    const limiter = new InMemoryLoginAttemptLimiterAdapter(clock, 2, 60_000);
    limiter.recordFailure('k');
    now += 61_000;
    limiter.recordFailure('k');

    expect(limiter.retryAfterSeconds('k')).toBe(0);
  });

  it('tracks keys independently and resets on success', () => {
    const limiter = new InMemoryLoginAttemptLimiterAdapter(clock, 1, 60_000);
    limiter.recordFailure('a');

    expect(limiter.retryAfterSeconds('a')).toBeGreaterThan(0);
    expect(limiter.retryAfterSeconds('b')).toBe(0);

    limiter.reset('a');
    expect(limiter.retryAfterSeconds('a')).toBe(0);
  });

  it('bounds memory by evicting expired, then oldest entries', () => {
    const limiter = new InMemoryLoginAttemptLimiterAdapter(
      clock,
      10,
      60_000,
      3,
    );
    limiter.recordFailure('expired');
    now += 61_000;
    limiter.recordFailure('a');
    limiter.recordFailure('b');
    limiter.recordFailure('c');
    expect(limiter.size).toBe(3);

    limiter.recordFailure('d');
    expect(limiter.size).toBe(3);
    expect(limiter.retryAfterSeconds('a')).toBe(0);
  });
});
