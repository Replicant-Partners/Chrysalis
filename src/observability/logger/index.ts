/**
 * Logger Module - Barrel exports
 * @module observability/logger
 */

export * from './types';
export { ConsoleSink } from './ConsoleSink';
export { FileSink } from './FileSink';
export { AdaptationSink } from './AdaptationSink';
export { CentralizedLogger } from './CentralizedLogger';
export { TracingManager } from './TracingManager';
export {
  initializeLogger,
  getLogger,
  getTracer,
  getAdaptationSink,
  createCorrelationId,
} from './factory';
