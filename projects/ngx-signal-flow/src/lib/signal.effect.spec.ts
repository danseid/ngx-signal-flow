import {createEffect} from "./signal.effect";
import {from, map, throwError, timer} from "rxjs";
import {createStore} from "./signal.store";

describe('createEffect', () => {

  describe('Loading Signal', () => {
    it('should be false initially', () => {
      const store = createStore({ count: 0 });
      const source = store.source()
      const effect = createEffect(store, source, (value) => from(['result']));

      expect(effect.loading()).toBe(false);
    });

    it('should be true when effect starts', () => {
      const store = createStore({ count: 0 });
      const source = store.source<string>()
      const effect = createEffect(store, source, (value: string) => timer(100).pipe(map(() => 'result')));

      source('test');
      expect(effect.loading()).toBe(true);
      setTimeout(() => {
        expect(effect.loading()).toBe(false);
      }, 200);
    });

    it('should be false when effect completes', () => {
      const store = createStore({ count: 0 });
      const source = store.source<string>()
      const effect = createEffect(store, source, (value: string) => from(['result']));

      source('test');
      effect.reduce((draft, result) => {
        draft.count = 1;
      });

      expect(effect.loading()).toBe(false);
    });
  });

  describe('State Reduction', () => {
    it('should reduce state correctly on successful effect', () => {
      const store = createStore({ count: 0, result: '' });
      const source = store.source<string>()
      const effect = createEffect(store, source, (value: string) => from(['result']));

      effect.reduce((draft, result) => {
        draft.result = result;
      });

      source('test');
      expect(store().result).toBe('result');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors correctly', () => {
      const store = createStore({ count: 0, result: '' });
      const source = store.source<string>()
      const effect = createEffect(store, source, (value: string) => throwError(new Error('test error')));

      source('test');
      expect(store().error).toEqual(new Error('test error'));
      expect(effect.loading()).toBe(false);
    });
  });

  describe('Multiple Effects', () => {
    it('should handle multiple effects in sequence', () => {
      const store = createStore({ count: 0, result: '' });
      const source = store.source<string>()
      const effect = createEffect(store, source, (value: string) => from([value + '_result']));

      effect.reduce((draft, result) => {
        draft.result = result;
      });

      source('first');
      expect(store().result).toBe('first_result');

      source('second');
      expect(store().result).toBe('second_result');
    });

    it('should handle a mix of successful and failed effects', () => {
      const store = createStore({ count: 0, result: '' });
      const source = store.source<string>()
      const effect = createEffect(store, source, (value: string) =>
        value === 'fail' ? throwError(new Error('test error')) : from([value + '_result'])
      );

      effect.reduce((draft, result) => {
        draft.result = result;
      });

      source('first');
      expect(store().result).toBe('first_result');

      source('fail');
      expect(store().error).toEqual(new Error('test error'));

      source('second');
      expect(store().result).toBe('second_result');
    });
  });

});
