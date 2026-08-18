import {of, throwError} from 'rxjs';
import {createStore} from './signal.store';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Component} from '@angular/core';
import {Effect} from "./signal.effect";

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
   template: ''
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
    const store = createStore<TestState>({count: 0, total: 0, innerSet: new Set<number>()}, {withMapSet: true});
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
         draft.count = value * 2
         draft.total = value
      });
      await new Promise<void>((resolve, reject) => {
         let round = 0;
         store.asObservable().subscribe(state => {
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
         draft.count = value * 2
         draft.total = value
      });
      await new Promise<void>((resolve, reject) => {
         let round = 0;
         let eff: Effect<TestState, unknown>;
         eff = store.effect(state => {
            try {
               switch (round) {
                  case 0:
                     expect(state.count).toBe(0);
                     expect(state.total).toBe(0);
                     break;
                  case 1:
                     expect(state.count).toBe(2);
                     expect(state.total).toBe(1);
                     expect(eff.loading()).toBe(true);
                     break;
                  case 2:
                     expect(state.count).toBe(4);
                     expect(state.total).toBe(2);
                     expect(eff.loading()).toBe(true);
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
      effect.reduce((draft, value) => draft.count = value);
      expect(store().count).toBe(0);

      source1(2);
      expect(store().count).toBe(2);

      source2(3);
      expect(store().count).toBe(5);
   });

})
