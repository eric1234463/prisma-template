/* eslint-disable @typescript-eslint/no-var-requires */
import { HttpModule } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  ClientGrpc,
} from '@nestjs/microservices';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import Mockdate from 'mockdate';
import { ClsModule, ClsService } from 'nestjs-cls';
import { join } from 'path';
import { PrismaService } from 'src/prisma/services/prisma.service';

export class AppE2eTestHelper {
  public app: INestApplication;
  public moduleBuilder: TestingModuleBuilder;
  public module: TestingModule;
  public grpcClient: ClientGrpc;
  public prismaService: PrismaService;
  public clsService: ClsService;

  async init(testModules: any[] = []) {
    try {
      this.moduleBuilder = Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            envFilePath: '../../.env.test',
          }),
          ClsModule.forRootAsync({
            useFactory: () => ({
              middleware: { mount: true, generateId: true },
              interceptor: { mount: true, generateId: true },
              guard: { mount: true, generateId: true },
            }),
            global: true,
          }),
          EventEmitterModule.forRoot(),
          HttpModule,
          ...testModules,
        ],
        providers: [],
      });
      this.module = await this.moduleBuilder.compile();
      this.app = this.module.createNestApplication();
      this.prismaService = this.app.get(PrismaService);
      this.clsService = this.app.get(ClsService);

      await this.app.init();
      await this.app.startAllMicroservices();
    } catch (e) {
      console.log(e);
    }
  }

  async close() {
    await this.clearDatabase();
    await this.prismaService.disconnect();
    await this.app.close();
  }

  async clearDatabase() {
    Mockdate.reset();
    jest.restoreAllMocks();
  }
}
