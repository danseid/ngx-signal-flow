import {Component, input, signal} from '@angular/core';
import type {ComponentFixture} from '@angular/core/testing';
import {TestBed} from '@angular/core/testing';
import {from, Observable, throwError} from 'rxjs';
import {createStore} from './signal.store';
import {createSource} from './signal.source';

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
      source.asObservable().subscribe((value) => (emittedValue = value));
      expect(emittedValue).toBe(42);
    });

    it('should keep null as a start value', () => {
      const store = createStore({count: 0});
      const source = store.source<number | null>(null);

      let emittedValue: number | null | 'nothing' = 'nothing';
      source.asObservable().subscribe((value) => (emittedValue = value));
      expect(emittedValue).toBeNull();
    });
  });

  describe('Call Signature', () => {
    it('requires a value unless the source type accepts undefined', () => {
      const store = createStore({count: 0});
      const count = store.source<number>();
      const trigger = store.source<void>();
      const optional = store.source<number | undefined>();

      // @ts-expect-error a number source needs a value
      count();
      trigger();
      optional();
      count(1);

      expect(store().count).toBe(0);
    });
  });

  describe('Next Method', () => {
    it('should emit values via next method', () => {
      const store = createStore({count: 0});
      const source = createSource(store);

      let emittedValue;
      source.asObservable().subscribe((value) => (emittedValue = value));

      source(100);
      expect(emittedValue).toBe(100);
    });

    it('should emit also when no value is passed', () => {
      const store = createStore({count: 0});
      const source = createSource(store);

      let emittedValue;
      source.asObservable().subscribe((value) => (emittedValue = value));

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

      const effect = source.effect((value) => from([value * 2]));
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

      const effect = source.effect((value) =>
        value === 0 ? throwError(() => new Error('test error')) : from([value * 2]),
      );
      effect.reduce((draft, result) => {
        draft.count += result;
      });

      source(5);
      expect(store().count).toBe(10);

      source(0);
      expect(store().error).toEqual(new Error('test error'));
    });
  });

  describe('Connect', () => {
    @Component({
      template: '',
    })
    class ConnectHostComponent {
      value = signal<number | undefined>(undefined);
      store = createStore({count: 0});
      countSource = this.store.source<number>();

      constructor() {
        this.countSource.reduce((draft, value) => {
          draft.count = value;
        });
        this.countSource.connect(this.value);
      }
    }

    @Component({
      template: '',
    })
    class InputHostComponent {
      value = input<number | undefined>(undefined);
      store = createStore({count: 0});
      setCount = this.store.source<number>();

      constructor() {
        this.setCount.reduce((draft, value) => {
          draft.count = value;
        });
        this.setCount.connect(this.value);
      }
    }

    @Component({
      template: '',
    })
    class EmitUndefinedComponent {
      value = signal<number | undefined>(undefined);
      store = createStore<{count: number | undefined}>({count: 0});
      countSource = this.store.source<number | undefined>();

      constructor() {
        this.countSource.reduce((draft, value) => {
          draft.count = value;
        });
        this.countSource.connect(this.value, {skipUndefined: false});
      }
    }

    let fixture: ComponentFixture<ConnectHostComponent>;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [ConnectHostComponent, InputHostComponent, EmitUndefinedComponent],
      });
      fixture = TestBed.createComponent(ConnectHostComponent);
    });

    it('should skip undefined and apply later signal values', () => {
      TestBed.tick();
      expect(fixture.componentInstance.store().count).toBe(0);

      fixture.componentInstance.value.set(5);
      TestBed.tick();
      expect(fixture.componentInstance.store().count).toBe(5);

      fixture.componentInstance.value.set(undefined);
      TestBed.tick();
      expect(fixture.componentInstance.store().count).toBe(5);
    });

    it('should connect an input signal to a source', () => {
      const inputFixture = TestBed.createComponent(InputHostComponent);
      TestBed.tick();
      expect(inputFixture.componentInstance.store().count).toBe(0);

      inputFixture.componentRef.setInput('value', 5);
      TestBed.tick();
      expect(inputFixture.componentInstance.store().count).toBe(5);
    });

    it('should emit undefined when skipUndefined is false', () => {
      const undefinedFixture = TestBed.createComponent(EmitUndefinedComponent);
      TestBed.tick();
      expect(undefinedFixture.componentInstance.store().count).toBeUndefined();

      undefinedFixture.componentInstance.value.set(3);
      TestBed.tick();
      expect(undefinedFixture.componentInstance.store().count).toBe(3);
    });
  });
});
