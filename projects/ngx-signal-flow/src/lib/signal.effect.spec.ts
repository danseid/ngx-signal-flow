import {BehaviorSubject, EMPTY, empty, from, Observable, of, Subject, throwError} from 'rxjs';
import {tap} from 'rxjs/operators';
import {Effect} from './signal.effect';
import {Source} from "./signal.source";

describe('Effect', () => {
  let storeMock: any;
  let sourceMock: any;
  let effectFnMock: any;
  let effect: any;

  beforeEach(() => {
    storeMock = {
      reduce: jest.fn()
    };
    sourceMock = {
      asObservable: jest.fn()
    };
    effectFnMock = jest.fn();
  });

  describe('constructor', () => {
    it('should initialize loading signal as false', () => {
      effect = new Effect(storeMock, new Source(storeMock), effectFnMock);
      expect(effect.loading()).toBe(false);
    });
  });

  describe('reduce', () => {
    let sourceSubject: any;
    let reduceFnMock: any;

    beforeEach(() => {
      sourceSubject = new BehaviorSubject('initial value');
      sourceMock.asObservable.mockReturnValue(sourceSubject.asObservable());
      reduceFnMock = jest.fn();
      effect = new Effect(storeMock, sourceMock, effectFnMock);
    });

    it('should set loading to true when effectFn is called', () => {
      effectFnMock.mockReturnValue(from('effect result').pipe(
        tap(() => {
          expect(effect.loading()).toBe(true);
        }),
        tap(() => {
        })
      ));
      effect.reduce(reduceFnMock);
      sourceSubject.next('new value');
      expect(effect.loading()).toBe(false);
    });

    it('should call store.reduce with result on success', () => {
      effectFnMock.mockReturnValue(from(['effect result']).pipe(tap(() => {
      })));
      effect.reduce(reduceFnMock);
      sourceSubject.next('new value');
      expect(storeMock.reduce).toHaveBeenCalledWith(expect.any(Function));
      const reduceCallback = storeMock.reduce.mock.calls[0][0];
      const draft = {};
      reduceCallback(draft);
      expect(reduceFnMock).toHaveBeenCalledWith(draft, 'effect result');
    });

    it('should reset error and set loading to false on success', () => {
      effectFnMock.mockReturnValue(from('effect result').pipe(tap(() => {
      })));
      effect.reduce(reduceFnMock);
      sourceSubject.next('new value');
      const reduceCallback = storeMock.reduce.mock.calls[1][0];
      const draft = {error: 'some error'};
      reduceCallback(draft);
      expect(draft.error).toBeUndefined();
      expect(effect.loading()).toBe(false);
    });

    it('should set error and set loading to false on error', () => {
      const error = new Error('test error');
      effectFnMock.mockReturnValue(throwError(() => error));
      effect.reduce(reduceFnMock);
      sourceSubject.next('new value');
      const reduceCallback = storeMock.reduce.mock.calls[0][0];
      const draft = {error: undefined};
      reduceCallback(draft);
      expect(draft.error).toBe(error);
      expect(effect.loading()).toBe(false);
    });

    it('should process next value after error and set loading correctly', () => {
      const error = new Error('test error');
      const successResult = 'success result';

      effectFnMock.mockReturnValueOnce(throwError(() => error)).mockReturnValueOnce(from([successResult]));
      effect.reduce(reduceFnMock);

      // Emit error
      sourceSubject.next('error value');
      let reduceCallback = storeMock.reduce.mock.calls[0][0];
      let draft = { error: undefined };
      reduceCallback(draft);
      expect(draft.error).toBe(error);
      expect(effect.loading()).toBe(false);

      // Emit success
      sourceSubject.next('success value');
      reduceCallback = storeMock.reduce.mock.calls[2][0];
      draft = { error: undefined };
      reduceCallback(draft);
      expect(draft.error).toBeUndefined();
      expect(effect.loading()).toBe(false);

      // Check if reduceFnMock was called with the success result
      const successDraft = {};
      reduceCallback = storeMock.reduce.mock.calls[1][0];
      reduceCallback(successDraft);
      expect(reduceFnMock).toHaveBeenCalledWith(successDraft, successResult);
      expect(reduceFnMock).toHaveBeenCalledTimes(1);
    });
  });
});
