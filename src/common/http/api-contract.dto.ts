import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ enum: [false], example: false })
  ok!: false;

  @ApiProperty({ description: '요청 추적 ID' })
  requestId!: string;

  @ApiProperty({ description: '기계 판독 가능한 오류 코드' })
  errorCode!: string;

  @ApiProperty({ description: '오류 설명' })
  message!: string;
}

export class ApiSuccessResponseDto {
  @ApiProperty({ enum: [true], example: true })
  ok!: true;

  @ApiProperty({ description: '요청 추적 ID' })
  requestId!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: '요청 결과 데이터',
  })
  data!: Record<string, unknown>;
}
