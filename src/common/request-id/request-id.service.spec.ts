import type { Request } from 'express';
import { RequestIdService } from './request-id.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function requestWith(value: string | string[] | undefined): Request {
  return { headers: { 'x-request-id': value } } as unknown as Request;
}

describe('RequestIdService.resolve', () => {
  const service = new RequestIdService();

  it.each([
    'c0ffee00-1234-4abc-8def-0123456789ab',
    'Root=1-67891233-abcdef012345678912345678',
    'req_01HZX.trace:42',
  ])('keeps a well-formed incoming id (%s)', (id) => {
    expect(service.resolve(requestWith(id))).toBe(id);
  });

  it('uses the first value when the header is repeated', () => {
    expect(service.resolve(requestWith(['first-id', 'second-id']))).toBe(
      'first-id',
    );
  });

  // SEC-14: 로그에 그대로 찍히므로 공백·제어 문자·과도한 길이는 받지 않고 새로 만듭니다.
  it.each([
    ['missing', undefined],
    ['empty', '   '],
    ['contains spaces', 'id with spaces'],
    ['contains a fake log line', 'abc\tERROR admin logged in'],
    ['too long', 'a'.repeat(129)],
    ['non-ascii', '요청-1'],
  ])('generates a new id when the header is %s', (_case, value) => {
    expect(service.resolve(requestWith(value))).toMatch(UUID);
  });
});
