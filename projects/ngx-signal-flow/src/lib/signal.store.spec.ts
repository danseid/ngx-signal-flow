import { of, throwError } from 'rxjs';
import { createStore } from './signal.store';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, computed } from '@angular/core';

interface TestState {
  count: number;
}

class TestServiceWithStore {
  private state = createStore<TestState>({ count: 0 });

  public readonly count$ = this.state.source<number>();

  readonly count = this.state.select('count');
  readonly error = this.state.select('error');
  readonly countAndError = this.state.compute('count', 'error', (count, error) => ({ count, error }));

  readonly countEffect = this.count$.effect<number>((value) => {
    if (value === -1) {
      return throwError(() => new Error('error'));
    }
    return of(value * 2);
  });
  readonly countLoading = this.countEffect.loading;
  constructor() {
    this.countEffect.reduce((draft, value) => {
      expect(this.countLoading()).toBe(true);
      draft.count = value;
    });
  }
}

@Component({
  template: ''
})
class TestComponent {
  readonly service = TestBed.inject(TestServiceWithStore);
  count = this.service.count;
  error = this.service.error;
  loading = this.service.countLoading;
  countAndError = this.service.countAndError;
  public next(value: number) {
    this.service.count$(value);
  }
}

describe('State Store Test', () => {
  let fixture: ComponentFixture<TestComponent>;
  beforeEach(() => {
    fixture = TestBed.configureTestingModule({
      declarations: [TestComponent],
      providers: [TestServiceWithStore]
    }).createComponent(TestComponent);
  });

  it('should initialize state', () => {
    const component = fixture.componentInstance;
    expect(component.count()).toBe(0);

    component.next(1);
    expect(component.count()).toBe(2);
    expect(component.loading()).toBe(false);
  });

  it('should catch error', () => {
    const component = fixture.componentInstance;
    component.next(0);
    expect(component.count()).toBe(0);

    component.next(-1);
    fixture.detectChanges();
    expect(component.error()?.message).toBe('error');
    expect(component.countAndError()).toEqual({ count: 0, error: new Error('error') });
    expect(component.loading()).toBe(false);

    component.next(1);
    expect(component.count()).toBe(2);
    expect(component.error()).toBeUndefined();

    component.next(-1);
    expect(component.error()?.message).toBe('error');
  });
});
