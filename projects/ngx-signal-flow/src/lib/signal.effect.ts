import {Signal, signal} from "@angular/core";
import {Observable} from "rxjs";
import {SignalStore} from "./signal.store";
import {Source} from "./signal.source";

/**
 * An interface that represents an effect
 */
interface EffectI<S,R> {
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
 * Creates an effect
 * @param store The store to be affected
 * @param source The source of the effect
 * @param effectFn The function that will be executed
 * @returns The effect
 */
export const createEffect = <S, T, R>(
  store: SignalStore<S>,
  source: Source<S, T>,
  effectFn: (value: T) => Observable<R>
): EffectI<S, R> => {
  // Reduces the store state with the given error and sets loading to false
  const errorReduce = (error?: Error) => {
    store.reduce(draft => {
      draft.error = error;
    });
    loading.set(false);
  }
  const loading = signal(false);
  let reducer: (draft: S, value: R) => void;

  source.asObservable().subscribe((value: T) => {
    loading.set(true);
    effectFn(value).subscribe({
      next: (result: R) => {
        if(reducer) {
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
  }
}

export class Effect<S, T, R> {
  private _loading = signal(false);
  private reducer?: (draft: S, value: R) => void;
  loading = this._loading.asReadonly();

  constructor(
    private store: SignalStore<S>,
    private source: Source<S, T>,
    private effectFn: (value: T) => Observable<R>
  ) {
    this.source.asObservable().subscribe((value: T) => {
      this._loading.set(true);
       this.effectFn(value).subscribe({
        next: (result: R) => {
          if(this.reducer) {
            this.store.reduce(draft => {
              this.reducer?.(draft, result)
            });
          }
          this.errorReduce();
        },
        error: (error: Error) => this.errorReduce(error)
      });
    });
  }

  private errorReduce = (error?: Error) => {
    this.store.reduce(draft => {
      draft.error = error;
    });
    this._loading.set(false);
  }

  reduce(fn: (draft: S, value: R) => void): void {
    this.reducer = fn;
  }
}
