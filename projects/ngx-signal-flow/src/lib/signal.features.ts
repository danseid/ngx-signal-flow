import {enableMapSet, enablePatches} from 'immer';

export const DEFAULT_HISTORY_LIMIT = 100;

export type HistoryOptions = {
  /**
   * Maximum number of undo steps to keep. Use `Infinity` to keep every change.
   * @default 100
   */
  limit?: number;
};

export type HistoryFeature = {readonly kind: 'history'; readonly limit: number};

export type MapSetFeature = {readonly kind: 'mapSet'};

export type StoreFeature = HistoryFeature | MapSetFeature;

/**
 * Records changes as Immer patches so the store can undo and redo them.
 * Loads Immer's patches plugin, which is left out of the bundle when this feature is not used.
 * @example
 * const store = createStore({count: 0}, withHistory({limit: 50}));
 */
export const withHistory = (options?: HistoryOptions): HistoryFeature => {
  enablePatches();
  return {kind: 'history', limit: options?.limit ?? DEFAULT_HISTORY_LIMIT};
};

/**
 * Allows `Map` and `Set` values in the state.
 * Loads Immer's Map and Set plugin globally, which is left out of the bundle when this feature is not used.
 * @example
 * const store = createStore({selected: new Set<number>()}, withMapSet());
 */
export const withMapSet = (): MapSetFeature => {
  enableMapSet();
  return {kind: 'mapSet'};
};

export const assertFeatures = (features: readonly Partial<StoreFeature>[]) => {
  if (features.some((feature) => feature.kind === undefined)) {
    throw new Error(
      'ngx-signal-flow: store options were replaced by features. Use createStore(state, withHistory(), withMapSet()).',
    );
  }
};

export const findHistoryFeature = (features: readonly StoreFeature[]): HistoryFeature | undefined => {
  assertFeatures(features);
  return features.find((feature): feature is HistoryFeature => feature.kind === 'history');
};
