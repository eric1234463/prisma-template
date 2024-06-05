import { ConfigService } from '@nestjs/config';
import {
  Prisma,
} from '@prisma/client';


export const GeneratePrismaClientOptions = (
  type: 'read' | 'write',
  configService: ConfigService,
): Prisma.PrismaClientOptions | null => {
  if (!type) return null;
  const databaseTypeUrlMap = {
    read: configService.get('READ_DATABASE_URL'),
    write: configService.get('DATABASE_URL'),
    default: configService.get('DATABASE_URL'),
  };
  const poolConnectionLimit = configService.get(
    'DATABASE_POOL_CONNECTION_LIMIT',
  );
  const poolTimeout = configService.get('DATABASE_POOL_TIMEOUT');
  const connectTimeout = configService.get('DATABASE_CONNECT_TIMEOUT');
  const databaseUrl = databaseTypeUrlMap[type] || databaseTypeUrlMap.default;
  return {
    datasources: {
      db: {
        url: `${databaseUrl}&connection_limit=${poolConnectionLimit || 15
          }&pool_timeout=${poolTimeout || 30}&connect_timeout=${connectTimeout || 30
          }`,
      },
    },
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  };
};

export const SoftDeleteExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'soft-delete',
    query: {
      $allModels: {
        async delete({ model, args, query }) {
          if (process.env.NODE_ENV === 'test') return query(args)

          return client[model].update({
            ...args,
            data: { deletedAt: new Date() },
          })
        },
        async deleteMany({ model, args, query }) {
          if (process.env.NODE_ENV === 'test') return query(args)

          return client[model].updateMany({
            ...args,
            data: { deletedAt: new Date() },
          })
        },
      },
      // make sure to ignore soft deleted data
      async $allOperations({ operation, args, query }) {
        const findAction = [
          'findFirst',
          'count',
          'findMany',
          'aggregate',
          'findUnique',
        ]

        if (findAction.includes(operation)) {
          const operationArgs: any = args
          // @ts-ignore
          if (!operationArgs.includeDeleted) {
            // @ts-ignore
            args.where = { ...args.where, deletedAt: null }
          }
        }
        return query(args)
      },
    },
  })
})