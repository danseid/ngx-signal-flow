import {applyPatches, enableMapSet, enablePatches, produce, produceWithPatches} from 'immer';
import type {Patch} from 'immer';
import {BehaviorSubject, combineLatest, Subscription} from 'rxjs';
import type {Observable, Subject} from 'rxjs';
import {createState} from './signal.core';
import type {BaseState, CoreSignalStore} from './signal.core';
import {createEffect, createStoreEffect} from './signal.effect';
import type {Effect, StoreEffect} from './signal.effect';
import {createPatchHistory} from './signal.history';
import {createSource} from './signal.source';
import type {ConnectOptions, Source} from './signal.source';

export type {BaseState} from './signal.core';
export type {ConnectOptions, Effect, Source, StoreEffect};

export type SignalStateOptions = {
  withPatches?: boolean;
  withMapSet?: boolean;
  historyLimit?: number;
};

export interface SignalStore<T> extends CoreSignalStore<T> {
  /**
   * Creates a new source. A source is a way to interact with the store
   * @param startValue The optional start value of the source
   * @returns The source
   * @example
   * const source = store.source(0);
   * source.reduce((draft, value) => {
   *   draft.count = value;
   * });
   * source(1);
   */
  source<S>(startValue?: S): Source<T, S>;

  /**
   * Emits the current state and every later change, in the order the changes happened
   */
  asObservable(): Observable<BaseState<T>>;

  /**
   * Updates the state with an Immer recipe. Unchanged drafts do not notify anyone.
   * @example
   * store.reduce(draft => {
   *   draft.count += 1;
   * });
   */
  reduce(fn: (draft: BaseState<T>) => void): void;

  /**
   * Reduces the latest values of all sources into the state once every source has emitted.
   * @example
   * store.reduce(countSource, nameSource, (draft, count, name) => {
   *   draft.count = count;
   *   draft.name = name;
   * });
   */
  reduce<S1>(s1: Source<T, S1>, fn: (draft: BaseState<T>, s1: S1) => void): Subscription;

  reduce<S1, S2>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    fn: (draft: BaseState<T>, s1: S1, s2: S2) => void,
  ): Subscription;

  reduce<S1, S2, S3>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    fn: (draft: BaseState<T>, s1: S1, s2: S2, s3: S3) => void,
  ): Subscription;

  reduce<S1, S2, S3, S4>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    fn: (draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4) => void,
  ): Subscription;

  reduce<S1, S2, S3, S4, S5>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    s5: Source<T, S5>,
    fn: (draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5) => void,
  ): Subscription;

  reduce<S1, S2, S3, S4, S5, S6>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    s5: Source<T, S5>,
    s6: Source<T, S6>,
    fn: (draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5, s6: S6) => void,
  ): Subscription;

  reduce<S1, S2, S3, S4, S5, S6, S7>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    s5: Source<T, S5>,
    s6: Source<T, S6>,
    s7: Source<T, S7>,
    fn: (draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5, s6: S6, s7: S7) => void,
  ): Subscription;

  reduce<S1, S2, S3, S4, S5, S6, S7, S8>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    s5: Source<T, S5>,
    s6: Source<T, S6>,
    s7: Source<T, S7>,
    s8: Source<T, S8>,
    fn: (draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5, s6: S6, s7: S7, s8: S8) => void,
  ): Subscription;

  reduce<S1, S2, S3, S4, S5, S6, S7, S8, S9>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    s5: Source<T, S5>,
    s6: Source<T, S6>,
    s7: Source<T, S7>,
    s8: Source<T, S8>,
    s9: Source<T, S9>,
    fn: (draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5, s6: S6, s7: S7, s8: S8, s9: S9) => void,
  ): Subscription;

  /**
   * Runs a function with the current state and again after every change
   * @example
   * store.effect(state => console.log('State changed:', state));
   */
  effect(effectFn: (value: BaseState<T>) => void): StoreEffect;

  /**
   * Runs an observable side effect for the latest values of all sources. A new value cancels the previous run.
   * @example
   * const loadEffect = store.effect(idSource, id => http.get(`/items/${id}`));
   * loadEffect.reduce((draft, item) => {
   *   draft.item = item;
   * });
   * loadEffect.loading(); // true while the request is running
   */
  effect<S1, R>(s1: Source<T, S1>, effectFn: (value: S1) => Observable<R>): Effect<T, R>;

  effect<S1, S2, R>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    effectFn: (value1: S1, value2: S2) => Observable<R>,
  ): Effect<T, R>;

  effect<S1, S2, S3, R>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    effectFn: (value1: S1, value2: S2, value3: S3) => Observable<R>,
  ): Effect<T, R>;

  effect<S1, S2, S3, S4, R>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    effectFn: (value1: S1, value2: S2, value3: S3, value4: S4) => Observable<R>,
  ): Effect<T, R>;

  effect<S1, S2, S3, S4, S5, R>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    s5: Source<T, S5>,
    effectFn: (value1: S1, value2: S2, value3: S3, value4: S4, value5: S5) => Observable<R>,
  ): Effect<T, R>;

  effect<S1, S2, S3, S4, S5, S6, R>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    s5: Source<T, S5>,
    s6: Source<T, S6>,
    effectFn: (value1: S1, value2: S2, value3: S3, value4: S4, value5: S5, value6: S6) => Observable<R>,
  ): Effect<T, R>;

  effect<S1, S2, S3, S4, S5, S6, S7, R>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    s5: Source<T, S5>,
    s6: Source<T, S6>,
    s7: Source<T, S7>,
    effectFn: (value1: S1, value2: S2, value3: S3, value4: S4, value5: S5, value6: S6, value7: S7) => Observable<R>,
  ): Effect<T, R>;

  effect<S1, S2, S3, S4, S5, S6, S7, S8, R>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    s5: Source<T, S5>,
    s6: Source<T, S6>,
    s7: Source<T, S7>,
    s8: Source<T, S8>,
    effectFn: (
      value1: S1,
      value2: S2,
      value3: S3,
      value4: S4,
      value5: S5,
      value6: S6,
      value7: S7,
      value8: S8,
    ) => Observable<R>,
  ): Effect<T, R>;

  effect<S1, S2, S3, S4, S5, S6, S7, S8, S9, R>(
    s1: Source<T, S1>,
    s2: Source<T, S2>,
    s3: Source<T, S3>,
    s4: Source<T, S4>,
    s5: Source<T, S5>,
    s6: Source<T, S6>,
    s7: Source<T, S7>,
    s8: Source<T, S8>,
    s9: Source<T, S9>,
    effectFn: (
      value1: S1,
      value2: S2,
      value3: S3,
      value4: S4,
      value5: S5,
      value6: S6,
      value7: S7,
      value8: S8,
      value9: S9,
    ) => Observable<R>,
  ): Effect<T, R>;

  /**
   * Undo the last change
   */
  undo(): void;

  /**
   * Redo the last undone change
   */
  redo(): void;

  /**
   * Check if the store can undo the last change
   */
  canUndo(): boolean;

  /**
   * Check if the store can redo the last undone change
   */
  canRedo(): boolean;

  /**
   * Stops every source, reducer and effect created through this store and completes its observable
   */
  destroy(): void;
}

/**
 * Delivers every value to all subscribers before the next one, even when a subscriber emits synchronously.
 */
const createOrderedPublisher = <T>(subject: Subject<T>) => {
  const queue: T[] = [];
  let publishing = false;

  return (value: T) => {
    queue.push(value);
    if (publishing) {
      return;
    }

    publishing = true;
    try {
      for (let index = 0; index < queue.length; index++) {
        subject.next(queue[index]);
      }
    } finally {
      queue.length = 0;
      publishing = false;
    }
  };
};

/**
 * Create a store with the given initial state
 * @param initialState
 * @param options
 */
export const createStore = <T>(initialState: BaseState<T>, options?: SignalStateOptions): SignalStore<T> => {
  if (options?.withPatches) {
    enablePatches();
  }
  if (options?.withMapSet) {
    enableMapSet();
  }
  const history = options?.withPatches ? createPatchHistory(options.historyLimit) : undefined;
  const state = createState(initialState);
  const changes = new BehaviorSubject(initialState);
  const changes$ = changes.asObservable();
  const publish = createOrderedPublisher(changes);
  const lifetime = new Subscription();

  const commit = (nextState: BaseState<T>) => {
    if (state.set(nextState)) {
      publish(nextState);
    }
  };

  const reduceState = (fn: (draft: BaseState<T>) => void) => {
    if (!history) {
      commit(produce(state.current(), fn));
      return;
    }

    const [nextState, patches, inversePatches] = produceWithPatches(state.current(), fn);
    if (patches.length === 0) {
      return;
    }
    history.addPatches(patches, inversePatches);
    commit(nextState);
  };

  const applyHistory = (patches: Patch[]) => {
    commit(applyPatches(state.current(), patches));
  };

  const splitSources = (args: unknown[]) => ({
    sources: args.slice(0, -1) as Source<T, unknown>[],
    fn: args.at(-1) as (...values: never[]) => unknown,
  });

  const store: SignalStore<T> = Object.assign(() => state.read(), {
    select: state.select,
    compute: state.compute,
    asObservable: () => changes$,
    source: <S>(startValue?: S): Source<T, S> => createSource(store, startValue, lifetime),
    reduce: (...args: unknown[]): Subscription | undefined => {
      if (args.length === 1) {
        reduceState(args[0] as (draft: BaseState<T>) => void);
        return undefined;
      }

      const {sources, fn} = splitSources(args);
      const subscription = combineLatest(sources.map((source) => source.asObservable())).subscribe((values) => {
        reduceState((draft) => fn(...([draft, ...values] as never[])));
      });
      lifetime.add(subscription);
      return subscription;
    },
    effect: <R>(...args: unknown[]): Effect<T, R> | StoreEffect => {
      if (args.length === 1) {
        return createStoreEffect(store, args[0] as (value: BaseState<T>) => void, lifetime);
      }

      const {sources, fn} = splitSources(args);
      const values$ = combineLatest(sources.map((source) => source.asObservable()));
      return createEffect(store, values$, fn as (...values: unknown[]) => Observable<R>, lifetime);
    },
    undo: () => {
      if (history?.canUndo()) {
        applyHistory(history.undo());
      }
    },
    redo: () => {
      if (history?.canRedo()) {
        applyHistory(history.redo());
      }
    },
    canUndo: () => history?.canUndo() ?? false,
    canRedo: () => history?.canRedo() ?? false,
    destroy: () => {
      lifetime.unsubscribe();
      changes.complete();
    },
  }) as SignalStore<T>;

  return store;
};
