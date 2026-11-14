import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DictionaryAdminService } from './application/dictionary-admin.service';
import { DictionaryLiveService } from './application/dictionary-live.service';
import { dictionaryEntities } from './entities/dictionary.entities';
import { DictionaryAdminController } from './interface/dictionary-admin.controller';
import { DictionaryHealthController } from './interface/dictionary-health.controller';
import { DictionaryLiveController } from './interface/dictionary-live.controller';

@Module({
  imports: [TypeOrmModule.forFeature(dictionaryEntities)],
  controllers: [
    DictionaryAdminController,
    DictionaryLiveController,
    DictionaryHealthController,
  ],
  providers: [DictionaryAdminService, DictionaryLiveService],
})
export class DictionaryModule {}
