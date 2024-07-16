/* eslint-disable no-use-before-define */
// @ts-nocheck

import { Inject } from '@nestjs/common'
import dayjs from 'dayjs'

import { maskLogArgs, maskLogResult } from '../../logger'
// eslint-disable-next-line import/extensions
import { CustomWinstonLoggerService } from '../logger'
/**
 *
 */
// eslint-disable-next-line no-undef
export function Log(): MethodDecorator {
  const injectCustomWinstonLoggerService = Inject(CustomWinstonLoggerService)

  return (
    target: any,
    propertyKey: string | symbol,
    // eslint-disable-next-line no-undef
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value
    injectCustomWinstonLoggerService(target, 'logger')

    // originalMethod - might come from other decorator's descriptor.value instead of the original method
    // so it is needed to check the original method from target
    const isAsync = target[propertyKey].constructor.name === 'AsyncFunction'

    descriptor.value = isAsync ? asyncDescriptorValue(
      target,
      propertyKey,
      originalMethod,
    ) : descriptorValue(
      target,
      propertyKey,
      originalMethod,
    )

    return descriptor
  }
}

export const asyncDescriptorValue = (target, propertyKey, originalMethod) =>
  async function (...args: any[]) {
    const { logger } = this
    const startedAt = dayjs()

    const newArgs = maskLogArgs(args)

    try {
      logger.log(target.constructor.name, propertyKey, 'start', {
        args: newArgs,
      })

      return originalMethod
        .apply(this, args)
        .then((result) => {
          logger.log(target.constructor.name, propertyKey, 'end', {
            result: maskLogResult(result),
            args: newArgs,
            executeDuration: dayjs().diff(startedAt),
          })
          return result
        })
        .catch((e) => {
          logger.error(target.constructor.name, propertyKey, 'end', {
            args: newArgs,
            executeDuration: dayjs().diff(startedAt),
            error: {
              stack: e?.stack,
              message: e?.message,
            },
          })
          throw e
        })
    } catch (e) {
      logger.error(target.constructor.name, propertyKey, 'end', {
        args: newArgs,
        executeDuration: dayjs().diff(startedAt),
        error: {
          stack: e?.stack,
          message: e?.message,
        },
      })

      throw e
    }
  }

export const descriptorValue = (target, propertyKey, originalMethod) =>
  function (...args: any[]) {
    const { logger } = this
    const startedAt = dayjs()

    const newArgs = maskLogArgs(args)

    try {
      logger.log(target.constructor.name, propertyKey, 'start', {
        args: newArgs,
      })

      const result = originalMethod.apply(this, args)

      logger.log(target.constructor.name, propertyKey, 'end', {
        args: newArgs,
        result: maskLogResult(result),
        executeDuration: dayjs().diff(startedAt),
      })

      return result
    } catch (e) {
      logger.error(target.constructor.name, propertyKey, 'end', {
        args: newArgs,
        executeDuration: dayjs().diff(startedAt),
        error: {
          stack: e?.stack,
          message: e?.message,
        },
      })

      throw e
    }
  }
