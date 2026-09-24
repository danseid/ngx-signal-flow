import {signal} from '@angular/core';
import type {Signal} from '@angular/core';
import {applyPatches, produce, produceWithPatches} from 'immer';
import type {Patch} from 'immer';
import {BehaviorSubject, combineLatest, Subscription} from 'rxjs';
import type {Observable, Subject} from 'rxjs';
import {createState} from './signal.core';
import type {BaseState, CoreSignalStore, NonEmpty} from './signal.core';
import {createEffect, createStoreEffect} from './signal.effect';
import type {Effect, StoreEffect} from './signal.effect';
import {findHistoryFeature} from './signal.features';
import type {StoreFeature} from './signal.features';
import {createPatchHistory} from './signal.history';
import type {PatchHistory} from './signal.history';
import {createSource} from './signal.source';
import type {AnySource, ConnectOptions, Source, SourceArguments, SourceValue, SourceValues} from './signal.source';

export type {BaseState, NonEmpty, StateKey, StateValues} from './signal.core';
export type {AnySource, ConnectOptions, Effect, Source, SourceArguments, SourceValue, SourceValues, StoreEffect};

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
  reduce<const Sources extends NonEmpty<AnySource>>(
    ...args: [...sources: Sources, fn: (draft: BaseState<T>, ...values: SourceValues<Sources>) => void]
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
  effect<const Sources extends NonEmpty<AnySource>, R>(
    ...args: [...sources: Sources, effectFn: (...values: SourceValues<Sources>) => Observable<R>]
  ): Effect<T, R>;

  /**
   * Undo the last change. Needs the `withHistory()` feature.
   */
  undo(): void;

  /**
   * Redo the last undone change. Needs the `withHistory()` feature.
   */
  redo(): void;

  /**
   * True when there is a change to undo. Always false without the `withHistory()` feature.
   */
  canUndo: Signal<boolean>;

  /**
   * True when there is an undone change to redo. Always false without the `withHistory()` feature.
   */
  canRedo: Signal<boolean>;

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
 * @param features Optional features like `withHistory()` and `withMapSet()`
 * @example
 * const store = createStore({count: 0}, withHistory({limit: 50}));
 */
export const createStore = <T>(initialState: BaseState<T>, ...features: StoreFeature[]): SignalStore<T> => {
  const historyFeature = findHistoryFeature(features);
  const history = historyFeature ? createPatchHistory(historyFeature.limit) : undefined;
  const canUndo = signal(false);
  const canRedo = signal(false);
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

  const syncHistory = (patchHistory: PatchHistory) => {
    canUndo.set(patchHistory.canUndo());
    canRedo.set(patchHistory.canRedo());
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
    syncHistory(history);
    commit(nextState);
  };

  const applyHistory = (patchHistory: PatchHistory, patches: Patch[]) => {
    syncHistory(patchHistory);
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
        reduceState((draft) => {
          fn(...([draft, ...values] as never[]));
        });
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
        applyHistory(history, history.undo());
      }
    },
    redo: () => {
      if (history?.canRedo()) {
        applyHistory(history, history.redo());
      }
    },
    canUndo: canUndo.asReadonly(),
    canRedo: canRedo.asReadonly(),
    destroy: () => {
      lifetime.unsubscribe();
      changes.complete();
    },
  }) as SignalStore<T>;

  return store;
};
