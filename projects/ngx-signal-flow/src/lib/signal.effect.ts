import {Signal, signal} from "@angular/core";
import {Observable, Subscription} from "rxjs";
import {SignalStore} from "./signal.store";

/**
 * An interface that represents an effect
 */
export interface Effect<S, R> {
   /**
    * A signal that indicates if the effect is currently loading
    */
   loading: Signal<boolean>;

   /**
    * Reduces the store state with the given function
    * @param fn The function that modifies the state
    */
   reduce(fn: (draft: S, value: R) => void): void;
}

export const createStoreEffect = <S, R>(store: SignalStore<S>, effectFn: (value: S) => void): Effect<S, R> => {
   const loading = signal(false);
   store.asObservable().subscribe((s) => {
      loading.set(true);
      effectFn(s);
      loading.set(false);
   });
   return {
      loading: loading.asReadonly(),
      reduce: (fn: (draft: S, value: R) => void) => {
      }
   };
}
/**
 * Creates an effect. An effect is a way to interact with the store and execute side effects.
 *
 * @param store The store to be affected
 * @param source The source of the effect
 * @param effectFn The function that will be executed
 * @returns The effect
 */
export const createEffect = <S, T, R>(
   store: SignalStore<S>,
   source: Observable<T>,
   effectFn: (...value: T[]) => Observable<R>
): Effect<S, R> => {
   let effectSubscription: Subscription | undefined;
   const errorReduce = (error?: Error) => {
      store.reduce(draft => {
         draft.error = error;
      });
      loading.set(false);
   }
   const loading = signal(false);
   let reducer: ((draft: S, value: R) => void) | undefined;

   source.subscribe((value: T) => {
      effectSubscription?.unsubscribe();
      loading.set(true);

      const effectObservable = Array.isArray(value)
         ? effectFn(...value)
         : effectFn(value);

      effectSubscription = effectObservable.subscribe({
         next: (result: R) => {
            if (reducer) {
               const reduceFn = reducer;
               store.reduce(draft => {
                  reduceFn(draft, result)
               });
            }
            errorReduce();
         },
         error: (error: Error) => errorReduce(error)
      });

   });

   return {
      loading: loading.asReadonly(),
      reduce: (fn: (draft: S, value: R) => void) => {
         reducer = fn;
      }
   };
}

