import {of, Subject, throwError} from 'rxjs';
import {createStore} from './signal.store';
import {withHistory, withMapSet} from './signal.features';
import {createCoreStore} from './signal.core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Component, effect, Injector} from '@angular/core';

interface TestState {
  count: number;
  total: number;
  innerSet?: Set<number>;
}

class TestServiceWithStore {
  private state = createStore<TestState>({count: 0, total: 0});

  public readonly count$ = this.state.source<number>();
  public readonly totalChange = this.state.source<number>();
  public readonly updateCount = this.state.source<boolean>();

  readonly count = this.state.select('count');
  readonly error = this.state.select('error');
  readonly countAndError = this.state.compute('count', 'error', (count, error) => ({count, error}));
  readonly total = this.state.select('total');

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

    this.state.reduce(this.totalChange, this.updateCount, (draft, value, update) => {
      if (update) {
        draft.total = value;
      }
    });
  }
}

@Component({
  template: '',
})
class TestComponent {
  public readonly service = TestBed.inject(TestServiceWithStore);
  count = this.service.count;
  error = this.service.error;
  loading = this.service.countLoading;
  countAndError = this.service.countAndError;
  total = this.service.total;

  public next(value: number) {
    this.service.count$(value);
  }
}

describe('State Store Test', () => {
  let fixture: ComponentFixture<TestComponent>;
  beforeEach(() => {
    fixture = TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [TestServiceWithStore],
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
    expect(component.countAndError()).toEqual({count: 0, error: new Error('error')});
    expect(component.loading()).toBe(false);

    component.next(1);
    expect(component.count()).toBe(2);
    expect(component.error()).toBeUndefined();

    component.next(-1);
    expect(component.error()?.message).toBe('error');
  });

  it('should initialize state and use reduceMany', () => {
    const component = fixture.componentInstance;
    expect(component.total()).toBe(0);

    component.service.totalChange(1);
    expect(component.total()).toBe(0);

    component.service.updateCount(true);
    expect(component.total()).toBe(1);

    component.service.totalChange(2);
    expect(component.total()).toBe(2);

    component.service.updateCount(false);
    component.service.totalChange(3);
    expect(component.total()).toBe(2);
  });

  it('should enable map and set for immerjs', async () => {
    const store = createStore<TestState>({count: 0, total: 0, innerSet: new Set<number>()}, withMapSet());
    const source = store.source<number>(0);
    source.reduce((draft, value) => {
      draft.count = value;
      draft.innerSet?.add(value);
    });
    const state = await new Promise<TestState>((resolve) => {
      store.asObservable().subscribe((nextState) => resolve(nextState));
      source(1);
    });
    expect(state.innerSet).toBeInstanceOf(Set);
    expect(state.innerSet?.size).toBe(1);
  });
});

describe('State Store Effects Test', () => {
  it('should initialize state', () => {
    const state = createStore<TestState>({count: 0, total: 0});
  });

  it('should create observable from source', async () => {
    const store = createStore<TestState>({count: -1, total: -1});
    const source = store.source<number>(0);
    source.reduce((draft, value) => {
      draft.count = value * 2;
      draft.total = value;
    });
    await new Promise<void>((resolve, reject) => {
      let round = 0;
      store.asObservable().subscribe((state) => {
        try {
          switch (round) {
            case 0:
              expect(state.count).toBe(0);
              expect(state.total).toBe(0);
              break;
            case 1:
              expect(state.count).toBe(2);
              expect(state.total).toBe(1);
              break;
            case 2:
              expect(state.count).toBe(4);
              expect(state.total).toBe(2);
              resolve();
              break;
            default:
              reject(new Error('unexpected round'));
              return;
          }
          round++;
        } catch (error) {
          reject(error);
        }
      });
      source(1);
      source(2);
    });
  });

  it('should effect on store', async () => {
    const store = createStore<TestState>({count: -1, total: -1});
    const source = store.source<number>(0);
    source.reduce((draft, value) => {
      draft.count = value * 2;
      draft.total = value;
    });
    await new Promise<void>((resolve, reject) => {
      let round = 0;
      store.effect((state) => {
        try {
          switch (round) {
            case 0:
              expect(state.count).toBe(0);
              expect(state.total).toBe(0);
              break;
            case 1:
              expect(state.count).toBe(2);
              expect(state.total).toBe(1);
              break;
            case 2:
              expect(state.count).toBe(4);
              expect(state.total).toBe(2);
              resolve();
              break;
            default:
              reject(new Error('unexpected round'));
              return;
          }
          round++;
        } catch (error) {
          reject(error);
        }
      });

      source(1);
      source(2);
    });
  });
  it('should effect from multiple sources', () => {
    const store = createStore<TestState>({count: 0, total: 0});
    const source1 = store.source<number>(0);
    const source2 = store.source<number>(0);
    const effect = store.effect(source1, source2, (value1, value2) => of(value1 + value2));
    effect.reduce((draft, value) => (draft.count = value));
    expect(store().count).toBe(0);

    source1(2);
    expect(store().count).toBe(2);

    source2(3);
    expect(store().count).toBe(5);
  });

  it('combines any number of sources and state keys with typed values', () => {
    const store = createStore({a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, total: 0, label: ''});
    const sources = Array.from({length: 10}, (_, index) => store.source(index));
    const [s0, s1, s2, s3, s4, s5, s6, s7, s8] = sources;
    const text = store.source('sum');
    store.reduce(s0, s1, s2, s3, s4, s5, s6, s7, s8, text, (draft, v0, v1, v2, v3, v4, v5, v6, v7, v8, label) => {
      draft.total = v0 + v1 + v2 + v3 + v4 + v5 + v6 + v7 + v8;
      draft.label = label.toUpperCase();
    });
    const sum = store.compute('a', 'b', 'c', 'd', 'e', 'f', (a, b, c, d, e, f) => a + b + c + d + e + f);

    expect(store().total).toBe(36);
    expect(store().label).toBe('SUM');
    expect(sum()).toBe(21);

    // @ts-expect-error unknown state key
    store.compute('missing', (value) => value);
    // @ts-expect-error source values keep their types
    store.reduce(text, (draft, value: number) => (draft.total = value));
  });

  it('delivers changes in order when a store effect reduces synchronously', () => {
    const store = createStore({count: 0});
    store.effect((state) => {
      if (state.count === 1) {
        store.reduce((draft) => {
          draft.count = 2;
        });
      }
    });
    const seen: number[] = [];
    store.asObservable().subscribe((state) => seen.push(state.count));

    store.reduce((draft) => {
      draft.count = 1;
    });

    expect(seen).toEqual([0, 1, 2]);
    expect(store().count).toBe(2);
  });

  it('does not expose a writable subject', () => {
    const store = createStore({count: 0});

    expect(store.asObservable()).not.toBeInstanceOf(Subject);
    expect('next' in store.asObservable()).toBe(false);
  });

  describe('destroy', () => {
    it('stops sources, reducers and effects created through the store', () => {
      const store = createStore({count: 0, doubled: 0});
      const source = store.source<number>();
      source.reduce((draft, value) => {
        draft.count = value;
      });
      store.reduce(source, (draft, value) => {
        draft.doubled = value * 2;
      });
      const running = new Subject<number>();
      const effect = source.effect(() => running);
      source(1);
      expect(effect.loading()).toBe(true);

      store.destroy();
      source(2);
      running.next(3);

      expect(store()).toEqual({count: 1, doubled: 2});
      expect(effect.loading()).toBe(false);
    });

    it('completes the state observable', () => {
      const store = createStore({count: 0});
      let completed = false;
      store.asObservable().subscribe({complete: () => (completed = true)});

      store.destroy();

      expect(completed).toBe(true);
    });

    it('releases sources that were destroyed on their own', () => {
      const store = createStore({count: 0});
      const source = store.source<number>();
      let completed = false;
      source.asObservable().subscribe({complete: () => (completed = true)});

      source.destroy();

      expect(completed).toBe(true);
      expect(() => store.destroy()).not.toThrow();
    });
  });

  describe('reducing inside an Angular effect', () => {
    const runEffect = (reduce: () => void) => {
      let runs = 0;
      effect(
        () => {
          runs++;
          if (runs <= 3) {
            reduce();
          }
        },
        {injector: TestBed.inject(Injector)},
      );
      for (let flush = 0; flush < 3; flush++) {
        TestBed.tick();
      }
      return runs;
    };

    it('does not subscribe the effect to selectors', () => {
      const store = createStore({count: 0});
      store.select('count')();

      const runs = runEffect(() =>
        store.reduce((draft) => {
          draft.count++;
        }),
      );

      expect(runs).toBe(1);
      expect(store().count).toBe(1);
    });

    it('does not subscribe the effect to the core store state', () => {
      const store = createCoreStore({count: 0});
      store.select('count')();

      const runs = runEffect(() =>
        store.reduce((draft) => {
          draft.count++;
        }),
      );

      expect(runs).toBe(1);
      expect(store().count).toBe(1);
    });

    it('does not subscribe the effect to the store on undo', () => {
      const store = createStore({count: 0}, withHistory());
      store.reduce((draft) => {
        draft.count = 1;
      });
      store.reduce((draft) => {
        draft.count = 2;
      });

      const runs = runEffect(() => store.undo());

      expect(runs).toBe(1);
      expect(store().count).toBe(1);
    });

    it('does not subscribe the effect to the store while committing effect results', () => {
      const store = createStore({count: 0});
      const source = store.source<number>();
      const storeEffect = source.effect((value) => (value < 0 ? throwError(() => new Error('previous')) : of(value)));
      source(-1);

      const runs = runEffect(() => source(1));

      expect(runs).toBe(1);
      expect(store().error).toBeUndefined();
      storeEffect.destroy();
      source.destroy();
    });
  });
});
