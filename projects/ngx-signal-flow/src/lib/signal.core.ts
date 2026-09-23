import {computed, signal} from '@angular/core';
import type {Signal, WritableSignal} from '@angular/core';
import {produce} from 'immer';

export type BaseState<T> = T & {error?: Error};

export interface CoreSignalStore<T> {
   (): BaseState<T>;

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

type SelectorEntry = {
   readonly: Signal<any>;
   writable: WritableSignal<any>;
}

export const createSelectorRegistry = <T>(state: Signal<BaseState<T>>) => {
   const entries = new Map<keyof BaseState<T>, SelectorEntry>();

   const entryFor = <K extends keyof BaseState<T>>(key: K): SelectorEntry => {
      const existingEntry = entries.get(key);
      if (existingEntry) {
         return existingEntry;
      }

      const writable = signal(state()[key]);
      const entry = {
         readonly: writable.asReadonly(),
         writable
      };
      entries.set(key, entry);
      return entry;
   };

   const select = <K extends keyof BaseState<T>>(key: K): Signal<BaseState<T>[K]> => entryFor(key).readonly;

   const computeValue = <R>(keys: (keyof BaseState<T>)[], fn: (...values: any[]) => R): Signal<R> => {
      const inputs = keys.map(entryFor);
      return computed(() => fn(...inputs.map(input => input.readonly())));
   };

   const update = (nextState: BaseState<T>) => {
      entries.forEach((entry, key) => {
         const nextValue = nextState[key];
         if (!Object.is(entry.writable(), nextValue)) {
            entry.writable.set(nextValue);
         }
      });
   };

   return {
      compute: computeValue,
      select,
      update
   };
};

export const createCoreStore = <T>(initialState: BaseState<T>): CoreSignalStore<T> => {
   const state = signal(initialState);
   const selectors = createSelectorRegistry(state);
   const store: CoreSignalStore<T> = () => state();

   store.reduce = fn => {
      const currentState = state();
      const nextState = produce(currentState, fn);
      if (Object.is(currentState, nextState)) {
         return;
      }

      state.set(nextState);
      selectors.update(nextState);
   };
   store.select = selectors.select;
   store.compute = <R>(...args: any[]): Signal<R> => {
      const keys = args.slice(0, -1) as (keyof BaseState<T>)[];
      return selectors.compute(keys, args.at(-1));
   };

   return store;
};
