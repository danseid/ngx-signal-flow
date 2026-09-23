import {EMPTY, of} from 'rxjs';
import {createStore} from './signal.store';
import {createCoreStore} from './signal.core';

describe('performance regressions', () => {
   it('does not emit unchanged state', () => {
      const store = createStore({count: 0});
      let emissions = 0;
      const subscription = store.asObservable().subscribe(() => emissions++);

      store.reduce(() => undefined);

      expect(emissions).toBe(1);
      subscription.unsubscribe();
   });

   it('commits an effect result once', () => {
      const store = createStore({count: 0});
      const source = store.source<number>();
      const effect = source.effect(value => of(value));
      let emissions = 0;
      const subscription = store.asObservable().subscribe(() => emissions++);
      effect.reduce((draft, value) => {
         draft.count = value;
      });

      source(1);

      expect(emissions).toBe(2);
      subscription.unsubscribe();
      effect.destroy();
      source.destroy();
   });

   it('finishes loading when an effect completes without a value', () => {
      const store = createStore({count: 0});
      const source = store.source<void>();
      const effect = source.effect(() => EMPTY);

      source();

      expect(effect.loading()).toBe(false);
      effect.destroy();
      source.destroy();
   });

   it('finishes loading when an effect factory throws', () => {
      const store = createStore({count: 0});
      const source = store.source<void>();
      const effect = source.effect(() => {
         throw new Error('failed');
      });

      source();

      expect(effect.loading()).toBe(false);
      expect(store().error).toEqual(new Error('failed'));
      effect.destroy();
      source.destroy();
   });

   it('can stop source reducers', () => {
      const store = createStore({count: 0});
      const source = store.source<number>();
      const subscription = source.reduce((draft, value) => {
         draft.count += value;
      });

      source(1);
      subscription.unsubscribe();
      source(1);

      expect(store().count).toBe(1);
      source.destroy();
   });

   it('can stop combined reducers', () => {
      const store = createStore({count: 0});
      const source = store.source<number>();
      const subscription = store.reduce(source, (draft, value) => {
         draft.count += value;
      });

      source(1);
      subscription.unsubscribe();
      source(1);

      expect(store().count).toBe(1);
      source.destroy();
   });

   it('does not create history for unchanged state', () => {
      const store = createStore({count: 0}, {withPatches: true});

      store.reduce(() => undefined);

      expect(store.canUndo()).toBe(false);
   });

   it('does not create history for effect results that change nothing', () => {
      const store = createStore({count: 0}, {withPatches: true});
      const source = store.source<number>();
      const effect = source.effect(value => of(value));
      effect.reduce((draft, value) => {
         draft.count = value;
      });

      source(0);

      expect(store.canUndo()).toBe(false);
      expect('error' in store()).toBe(false);
      effect.destroy();
      source.destroy();
   });

   it('does not recompute selectors after unrelated changes', () => {
      const store = createStore({selected: 0, unrelated: 0});
      let runs = 0;
      const selected = store.compute('selected', value => {
         runs++;
         return value * 2;
      });
      selected();

      store.reduce(draft => {
         draft.unrelated++;
      });
      selected();

      expect(runs).toBe(1);
   });

   it('keeps the core store selector path fine-grained', () => {
      const store = createCoreStore({selected: 0, unrelated: 0});
      let runs = 0;
      const selected = store.compute('selected', value => {
         runs++;
         return value * 2;
      });
      selected();

      store.reduce(draft => {
         draft.unrelated++;
      });
      selected();

      expect(runs).toBe(1);
   });
});
