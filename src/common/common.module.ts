import { Module } from '@nestjs/common';
import { RequestIdInterceptor } from './request-id/request-id.interceptor';
import { RequestIdService } from './request-id/request-id.service';

@Module({
  providers: [RequestIdService, RequestIdInterceptor],
  exports: [RequestIdService, RequestIdInterceptor],
})
export class CommonModule {}
