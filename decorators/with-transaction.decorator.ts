import { Inject } from '@nestjs/common';
import { ClsService } from "nestjs-cls";
import { PRISMA_CLIENT_KEY, PrismaService } from '../prisma/prisma.service';

export function WithTransaction(): MethodDecorator {
  const injectPrismaService = Inject(PrismaService);
  const injectCls = Inject(ClsService);

  return (
    target: any,
    propertyKey: string | symbol,
    // eslint-disable-next-line no-undef
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    injectPrismaService(target, 'prisma');
    injectCls(target, 'cls');

    descriptor.value = asyncDescriptorValue(originalMethod);

    return descriptor;
  };
}

const asyncDescriptorValue = (originalMethod) =>
  function (...args: any[]) {
    return this.prisma.$transaction(
      (prisma) => {
        this.cls.set(PRISMA_CLIENT_KEY, prisma);
        return originalMethod.apply(this, args).finally(() => {
          this.cls.set(PRISMA_CLIENT_KEY, null);
        });
      },
      {
        maxWait: 30000, // default: 2000
        timeout: 60000, // default: 5000
      },
    );
  };
