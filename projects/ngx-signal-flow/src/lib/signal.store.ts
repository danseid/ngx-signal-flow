import {computed, Injector, Signal, signal, WritableSignal} from '@angular/core';
import {produce} from 'immer';
import {Source} from "./signal.source";

export type BaseState<T> = T & { error?: Error };
type SignalStateOptions = {
  injector?: Injector;
};

export interface SignalStore<T> {
  /**
   * Returns the snapshot of the store state
   */
  (): BaseState<T>;


  /**
   * Creates a new source. A source is a way to interact with the store
   * @param startValue The optional start value of the source
   * @returns The source
   * @example
   * const source = store.source(0);
   * source.next(1);
   * source.asObservable().subscribe(console.log); // 1
   * source.reduce((draft, value) => {
   *    draft.count = value;
   * });
   *
   */
  source<S>(startValue?: S): Source<T, S>;

  /**
   * Reduces the store state with the given function. This is the only way to modify the store state
   * @param fn The function that modifies the state
   * @example
   * store.reduce((draft) => {
   *  draft.count += 1;
   *  draft.error = undefined;
   *  });
   */
  reduce(fn: (draft: BaseState<T>) => void): void;

  /**
   * Selects a value from the state.
   * @param selector The key of the value to select
   * @returns A signal that emits the selected value
   * @example
   * const count = store.select('count');
   * count.subscribe(console.log); // 0
   */
  select<K extends keyof BaseState<T>>(selector: K): Signal<BaseState<T>[K]>;
  /**
   * Computes a value from the state
   * @param keys The keys of the values to compute
   * @param fn The function that computes the value
   * @returns A signal that emits the computed value
   * @example
   * const count = store.compute('count', 'error', (count, error) => ({ count, error }));
   * count.subscribe(console.log); // { count: 0, error: undefined }
   *
   */
  compute<K1 extends keyof BaseState<T>, R>(s1: K1, fn: (v1: BaseState<T>[K1]) => R): Signal<R>;
  compute<K1 extends keyof BaseState<T>, K2 extends keyof BaseState<T>, R>(
    s1: K1,
    s2: K2,
    fn: (v1: BaseState<T>[K1], v2: BaseState<T>[K2]) => R
  ): Signal<R>;
  compute<K1 extends keyof BaseState<T>, K2 extends keyof BaseState<T>, K3 extends keyof BaseState<T>, R>(
    s1: K1,
    s2: K2,
    s3: K3,
    fn: (v1: BaseState<T>[K1], v2: BaseState<T>[K2], v3: BaseState<T>[K3]) => R
  ): Signal<R>;
}

const signalReducer = <T>(signal: WritableSignal<T>) => (fn: (draft: T) => void) => signal.update((s) => produce(s, fn))

/**
 * Create a store with the given initial state
 * @param initialState
 * @param options
 */
export const createStore = <T>(initialState: BaseState<T>, options?: SignalStateOptions): SignalStore<T> => {
  const state = signal(initialState);
  const signalStore: SignalStore<T> = () => state();
  signalStore.reduce = signalReducer(state);
  signalStore.source = <S>(startValue?: S): Source<T, S> => new Source<T, S>(signalStore, startValue);
  signalStore.select = <K extends keyof BaseState<T>>(selector: K) => computed(() => state()[selector]);
  signalStore.compute = <R>(...args: any[]): Signal<R> => {
    const keys = args.slice(0, args.length - 1) as (keyof BaseState<T>)[];
    const fn = args[args.length - 1] as (...values: any[]) => R;
    return computed(() => {
      const values = keys.map((key) => state()[key]);
      return fn(...values);
    });
  };
  return signalStore;
};
