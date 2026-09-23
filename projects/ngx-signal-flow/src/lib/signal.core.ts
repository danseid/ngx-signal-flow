import {computed, signal, untracked} from '@angular/core';
import type {Signal} from '@angular/core';
import {produce} from 'immer';
import {assertFeatures} from './signal.features';
import type {MapSetFeature} from './signal.features';

export type BaseState<T> = T & {error?: Error};

export type StateKey<T> = keyof BaseState<T>;

export type StateValues<T, Keys extends readonly StateKey<T>[]> = {[I in keyof Keys]: BaseState<T>[Keys[I]]};

export type NonEmpty<T> = readonly [T, ...T[]];

export interface CoreSignalStore<T> {
  /**
   * Returns the current state and tracks it when read in a reactive context
   */
  (): BaseState<T>;

  /**
   * Updates the state with an Immer recipe. Unchanged drafts do not notify anyone.
   * @example
   * store.reduce(draft => {
   *   draft.count += 1;
   * });
   */
  reduce(fn: (draft: BaseState<T>) => void): void;

  /**
   * Returns a memoized signal of one state key
   * @example
   * const count = store.select('count');
   * count(); // 0
   */
  select<K extends StateKey<T>>(selector: K): Signal<BaseState<T>[K]>;

  /**
   * Derives a signal from one or more state keys. It only recomputes when one of the keys changes.
   * @example
   * const summary = store.compute('count', 'error', (count, error) => ({count, error}));
   * summary(); // {count: 0, error: undefined}
   */
  compute<const Keys extends NonEmpty<StateKey<T>>, R>(
    ...args: [...keys: Keys, fn: (...values: StateValues<T, Keys>) => R]
  ): Signal<R>;
}

export const createState = <T>(initialState: BaseState<T>) => {
  const state = signal(initialState);
  const selections = new Map<StateKey<T>, Signal<unknown>>();

  const select = <K extends StateKey<T>>(key: K): Signal<BaseState<T>[K]> => {
    const existingSelection = selections.get(key);
    if (existingSelection) {
      return existingSelection as Signal<BaseState<T>[K]>;
    }

    const selection = computed(() => state()[key]);
    selections.set(key, selection);
    return selection;
  };

  const compute = <R>(...args: unknown[]): Signal<R> => {
    const keys = args.slice(0, -1) as StateKey<T>[];
    const fn = args.at(-1) as (...values: unknown[]) => R;
    const inputs = keys.map(select);
    return computed(() => fn(...inputs.map((input) => input())));
  };

  const current = () => untracked(state);

  const set = (nextState: BaseState<T>): boolean => {
    if (Object.is(current(), nextState)) {
      return false;
    }
    state.set(nextState);
    return true;
  };

  return {
    read: state.asReadonly(),
    current,
    set,
    select,
    compute,
  };
};

/**
 * Create a store without RxJS, sources, effects or history
 * @param initialState
 * @param features Optional `withMapSet()` feature for Map and Set values
 */
export const createCoreStore = <T>(initialState: BaseState<T>, ...features: MapSetFeature[]): CoreSignalStore<T> => {
  assertFeatures(features);
  const state = createState(initialState);

  return Object.assign(() => state.read(), {
    reduce: (fn: (draft: BaseState<T>) => void) => {
      state.set(produce(state.current(), fn));
    },
    select: state.select,
    compute: state.compute,
  });
};
