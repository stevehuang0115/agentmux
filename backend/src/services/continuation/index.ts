/**
 * Continuation Detection Services
 *
 * Services for detecting when agents stop/idle and determining
 * whether to continue their work automatically.
 *
 * @module services/continuation
 */

export { ContinuationEventEmitter } from './continuation-events.service.js';
export {
  OutputAnalyzer,
  type CompletionSignals,
  type ErrorSignals,
  type WaitingSignals,
  type AnalyzeParams,
} from './output-analyzer.service.js';
export {
  ContinuationService,
  type ContinuationConfig,
  type SessionContinuationStatus,
  type ContinuationNotification,
} from './continuation.service.js';

// Re-export patterns for extensibility
export * from './patterns/index.js';
