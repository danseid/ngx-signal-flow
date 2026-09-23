/*
 * Public API Surface of ngx-signal-flow
 */

export * from './lib/signal.store';
export {createCoreStore} from './lib/signal.core';
export type {CoreSignalStore} from './lib/signal.core';
export {withHistory, withMapSet} from './lib/signal.features';
export type {HistoryFeature, HistoryOptions, MapSetFeature, StoreFeature} from './lib/signal.features';
