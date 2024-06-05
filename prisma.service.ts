import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CustomWinstonLoggerService } from '@pickupp/node/nestjs/logger';
import { PrismaClient } from '@prisma/client';
import { ClsService, ClsStore } from 'nestjs-cls';

import { ExtendedPrismaClientOptions } from './prisma.extension.interface';
import {
  GeneratePrismaClientOptions, SoftDeleteExtension,
} from './prisma.extensions';

export const PRISMA_CLIENT_KEY = 'PRISMA_CLIENT_KEY';

const extendPrismaClient = ({
  configService,
  logger,
  type,
}: ExtendedPrismaClientOptions) => {
  const clientOpts = GeneratePrismaClientOptions(type, configService);
  return new PrismaClient(clientOpts)
    .$extends(SoftDeleteExtension);
};

const generateClient = ({
  eventEmitter,
  redisCacheService,
  configService,
  logger,
  type,
}: ExtendedPrismaClientOptions): ReturnType<typeof extendPrismaClient> => {
  return extendPrismaClient({
    eventEmitter,
    redisCacheService,
    configService,
    logger,
    type,
  });
};

@Injectable()
export class PrismaService implements OnModuleDestroy, OnModuleInit {
  private readInstance: ReturnType<typeof extendPrismaClient>;
  private writeInstance: ReturnType<typeof extendPrismaClient>;
  constructor(
    private logger: CustomWinstonLoggerService,
    private cls: ClsService,
    configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    const traceId = this.logger.traceId;
    this.cls.enterWith({ traceId } as ClsStore);

    this.writeInstance = generateClient({
      eventEmitter: this.eventEmitter,
      configService,
      logger: this.logger,
      type: 'write',
    });

    if (configService.get('READ_DATABASE_URL')) {
      this.readInstance = generateClient({
        eventEmitter: this.eventEmitter,
        configService,
        logger: this.logger,
        type: 'read',
      });
    }
  }

  writeClient() {
    return this.writeInstance;
  }

  readClient() {
    return this.readInstance || this.writeInstance;
  }

  getTransactionClient() {
    const transactionClient = this.cls.get(PRISMA_CLIENT_KEY) as ReturnType<
      typeof extendPrismaClient
    >;

    if (transactionClient) {
      return transactionClient;
    } else {
      return this.writeInstance;
    }
  }

  async disconnect() {
    await this.writeInstance.$disconnect();
    await this.readInstance?.$disconnect();
  }

  async onModuleDestroy() {
    await this.writeInstance.$disconnect();
    await this.readInstance?.$disconnect();
  }

  async onModuleInit() {
    await this.writeInstance.$connect();
    await this.readInstance?.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', () => {
      app.close();
    });
  }
}
