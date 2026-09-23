import {signal, untracked} from '@angular/core';
import type {Signal} from '@angular/core';
import {finalize, Subscription} from 'rxjs';
import type {Observable} from 'rxjs';
import type {BaseState} from './signal.core';
import type {SignalStore} from './signal.store';

/**
 * An observable side effect. A new run cancels the previous one.
 */
export interface Effect<S, R> {
  /**
   * True while the latest run has not produced a value, failed or completed
   */
  loading: Signal<boolean>;

  /**
   * The error of the latest failed run, cleared by the next successful result.
   * The error is also written to `state.error`, and only this effect clears it there.
   */
  error: Signal<Error | undefined>;

  /**
   * Adds a reducer for the results of this effect. The first reducer also receives the latest result
   * that arrived before any reducer was attached.
   * @param fn The function that modifies the state
   */
  reduce(fn: (draft: BaseState<S>, value: R) => void): void;

  destroy(): void;
}

/**
 * A function that runs for the current state and after every change
 */
export interface StoreEffect {
  destroy(): void;
}

const toError = (cause: unknown): Error => {
  if (cause instanceof Error) {
    return cause;
  }
  const message =
    typeof cause === 'object' && cause !== null && 'message' in cause && typeof cause.message === 'string'
      ? cause.message
      : String(cause);
  return new Error(message, {cause});
};

export const createStoreEffect = <S>(
  store: SignalStore<S>,
  effectFn: (value: BaseState<S>) => void,
  lifetime?: Subscription,
): StoreEffect => {
  const subscription = store.asObservable().subscribe(effectFn);
  lifetime?.add(subscription);
  return {
    destroy: () => subscription.unsubscribe(),
  };
};

/**
 * Runs `effectFn` for every value tuple and reduces its results into the store.
 */
export const createEffect = <S, V extends unknown[], R>(
  store: SignalStore<S>,
  values$: Observable<V>,
  effectFn: (...values: V) => Observable<R>,
  lifetime?: Subscription,
): Effect<S, R> => {
  const loading = signal(false);
  const error = signal<Error | undefined>(undefined);
  const reducers: ((draft: BaseState<S>, value: R) => void)[] = [];
  let unreducedResult: {value: R} | undefined;
  let currentRun: Subscription | undefined;

  const ownsStoreError = () => {
    const ownError = untracked(error);
    return ownError !== undefined && untracked(store).error === ownError;
  };

  const reduceError = (cause: unknown) => {
    const nextError = toError(cause);
    error.set(nextError);
    store.reduce((draft) => {
      draft.error = nextError;
    });
  };

  const reduceResult = (result: R) => {
    const clearsStoreError = ownsStoreError();
    error.set(undefined);
    if (reducers.length === 0) {
      unreducedResult = {value: result};
    }
    if (reducers.length === 0 && !clearsStoreError) {
      return;
    }

    store.reduce((draft) => {
      reducers.forEach((reducer) => {
        reducer(draft, result);
      });
      if (clearsStoreError) {
        draft.error = undefined;
      }
    });
  };

  const run = (values: V) => {
    currentRun?.unsubscribe();
    const thisRun = new Subscription();
    currentRun = thisRun;
    const settle = () => {
      if (currentRun === thisRun) {
        loading.set(false);
      }
    };

    loading.set(true);
    try {
      thisRun.add(
        effectFn(...values)
          .pipe(finalize(settle))
          .subscribe({
            next: (result) => {
              reduceResult(result);
              settle();
            },
            error: reduceError,
          }),
      );
    } catch (cause) {
      reduceError(cause);
      settle();
    }
  };

  const effectLifetime = new Subscription(() => currentRun?.unsubscribe());
  effectLifetime.add(values$.subscribe(run));
  lifetime?.add(effectLifetime);

  return {
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    reduce: (fn) => {
      reducers.push(fn);
      if (!unreducedResult) {
        return;
      }
      const {value} = unreducedResult;
      unreducedResult = undefined;
      store.reduce((draft) => {
        fn(draft, value);
      });
    },
    destroy: () => effectLifetime.unsubscribe(),
  };
};
