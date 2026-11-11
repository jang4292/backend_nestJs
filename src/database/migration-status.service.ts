import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, MigrationExecutor } from 'typeorm';

/** 환경별로 실행할 migration 명령(안내 메시지용) */
const MIGRATION_RUN_COMMAND: Record<string, string> = {
  development: 'npm run migration:run',
  test: 'npm run migration:run:test',
  production: 'npm run migration:run:prod',
};

/**
 * 기동 시 적용되지 않은 migration이 있는지 확인해 로그로 알립니다(읽기 전용).
 *
 * 스키마 변경은 배포 단계에서 명령으로 적용하는 것이 원칙이므로(자동 실행하지 않음),
 * 그 단계를 빠뜨렸을 때 `Unknown column` 같은 런타임 오류 전에 원인을 알 수 있게 합니다.
 * 기동은 막지 않으며, 조회에 실패해도 앱 동작에는 영향을 주지 않습니다.
 */
@Injectable()
export class MigrationStatusService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Migrations');

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const pending = await this.findPendingMigrations();
    if (!pending || pending.length === 0) {
      return;
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const command =
      MIGRATION_RUN_COMMAND[nodeEnv] ?? MIGRATION_RUN_COMMAND.development;
    const message = `${pending.length} pending migration(s): ${pending.join(', ')}. Run \`${command}\` — features that need the new schema will fail until then.`;

    if (nodeEnv === 'production') {
      this.logger.error(message);
    } else {
      this.logger.warn(message);
    }
  }

  /** pending migration 이름 목록. 확인할 수 없으면 undefined */
  async findPendingMigrations(): Promise<string[] | undefined> {
    try {
      if (!this.dataSource.isInitialized) {
        return undefined;
      }
      // migrations 테이블이 없으면 전체를 pending으로 돌려주며, 테이블을 만들지 않습니다.
      const pending = await new MigrationExecutor(
        this.dataSource,
      ).getPendingMigrations();
      return pending.map((migration) => migration.name);
    } catch (error) {
      this.logger.debug(
        `Skipped pending migration check: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }
}
