import {computed, Injector, Signal, signal, WritableSignal} from '@angular/core';
import {produce} from 'immer';
import {createSource, Source} from "./signal.source";
import {combineAll, combineLatest, merge} from "rxjs";

type SignalStateOptions = {
   injector?: Injector;
};

export type BaseState<T> = T & { error?: Error };

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
    * draft.count = value;
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
    * Reduces the store state with the given function.
    * @example
    * store.reduce(countSource, errorSource, (draft, count, error) => {
    *    draft.count = count;
    *    draft.error = error;
    * });
    */
   reduce<S1>(s1: Source<T, S1>, fn: ((draft: BaseState<T>, s1: S1) => void)): void;

   reduce<S1, S2>(s1: Source<T, S1>, s2: Source<T, S2>, fn: ((draft: BaseState<T>, s1: S1, s2: S2) => void)): void;

   reduce<S1, S2, S3>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, fn: ((draft: BaseState<T>, s1: S1, s2: S2, s3: S3) => void)): void;

   reduce<S1, S2, S3, S4>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, fn: ((draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4) => void)): void;

   reduce<S1, S2, S3, S4, S5>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, s5: Source<T, S5>, fn: ((draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5) => void)): void;

   reduce<S1, S2, S3, S4, S5, S6>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, s5: Source<T, S5>, s6: Source<T, S6>, fn: ((draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5, s6: S6) => void)): void;

   reduce<S1, S2, S3, S4, S5, S6, S7>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, s5: Source<T, S5>, s6: Source<T, S6>, s7: Source<T, S7>, fn: ((draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5, s6: S6, s7: S7) => void)): void;

   reduce<S1, S2, S3, S4, S5, S6, S7, S8>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, s5: Source<T, S5>, s6: Source<T, S6>, s7: Source<T, S7>, s8: Source<T, S8>, fn: ((draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5, s6: S6, s7: S7, s8: S8) => void)): void;

   reduce<S1, S2, S3, S4, S5, S6, S7, S8, S9>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, s5: Source<T, S5>, s6: Source<T, S6>, s7: Source<T, S7>, s8: Source<T, S8>, s9: Source<T, S9>, fn: ((draft: BaseState<T>, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5, s6: S6, s7: S7, s8: S8, s9: S9) => void)): void;

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

   compute<K1 extends keyof BaseState<T>, K2 extends keyof BaseState<T>, K3 extends keyof BaseState<T>, K4 extends keyof BaseState<T>, R>(
      s1: K1,
      s2: K2,
      s3: K3,
      s4: K4,
      fn: (v1: BaseState<T>[K1], v2: BaseState<T>[K2], v3: BaseState<T>[K3], v4: BaseState<T>[K4]) => R
   ): Signal<R>;

   compute<K1 extends keyof BaseState<T>, K2 extends keyof BaseState<T>, K3 extends keyof BaseState<T>, K4 extends keyof BaseState<T>, K5 extends keyof BaseState<T>, R>(
      s1: K1,
      s2: K2,
      s3: K3,
      s4: K4,
      s5: K5,
      fn: (v1: BaseState<T>[K1], v2: BaseState<T>[K2], v3: BaseState<T>[K3], v4: BaseState<T>[K4], v5: BaseState<T>[K5]) => R
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
   // signalStore.reduce = signalReducer(state);
   signalStore.source = <S>(startValue?: S): Source<T, S> => createSource(signalStore, startValue);
   signalStore.select = <K extends keyof BaseState<T>>(selector: K) => computed(() => state()[selector]);
   signalStore.compute = <R>(...args: any[]): Signal<R> => {
      const keys = args.slice(0, args.length - 1) as (keyof BaseState<T>)[];
      const fn = args[args.length - 1] as (...values: any[]) => R;
      return computed(() => {
         const values = keys.map((key) => state()[key]);
         return fn(...values);
      });
   };
   signalStore.reduce = (...args: any[]): void => {
      // Extract the sources and the functions array
      const sources = args.slice(0, args.length - 1);
      const fns = args[args.length - 1];
      if (sources.length === 0) {
         signalReducer(state)(fns);
         return;
      }
      combineLatest(sources.map(s => s.asObservable())).subscribe((value) => {
         signalStore.reduce((draft) => {
            fns(draft, ...value);
         });
      });

   }
   return signalStore;
};
