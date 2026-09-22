import {Injector, Signal} from "@angular/core";
import {toObservable} from "@angular/core/rxjs-interop";
import {BehaviorSubject, filter, Observable, Subject} from "rxjs";
import {createEffect, Effect } from "./signal.effect";
import {SignalStore} from "./signal.store";

export type ConnectOptions = {
    injector?: Injector;
    skipUndefined?: boolean;
};

/**
 * Source represents a source of data. It can be used to emit values and interact with the store.
 */
export interface Source<T, S> {
    /**
     * Emits a value
     * @param value The value to emit
     */
    (value?: S): void;
    /**
     * Creates an effect. An effect is a way to interact with the store and execute side effects.
     * @param effectFn The function that will be executed
     */
    effect<R>(effectFn: (value: S) => Observable<R>): Effect<T, R>;
    /**
     * Reduces the store state with the given function
     * @param fn The function that modifies the state
     */
    reduce(fn: (draft: T, value: S) => void): void;
    /**
     * Forwards values from an Angular signal or `input()` into this source.
     * `undefined` is skipped by default so optional inputs can be connected without a manual effect.
     * Must be called in an injection context unless `injector` is provided.
     */
    connect(signal: Signal<S | undefined>, options?: ConnectOptions): Source<T, S>;
    asObservable(): Observable<S>;
}

export const createSource = <T, S>(store: SignalStore<T>, startValue?: S): Source<T, S> => {
  const subject: Subject<S> = (startValue !== undefined && startValue !== null) ? new BehaviorSubject<S>(startValue) : new Subject<S>();
  const source = ((value?: S) => subject.next(value as S)) as Source<T, S>;
  source.asObservable = () => subject.asObservable();
  source.reduce = (fn: (draft: T, value: S) => void) => {
    subject.subscribe((value: S) => {
      store.reduce((draft: T) => {
        fn(draft, value)
      });
    });
  };
  source.effect = <R>(effectFn: (value: S) => Observable<R>): Effect<T, R> => createEffect(store, source.asObservable(), effectFn);
  source.connect = (inputSignal: Signal<S | undefined>, options?: ConnectOptions) => {
    const skipUndefined = options?.skipUndefined !== false;
    const values$ = toObservable(inputSignal, options?.injector ? {injector: options.injector} : undefined);
    values$.pipe(
      filter((value): value is S => !skipUndefined || value !== undefined)
    ).subscribe((value) => source(value));
    return source;
  };
  return source;
}

