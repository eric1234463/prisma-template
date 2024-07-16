/* eslint-disable no-restricted-syntax */
import { PROPERTY_DEPS_METADATA } from '@nestjs/common/constants'

// eslint-disable-next-line import/extensions
import { CustomWinstonLoggerService } from '../logger'
import {
  asyncDescriptorValue as functionTraceLogAsyncDescriptorValue,
  descriptorValue as functionTraceLogDescriptorValue,
  // eslint-disable-next-line import/extensions
} from './log.decorator'
import {
  asyncDescriptorValue as infoTraceLogAsyncDescriptorValue,
  descriptorValue as infoTraceLogDescriptorValue,
  // eslint-disable-next-line import/extensions
} from './log.decorator'

export enum LOG_LEVEL {
  ALL_INFO,
  SLOW_METHOD_ONLY,
}

const methodParamValidate = (propertyNames: string[], methodNames?: string[]) => {
  if (!methodNames) return
  const propertiesSet = new Set(propertyNames)
  for (const methodsName of methodNames) {
    if (!propertiesSet.has(methodsName)) throw new Error(`Method ${methodsName} not found`)
  }
}

const injectService = (target: any, key: string | symbol, type: any) => {
  const originalMetadata =
    Reflect.getMetadata(PROPERTY_DEPS_METADATA, target) || []
  if (originalMetadata.find((m) => m.key === key)) return
  const newMetadata = [...originalMetadata, { key, type }]
  Reflect.defineMetadata(PROPERTY_DEPS_METADATA, newMetadata, target)
}

const getDescriptorHandler = (level: LOG_LEVEL, isAsync: boolean, isForceInfoLogMethod: boolean) => {
  if (level === LOG_LEVEL.ALL_INFO || isForceInfoLogMethod) {
    return isAsync ? infoTraceLogAsyncDescriptorValue : infoTraceLogDescriptorValue
  }

  return isAsync ? functionTraceLogAsyncDescriptorValue : functionTraceLogDescriptorValue
}

/**
 * @param { level: LOG_LEVEL; ignoreMethods: string: []; forceInfoLogMethods?: string[] } args
 */
export function LogAll(args: {
  level: LOG_LEVEL;
  ignoreMethods?: string[];
  forceInfoLogMethods?: string[]
  // eslint-disable-next-line no-undef
}): ClassDecorator {
  const { level, ignoreMethods, forceInfoLogMethods } = args

  return (constructor) => {
    const properties = Object.getOwnPropertyNames(constructor.prototype)
    methodParamValidate(properties, ignoreMethods)
    methodParamValidate(properties, forceInfoLogMethods)

    injectService(constructor, 'logger', CustomWinstonLoggerService)

    const forceInfoLogMethodsSet = new Set(forceInfoLogMethods)

    for (const property of properties) {
      if (property === 'constructor' || ignoreMethods?.includes(property)) continue
      const descriptor = Object.getOwnPropertyDescriptor(
        constructor.prototype,
        property,
      )

      if (descriptor && typeof descriptor.value === 'function') {
        const isForceInfoLogMethod = forceInfoLogMethodsSet.has(property)
        const isAsync = constructor.prototype[property].constructor.name === 'AsyncFunction'
        const descriptorHandler = getDescriptorHandler(level, isAsync, isForceInfoLogMethod)
        descriptor.value = descriptorHandler(constructor.prototype, property, descriptor.value)
        Object.defineProperty(constructor.prototype, property, descriptor)
      }
    }
  }
}
