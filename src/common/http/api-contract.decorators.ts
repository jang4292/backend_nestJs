import { applyDecorators } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto, ApiSuccessResponseDto } from './api-contract.dto';

export function ApiDefaultErrorResponse(): ClassDecorator & MethodDecorator {
  return applyDecorators(
    ApiResponse({
      status: 'default',
      description: '오류는 공통 오류 envelope 형식으로 반환됩니다.',
      type: ApiErrorResponseDto,
    }),
  );
}

export function ApiSuccessEnvelope(): MethodDecorator {
  return ApiOkResponse({
    description: '요청이 성공했습니다.',
    type: ApiSuccessResponseDto,
  });
}

export function ApiProviderUnavailableResponse(): ClassDecorator {
  return ApiServiceUnavailableResponse({
    description: '해당 SNS provider가 비활성화되어 있습니다.',
    type: ApiErrorResponseDto,
  });
}
