import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RequestIdProviderPort } from '../application/ports/request-id-provider.port';

@Injectable()
export class RequestIdAdapter implements RequestIdProviderPort {
  generate(): string {
    return uuidv4();
  }
}
