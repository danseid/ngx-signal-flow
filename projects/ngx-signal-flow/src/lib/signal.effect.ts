import {signal} from "@angular/core";
import type {Signal} from "@angular/core";
import {finalize} from "rxjs";
import type {Observable, Subscription} from "rxjs";
import type {SignalStore} from "./signal.store";

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

   destroy(): void;
}

export const createStoreEffect = <S, R>(store: SignalStore<S>, effectFn: (value: S) => void): Effect<S, R> => {
   const loading = signal(false);
   const subscription = store.asObservable().subscribe((state) => {
      loading.set(true);
      try {
         effectFn(state);
      } finally {
         loading.set(false);
      }
   });
   return {
      loading: loading.asReadonly(),
      reduce: () => undefined,
      destroy: () => subscription.unsubscribe()
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
   const loading = signal(false);
   let reducer: ((draft: S, value: R) => void) | undefined;

   const reduceError = (error: Error) => {
      store.reduce(draft => {
         draft.error = error;
      });
   };

   const sourceSubscription = source.subscribe((value: T) => {
      effectSubscription?.unsubscribe();
      loading.set(true);

      let effectObservable: Observable<R>;
      try {
         effectObservable = Array.isArray(value)
            ? effectFn(...value)
            : effectFn(value);
      } catch (error) {
         reduceError(error instanceof Error ? error : new Error(String(error)));
         loading.set(false);
         return;
      }

      effectSubscription = effectObservable.pipe(
         finalize(() => loading.set(false))
      ).subscribe({
         next: (result: R) => {
            if (!reducer && store().error === undefined) {
               return;
            }

            store.reduce(draft => {
               reducer?.(draft, result);
               draft.error = undefined;
            });
         },
         error: reduceError
      });

   });

   return {
      loading: loading.asReadonly(),
      reduce: (fn: (draft: S, value: R) => void) => {
         reducer = fn;
      },
      destroy: () => {
         sourceSubscription.unsubscribe();
         effectSubscription?.unsubscribe();
         loading.set(false);
      }
   };
}

