/** SNS provider 외부 호출 기본 타임아웃. provider 장애가 요청 스레드를 무기한 붙잡지 않게 합니다. */
export const SOCIAL_HTTP_TIMEOUT_MS = 5_000;

/**
 * fetch에 타임아웃을 적용합니다. 타임아웃이면 AbortSignal.timeout이 TimeoutError를 던지며,
 * 호출부의 기존 네트워크 오류 처리(catch → provider *_FAILED 오류)로 그대로 처리됩니다.
 */
export function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = SOCIAL_HTTP_TIMEOUT_MS,
): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * provider 응답 본문을 JSON으로 읽습니다. 프록시 오류 페이지처럼 JSON이 아니면 빈 객체를 반환해
 * 호출부의 `!response.ok || !data.x` 검사가 provider 오류로 처리하게 합니다.
 */
export async function readJsonSafely<T extends object>(
  response: Response,
): Promise<Partial<T>> {
  try {
    const body: unknown = await response.json();
    return body !== null && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}
