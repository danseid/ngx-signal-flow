import type {Injector, Signal} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {BehaviorSubject, filter, map, Subject, Subscription} from 'rxjs';
import type {Observable} from 'rxjs';
import type {BaseState} from './signal.core';
import {createEffect} from './signal.effect';
import type {Effect} from './signal.effect';
import type {SignalStore} from './signal.store';

export type ConnectOptions = {
  injector?: Injector;
  skipUndefined?: boolean;
};

/**
 * The value is optional only for sources whose type accepts `undefined`, like `Source<T, void>`.
 */
export type SourceArguments<S> = undefined extends S ? [value?: S] : [value: S];

export type AnySource = {asObservable(): Observable<unknown>};

export type SourceValue<X> = X extends {asObservable(): Observable<infer S>} ? S : never;

export type SourceValues<Sources extends readonly unknown[]> = {[I in keyof Sources]: SourceValue<Sources[I]>};

/**
 * Source represents a source of data. It can be used to emit values and interact with the store.
 */
export interface Source<T, S> {
  /**
   * Emits a value
   * @param value The value to emit
   */
  (...value: SourceArguments<S>): void;
  /**
   * Creates an effect for every emitted value. A new value cancels the previous run.
   * @param effectFn The function that will be executed
   */
  effect<R>(effectFn: (value: S) => Observable<R>): Effect<T, R>;
  /**
   * Reduces the store state with every emitted value
   * @param fn The function that modifies the state
   */
  reduce(fn: (draft: BaseState<T>, value: S) => void): Subscription;
  /**
   * Forwards values from an Angular signal or `input()` into this source.
   * `undefined` is skipped by default so optional inputs can be connected without a manual effect.
   * Values are forwarded asynchronously, the same way `toObservable` delivers them.
   * Must be called in an injection context unless `injector` is provided.
   */
  connect(signal: Signal<S | undefined>, options?: ConnectOptions & {skipUndefined?: true}): Source<T, S>;
  connect(signal: Signal<S>, options: ConnectOptions): Source<T, S>;
  asObservable(): Observable<S>;
  destroy(): void;
}

export const createSource = <T, S>(store: SignalStore<T>, startValue?: S, lifetime?: Subscription): Source<T, S> => {
  const subject = startValue === undefined ? new Subject<S>() : new BehaviorSubject<S>(startValue);
  const subscriptions = new Subscription(() => {
    subject.complete();
  });
  lifetime?.add(subscriptions);

  const emit = (value: S) => {
    subject.next(value);
  };

  const source: Source<T, S> = Object.assign((...[value]: SourceArguments<S>) => emit(value as S), {
    asObservable: () => subject.asObservable(),
    reduce: (fn: (draft: BaseState<T>, value: S) => void) => {
      const subscription = subject.subscribe((value) => {
        store.reduce((draft) => {
          fn(draft, value);
        });
      });
      subscriptions.add(subscription);
      return subscription;
    },
    effect: <R>(effectFn: (value: S) => Observable<R>): Effect<T, R> => {
      const values$ = subject.pipe(map((value): [S] => [value]));
      return createEffect(store, values$, effectFn, subscriptions);
    },
    connect: (inputSignal: Signal<S | undefined>, options?: ConnectOptions): Source<T, S> => {
      const skipUndefined = options?.skipUndefined !== false;
      const values$ = toObservable(inputSignal, options?.injector ? {injector: options.injector} : undefined);
      subscriptions.add(
        values$.pipe(filter((value) => !skipUndefined || value !== undefined)).subscribe((value) => {
          emit(value as S);
        }),
      );
      return source;
    },
    destroy: () => {
      subscriptions.unsubscribe();
    },
  });
  return source;
};
