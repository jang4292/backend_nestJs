const DURATION_PATTERN = /^(\d+)([smhd]?)$/;
const SECONDS_PER_UNIT: Readonly<Record<string, number>> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/**
 * `3600`, `30m`, `1h`, `7d` 형식의 기간을 초 단위로 변환합니다. 단위가 없으면 초입니다.
 * 형식이 맞지 않거나 0 이하이면 undefined를 반환합니다.
 *
 * JWT 서명(jsonwebtoken)과 응답의 expiresIn이 같은 값을 쓰도록 이 함수 하나로 해석합니다.
 * (jsonwebtoken은 문자열 '3600'을 3600ms로 해석하므로 문자열을 그대로 넘기지 않습니다.)
 */
export function parseDurationSeconds(value: string): number | undefined {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const seconds = Number(match[1]) * SECONDS_PER_UNIT[match[2] || 's'];
  return seconds > 0 ? seconds : undefined;
}
