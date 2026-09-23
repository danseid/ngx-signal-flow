import {Component, input, signal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
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

      const effect = source.effect((value) => (value === 0 ? throwError(new Error('test error')) : from([value * 2])));
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
      store = createStore({count: 0 as number | undefined});
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
      TestBed.flushEffects();
      expect(fixture.componentInstance.store().count).toBe(0);

      fixture.componentInstance.value.set(5);
      TestBed.flushEffects();
      expect(fixture.componentInstance.store().count).toBe(5);

      fixture.componentInstance.value.set(undefined);
      TestBed.flushEffects();
      expect(fixture.componentInstance.store().count).toBe(5);
    });

    it('should connect an input signal to a source', () => {
      const inputFixture = TestBed.createComponent(InputHostComponent);
      TestBed.flushEffects();
      expect(inputFixture.componentInstance.store().count).toBe(0);

      inputFixture.componentRef.setInput('value', 5);
      TestBed.flushEffects();
      expect(inputFixture.componentInstance.store().count).toBe(5);
    });

    it('should emit undefined when skipUndefined is false', () => {
      const undefinedFixture = TestBed.createComponent(EmitUndefinedComponent);
      TestBed.flushEffects();
      expect(undefinedFixture.componentInstance.store().count).toBeUndefined();

      undefinedFixture.componentInstance.value.set(3);
      TestBed.flushEffects();
      expect(undefinedFixture.componentInstance.store().count).toBe(3);
    });
  });
});
