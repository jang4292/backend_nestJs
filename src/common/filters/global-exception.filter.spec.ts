import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { REQUEST_ID_HEADER } from '../request-id/request-id.constants';
import { RequestIdService } from '../request-id/request-id.service';

function createHost(response: {
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
}): ArgumentsHost {
  const request = {
    requestId: 'request-1',
    headers: {},
    url: '/test',
    method: 'GET',
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as ArgumentsHost;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let response: {
    setHeader: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
  };
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new GlobalExceptionFilter(new RequestIdService());
    response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('redacts sensitive values from client error responses', () => {
    filter.catch(
      new BadRequestException('DB_PASSWORD=super-secret'),
      createHost(response),
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'request-1',
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      requestId: 'request-1',
      errorCode: 'BAD_REQUEST',
      message: 'DB_PASSWORD=<redacted>',
    });
  });

  it('keeps server error responses generic and redacts logged stacks', () => {
    filter.catch(
      new Error('Failed for mariadb://app:super-secret@db.example/app'),
      createHost(response),
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      ok: false,
      requestId: 'request-1',
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
    const errorCalls = errorSpy.mock.calls as unknown as Array<
      [unknown, unknown]
    >;
    const loggedStack = errorCalls[0]?.[1];

    expect(typeof loggedStack === 'string' ? loggedStack : '').not.toContain(
      'super-secret',
    );
    expect(typeof loggedStack === 'string' ? loggedStack : '').toContain(
      'mariadb://app:<redacted>@db.example/app',
    );
  });
});
