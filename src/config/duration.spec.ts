import { parseDurationSeconds } from './duration';

describe('parseDurationSeconds', () => {
  it.each([
    ['3600', 3600],
    ['45s', 45],
    ['30m', 1800],
    ['1h', 3600],
    ['7d', 604800],
    [' 2h ', 7200],
  ])('parses %p as %p seconds', (value, expected) => {
    expect(parseDurationSeconds(value)).toBe(expected);
  });

  it.each(['', '0', '1w', '7 days', '-1h', '1.5h'])('rejects %p', (value) => {
    expect(parseDurationSeconds(value)).toBeUndefined();
  });
});
