import {Source} from "./signal.source";
import {BehaviorSubject, from, Observable, Subject} from "rxjs";
import {Effect} from "./signal.effect";

describe('Signal Source Test', () => {
  let store: any;
  beforeEach(() => {
    store = {
      reduce: jest.fn(),
    };
  });
  describe('constructor', () => {
    it('should initialize a BehaviorSubject if startValue is provided', () => {
      const startValue = 'test';
      const source = new Source(store, startValue);
      expect(source['source']).toBeInstanceOf(BehaviorSubject);
      expect((source['source'] as BehaviorSubject<string>).value).toBe(startValue);
    });

    it('should initialize a Subject if startValue is not provided', () => {
      const source = new Source(store);
      expect(source['source']).toBeInstanceOf(Subject);
    });
  });


  describe('effect', () => {
    it('should create a new Effect with provided function', () => {
      const source = new Source(store);
      const effectFn = jest.fn(() => from('effect result'));
      const effect = source.effect(effectFn);

      expect(effect).toBeInstanceOf(Effect);
      expect(effect['effectFn']).toBe(effectFn);
      expect(effect['source']).toBe(source);
      expect(effect['store']).toBe(store);
    });
  });

  describe('reduce', () => {
    it('should call store.reduce with the provided function', () => {
      const source = new Source(store);
      const reduceFn = jest.fn();
      const value = 'value';

      source.reduce(reduceFn);
      source.next(value);

      expect(store.reduce).toHaveBeenCalledWith(expect.any(Function));
      const reduceCallback = store.reduce.mock.calls[0][0];
      const draft = 'draft';
      reduceCallback(draft);

      expect(reduceFn).toHaveBeenCalledWith(draft, value);
    });
  });

  describe('asObservable', () => {
    it('should return the source as an observable', () => {
      const source = new Source(store);
      const observable = source.asObservable();

      expect(observable).toBeInstanceOf(Observable);
    });
  });

  describe('next', () => {
    it('should push a new value into the source', () => {
      const startValue = 'initial';
      const source = new Source(store, startValue);
      const newValue = 'newValue';

      const spy = jest.spyOn(source['source'], 'next');
      source.next(newValue);

      expect(spy).toHaveBeenCalledWith(newValue);
    });
  });
});
