import {from, map, of, Subject, throwError, timer} from 'rxjs';
import {createStore} from './signal.store';

describe('effects', () => {
  describe('Loading Signal', () => {
    it('should be false initially', () => {
      const store = createStore({count: 0});
      const source = store.source();
      const effect = source.effect(() => from(['result']));

      expect(effect.loading()).toBe(false);
    });

    it('should be true while an async effect is running', () => {
      vi.useFakeTimers();
      try {
        const store = createStore({count: 0});
        const source = store.source<string>();
        const effect = source.effect(() => timer(100).pipe(map(() => 'result')));

        source('test');
        expect(effect.loading()).toBe(true);

        vi.advanceTimersByTime(100);
        expect(effect.loading()).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should be false when effect completes', () => {
      const store = createStore({count: 0});
      const source = store.source<string>();
      const effect = source.effect(() => from(['result']));

      source('test');
      effect.reduce((draft) => {
        draft.count = 1;
      });

      expect(effect.loading()).toBe(false);
    });

    it('should be false after the first value of a long-lived observable', () => {
      const store = createStore({count: 0});
      const source = store.source<string>();
      const results = new Subject<number>();
      const effect = source.effect(() => results);
      effect.reduce((draft, result) => {
        draft.count = result;
      });

      source('test');
      expect(effect.loading()).toBe(true);

      results.next(1);
      expect(effect.loading()).toBe(false);
      expect(store().count).toBe(1);
    });

    it('stays true while a run started by its own result is still pending', () => {
      const store = createStore({count: 0});
      const source = store.source<number>();
      const pending = new Subject<number>();
      const effect = source.effect((value) => (value === 1 ? of(1) : pending));
      effect.reduce((draft, result) => {
        draft.count = result;
      });
      store.effect((state) => {
        if (state.count === 1) {
          source(2);
        }
      });

      source(1);

      expect(effect.loading()).toBe(true);
      pending.next(2);
      expect(effect.loading()).toBe(false);
      expect(store().count).toBe(2);
    });
  });

  describe('State Reduction', () => {
    it('should reduce state correctly on successful effect', () => {
      const store = createStore({count: 0, result: ''});
      const source = store.source<string>();
      const effect = source.effect(() => from(['result']));

      effect.reduce((draft, result) => {
        draft.result = result;
      });

      source('test');
      expect(store().result).toBe('result');
    });

    it('replays a result that arrived before the reducer was attached', () => {
      const store = createStore({count: 0});
      const source = store.source(5);
      const effect = source.effect((value) => of(value * 2));

      effect.reduce((draft, value) => {
        draft.count = value;
      });

      expect(store().count).toBe(10);
    });

    it('runs every attached reducer', () => {
      const store = createStore({count: 0, label: ''});
      const source = store.source<number>();
      const effect = source.effect((value) => of(value));
      effect.reduce((draft, value) => {
        draft.count = value;
      });
      effect.reduce((draft, value) => {
        draft.label = `#${value}`;
      });

      source(3);

      expect(store()).toEqual({count: 3, label: '#3'});
    });

    it('passes array values from a source unchanged', () => {
      const store = createStore({ids: [] as number[]});
      const source = store.source<number[]>();
      const effect = source.effect((ids) => of(ids));
      effect.reduce((draft, ids) => {
        draft.ids = ids;
      });

      source([1, 2, 3]);

      expect(store().ids).toEqual([1, 2, 3]);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors correctly', () => {
      const store = createStore({count: 0, result: ''});
      const source = store.source<string>();
      const effect = source.effect(() => throwError(() => new Error('test error')));

      source('test');
      expect(store().error).toEqual(new Error('test error'));
      expect(effect.error()).toEqual(new Error('test error'));
      expect(effect.loading()).toBe(false);
    });

    it('wraps errors that are not Error instances and keeps the original as cause', () => {
      const store = createStore({count: 0});
      const source = store.source<number>();
      const response = {status: 500, message: 'Server error'};
      source.effect(() => throwError(() => response));

      source(1);

      expect(store().error).toBeInstanceOf(Error);
      expect(store().error?.message).toBe('Server error');
      expect(store().error?.cause).toBe(response);
    });

    it('does not clear an error written by another effect', () => {
      const store = createStore({count: 0});
      const failing = store.source<number>();
      const succeeding = store.source<number>();
      const failingEffect = failing.effect(() => throwError(() => new Error('A failed')));
      const succeedingEffect = succeeding.effect((value) => of(value));

      failing(1);
      succeeding(1);

      expect(store().error?.message).toBe('A failed');
      expect(failingEffect.error()?.message).toBe('A failed');
      expect(succeedingEffect.error()).toBeUndefined();
    });
  });

  describe('Multiple Effects', () => {
    it('should handle multiple effects in sequence', () => {
      const store = createStore({count: 0, result: ''});
      const source = store.source<string>();
      const effect = source.effect((value) => from([value + '_result']));

      effect.reduce((draft, result) => {
        draft.result = result;
      });

      source('first');
      expect(store().result).toBe('first_result');

      source('second');
      expect(store().result).toBe('second_result');
    });

    it('should handle a mix of successful and failed effects', () => {
      const store = createStore({count: 0, result: ''});
      const source = store.source<string>();
      const effect = source.effect((value) =>
        value === 'fail' ? throwError(() => new Error('test error')) : from([value + '_result']),
      );

      effect.reduce((draft, result) => {
        draft.result = result;
      });

      source('first');
      expect(store().result).toBe('first_result');

      source('fail');
      expect(store().error).toEqual(new Error('test error'));
      expect(effect.error()).toEqual(new Error('test error'));

      source('second');
      expect(store().result).toBe('second_result');
      expect(store().error).toBeUndefined();
      expect(effect.error()).toBeUndefined();
    });
  });
});
