import {computed, Injector, Signal, signal} from '@angular/core';
import {produce} from 'immer';
import {Source} from "./signal.source";

export type BaseState<T> = T & { error?: Error };
type SignalStateOptions = {
  injector?: Injector;
};

export type SignalStore<T>  ={
  // Returns the current state
  (): BaseState<T>;

  source<S>(startValue?: S): Source<T, S>;

  reduce(fn: (draft: BaseState<T>) => void): void;

  select<K extends keyof BaseState<T>>(selector: K): Signal<BaseState<T>[K]>;

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
export const createStore = <T>(initialState: BaseState<T>, options?: SignalStateOptions): SignalStore<T> => {
  const state = signal(initialState);
  const reducer = (fn: (draft: BaseState<T>) => void) => state.update((s) => produce(s, fn));
  const signalStore: SignalStore<T> = () => state();
  signalStore.reduce = reducer;
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
