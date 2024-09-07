import {computed, Signal, signal, WritableSignal} from '@angular/core';
import {applyPatches, enablePatches, produce, produceWithPatches} from 'immer';
import {createSource, Source} from "./signal.source";
import {BehaviorSubject, combineLatest, Observable} from "rxjs";
import {createPatchHistory, PatchHistory} from "./signal.history";
import {createEffect, createStoreEffect, Effect} from "./signal.effect";
import {toObservable} from "@angular/core/rxjs-interop";

type SignalStateOptions = {
   withPatches?: boolean; // Enable history with patches
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

   asObservable(): Observable<BaseState<T>>;

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
    * Creates an effect. An effect is a way to interact with the store and execute side effects.
    * @example
    * const countEffect = store.effect(countSource, (value) => {
    *  if (value === -1) {
    *    return throwError(() => new Error('error'));
    *  }
    *  return of(value * 2);
    * });
    * countEffect.loading.subscribe(console.log); // true
    */

   effect<R>(effectFn: (value: BaseState<T>) => void): Effect<T, R>;

   effect<S1, R>(s1: Source<T, S1>, effectFn: (value: S1) => Observable<R>): Effect<T, R>;

   effect<S1, S2, R>(s1: Source<T, S1>, s2: Source<T, S2>, effectFn: (value1: S1, value2: S2) => Observable<R>): Effect<T, R>;

   effect<S1, S2, S3, R>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, effectFn: (value1: S1, value2: S2, value3: S3) => Observable<R>): Effect<T, R>;

   effect<S1, S2, S3, S4, R>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, effectFn: (value1: S1, value2: S2, value3: S3, value4: S4) => Observable<R>): Effect<T, R>;

   effect<S1, S2, S3, S4, S5, R>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, s5: Source<T, S5>, effectFn: (value1: S1, value2: S2, value3: S3, value4: S4, value5: S5) => Observable<R>): Effect<T, R>;

   effect<S1, S2, S3, S4, S5, S6, R>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, s5: Source<T, S5>, s6: Source<T, S6>, effectFn: (value1: S1, value2: S2, value3: S3, value4: S4, value5: S5, value6: S6) => Observable<R>): Effect<T, R>;

   effect<S1, S2, S3, S4, S5, S6, S7, R>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, s5: Source<T, S5>, s6: Source<T, S6>, s7: Source<T, S7>, effectFn: (value1: S1, value2: S2, value3: S3, value4: S4, value5: S5, value6: S6, value7: S7) => Observable<R>): Effect<T, R>;

   effect<S1, S2, S3, S4, S5, S6, S7, S8, R>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, s5: Source<T, S5>, s6: Source<T, S6>, s7: Source<T, S7>, s8: Source<T, S8>, effectFn: (value1: S1, value2: S2, value3: S3, value4: S4, value5: S5, value6: S6, value7: S7, value8: S8) => Observable<R>): Effect<T, R>;

   effect<S1, S2, S3, S4, S5, S6, S7, S8, S9, R>(s1: Source<T, S1>, s2: Source<T, S2>, s3: Source<T, S3>, s4: Source<T, S4>, s5: Source<T, S5>, s6: Source<T, S6>, s7: Source<T, S7>, s8: Source<T, S8>, s9: Source<T, S9>, effectFn: (value1: S1, value2: S2, value3: S3, value4: S4, value5: S5, value6: S6, value7: S7, value8: S8, value9: S9) => Observable<R>): Effect<T, R>;

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

   /**
    * Undo the last change
    */
   undo(): void;

   /**
    * Redo the last change
    */
   redo(): void;

   /**
    * Check if the store can undo the last change
    */
   canUndo(): boolean;

   /**
    * Check if the store can redo the last change
    */
   canRedo(): boolean;
}

const signalReducer = <T>(signal: BehaviorSubject<T>) => (fn: (draft: T) => void) => signal.next(produce(signal.value, fn))
const signalReducerWithPatches = <T>(signal: BehaviorSubject<T>, history: PatchHistory) => (fn: (draft: T) => void) => {
   const currentState = signal.value;
   const [nextState, patches, inversePatches] = produceWithPatches(currentState, fn);
   history.addPatches(patches, inversePatches);
   signal.next(nextState);
}

/**
 * Create a store with the given initial state
 * @param initialState
 * @param options
 */
export const createStore = <T>(initialState: BaseState<T>, options?: SignalStateOptions): SignalStore<T> => {
   let history: PatchHistory | undefined;
   if (options?.withPatches) {
      enablePatches();
      history = createPatchHistory()
   }
   const stateObservable = new BehaviorSubject(initialState);
   const state = signal(initialState);
   stateObservable.subscribe(newState => state.set(newState));
   const signalStore: SignalStore<T> = () => state();
   signalStore.asObservable = () => stateObservable;
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
      const sources: Source<any, any>[] = args.slice(0, args.length - 1);
      const fns = args[args.length - 1];
      if (sources.length === 0) {
         if (options?.withPatches && history) {
            signalReducerWithPatches(stateObservable, history)(fns);
            return;
         }
         signalReducer(stateObservable)(fns);
         return;
      }
      combineLatest(sources.map(s => s.asObservable())).subscribe((value) => {
         signalStore.reduce((draft) => {
            fns(draft, ...value);
         });
      });

   }

   signalStore.effect = <R>(...args: any[]): Effect<T, R> => {
      if(args.length === 1) {
         const effectFn = args[0];
         return createStoreEffect(signalStore, effectFn);
      }
      const sources: Source<any, any>[] = args.slice(0, args.length - 1);
      const observables = sources.map(s => s.asObservable());
      const effectFn = args[args.length - 1];
      const combinedSource = combineLatest(observables);
      return createEffect(signalStore, combinedSource, effectFn);
   }

   signalStore.undo = () => {
      if (history) {
         const patches = history.undo();
         stateObservable.next(applyPatches(state(), patches));
      }
   }

   signalStore.redo = () => {
      if (history) {
         const patches = history.redo();
         stateObservable.next(applyPatches(state(), patches));
      }
   }

   signalStore.canUndo = () => history ? history.canUndo() : false;
   signalStore.canRedo = () => history ? history.canRedo() : false;

   return signalStore;
};
