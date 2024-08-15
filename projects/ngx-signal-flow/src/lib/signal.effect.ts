import {Signal, signal} from "@angular/core";
import {Observable, Subscription} from "rxjs";
import {SignalStore} from "./signal.store";
import {Source} from "./signal.source";

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
  let effectSubscription: Subscription;
  const errorReduce = (error?: Error) => {
    store.reduce(draft => {
      draft.error = error;
    });
    loading.set(false);
  }
  const loading = signal(false);
  let reducer: (draft: S, value: R) => void;

  source.subscribe((value: T) => {
    if (effectSubscription) {
      effectSubscription.unsubscribe();
    }
    loading.set(true);

    // Check if value is an array and destructure it if true
    const effectObservable = Array.isArray(value)
      ? effectFn(...value)
      : effectFn(value);

    effectSubscription = effectObservable.subscribe({
      next: (result: R) => {
        if (reducer) {
          store.reduce(draft => {
            reducer(draft, result)
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

