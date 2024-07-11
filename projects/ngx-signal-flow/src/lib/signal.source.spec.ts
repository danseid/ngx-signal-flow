import {from, Observable, throwError} from "rxjs";
import {createStore} from "./signal.store";
import {createSource} from "./signal.source";

describe('createSource', () => {

  describe('Initialization', () => {
    it('should initialize without a start value', () => {
      const store = createStore({count: 0});
      const source = createSource(store);

      expect(source.asObservable()).toBeInstanceOf(Observable);
    });

    it('should initialize with a start value', () => {
      const store = createStore({count: 0});
      const source = createSource(store, 42);

      let emittedValue;
      source.asObservable().subscribe(value => emittedValue = value);
      expect(emittedValue).toBe(42);
    });
  });

  describe('Next Method', () => {
    it('should emit values via next method', () => {
      const store = createStore({count: 0});
      const source = createSource(store);

      let emittedValue;
      source.asObservable().subscribe(value => emittedValue = value);

      source(100);
      expect(emittedValue).toBe(100);
    });

    it('should emit also when no value is passed', () => {
      const store = createStore({count: 0});
      const source = createSource(store);

      let emittedValue;
      source.asObservable().subscribe(value => emittedValue = value);

      source();
      expect(emittedValue).toBe(undefined);
    });
  });

  describe('Reduce Method', () => {
    it('should reduce store state correctly', () => {
      const store = createStore({count: 0});
      const source = createSource(store, 0);

      source.reduce((draft, value) => {
        draft.count += value;
      });

      source(10);
      expect(store().count).toBe(10);

      source(5);
      expect(store().count).toBe(15);
    });
  });

  describe('Effect Method', () => {
    it('should execute effect and update state', () => {
      const store = createStore({count: 0});
      const source = createSource(store, 0);

      const effect = source.effect(value => from([value * 2]));
      effect.reduce((draft, result) => {
        draft.count += result;
      });

      source(5);
      expect(store().count).toBe(10);

      source(3);
      expect(store().count).toBe(16);
    });

    it('should handle effect errors and update state', () => {
      const store = createStore({count: 0});
      const source = createSource(store, 0);

      const effect = source.effect(value => value === 0 ? throwError(new Error('test error')) : from([value * 2]));
      effect.reduce((draft, result) => {
        draft.count += result;
      });

      source(5);
      expect(store().count).toBe(10);

      source(0);
      expect(store().error).toEqual(new Error('test error'));
    });
  });

});
