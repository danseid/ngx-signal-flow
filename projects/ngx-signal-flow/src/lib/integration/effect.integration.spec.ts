import {ChangeDetectionStrategy, Component, DestroyRef, inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {Subject} from 'rxjs';
import type {Observable} from 'rxjs';
import {createStore} from '../signal.store';
import {
  click,
  configureIntegrationTestBed,
  expectRequest,
  httpTesting,
  renderComponent,
  textOf,
  textsOf,
  typeInto,
} from './integration.helpers';

describe('source effect integration', () => {
  beforeEach(() => configureIntegrationTestBed());

  describe('HTTP request per source value', () => {
    type Todo = {id: number; title: string};

    @Injectable()
    class TodoStore {
      private readonly http = inject(HttpClient);
      private readonly store = createStore<{todos: Todo[]; query: string}>({todos: [], query: ''});
      readonly search = this.store.source<string>();
      private readonly searchEffect = this.search.effect((query) =>
        this.http.get<Todo[]>('/api/todos', {params: {q: query}}),
      );
      readonly todos = this.store.select('todos');
      readonly query = this.store.select('query');
      readonly error = this.store.select('error');
      readonly loading = this.searchEffect.loading;

      constructor() {
        this.search.reduce((draft, query) => {
          draft.query = query;
        });
        this.searchEffect.reduce((draft, todos) => {
          draft.todos = todos;
        });
        inject(DestroyRef).onDestroy(() => this.search.destroy());
      }
    }

    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      providers: [TodoStore],
      template: `
        <input class="query" (input)="store.search($any($event.target).value)" />
        <p class="summary">{{ store.query() }}</p>
        @if (store.loading()) {
          <p class="loading">Loading</p>
        }
        @if (store.error(); as error) {
          <p class="error">{{ error.message }}</p>
        }
        <ul>
          @for (todo of store.todos(); track todo.id) {
            <li>{{ todo.title }}</li>
          }
        </ul>
      `,
    })
    class TodoListComponent {
      protected readonly store = inject(TodoStore);
    }

    afterEach(() => httpTesting().verify());

    it('shows loading while the request is pending and renders the response', async () => {
      const fixture = await renderComponent(TodoListComponent);
      typeInto(fixture, '.query', 'milk');
      await fixture.whenStable();

      expect(textOf(fixture, '.summary')).toBe('milk');
      expect(textOf(fixture, '.loading')).toBe('Loading');

      expectRequest('/api/todos', {q: 'milk'}).flush([{id: 1, title: 'Buy milk'}]);
      await fixture.whenStable();

      expect(textOf(fixture, '.loading')).toBeUndefined();
      expect(textsOf(fixture, 'li')).toEqual(['Buy milk']);
    });

    it('cancels the pending request when a newer value arrives', async () => {
      const fixture = await renderComponent(TodoListComponent);
      typeInto(fixture, '.query', 'm');
      const outdatedRequest = expectRequest('/api/todos', {q: 'm'});
      typeInto(fixture, '.query', 'milk');

      expect(outdatedRequest.cancelled).toBe(true);

      expectRequest('/api/todos', {q: 'milk'}).flush([{id: 1, title: 'Buy milk'}]);
      await fixture.whenStable();

      expect(textsOf(fixture, 'li')).toEqual(['Buy milk']);
    });

    it('renders request errors and clears them after the next successful response', async () => {
      const fixture = await renderComponent(TodoListComponent);
      typeInto(fixture, '.query', 'broken');
      expectRequest('/api/todos', {q: 'broken'}).flush('failed', {status: 500, statusText: 'Server Error'});
      await fixture.whenStable();

      expect(textOf(fixture, '.error')).toContain('500 Server Error');
      expect(textOf(fixture, '.loading')).toBeUndefined();

      typeInto(fixture, '.query', 'milk');
      expectRequest('/api/todos', {q: 'milk'}).flush([{id: 1, title: 'Buy milk'}]);
      await fixture.whenStable();

      expect(textOf(fixture, '.error')).toBeUndefined();
      expect(textsOf(fixture, 'li')).toEqual(['Buy milk']);
    });

    it('cancels the pending request when the owning component is destroyed', async () => {
      const fixture = await renderComponent(TodoListComponent);
      typeInto(fixture, '.query', 'milk');
      const pendingRequest = expectRequest('/api/todos', {q: 'milk'});

      fixture.destroy();

      expect(pendingRequest.cancelled).toBe(true);
    });
  });

  describe('effect factories that throw', () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <p class="error">{{ error()?.message ?? 'none' }}</p>
        <p class="loading">{{ loading() }}</p>
        <button class="invalid" (click)="submit(-1)">Invalid</button>
        <button class="unknown" (click)="submit(0)">Unknown</button>
      `,
    })
    class ValidationComponent {
      private readonly store = createStore({amount: 0});
      readonly submit = this.store.source<number>();
      private readonly submitEffect = this.submit.effect<number>((amount) => {
        if (amount < 0) {
          throw new Error('Amount must be positive');
        }
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- verifies that non-Error throws are wrapped
        throw 'unknown failure';
      });
      readonly loading = this.submitEffect.loading;
      readonly error = this.store.select('error');
    }

    it('writes thrown errors into state and stops loading', async () => {
      const fixture = await renderComponent(ValidationComponent);

      click(fixture, '.invalid');
      await fixture.whenStable();
      expect(textOf(fixture, '.error')).toBe('Amount must be positive');
      expect(textOf(fixture, '.loading')).toBe('false');

      click(fixture, '.unknown');
      await fixture.whenStable();
      expect(textOf(fixture, '.error')).toBe('unknown failure');
    });
  });

  describe('effects without a reducer', () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `<p class="error">{{ error()?.message ?? 'none' }}</p>`,
    })
    class SaveComponent {
      private readonly http = inject(HttpClient);
      private readonly store = createStore({title: 'Draft'});
      readonly save = this.store.source<string>();
      readonly error = this.store.select('error');
      readonly states: unknown[] = [];

      constructor() {
        this.save.effect((title) => this.http.post('/api/save', {title}));
        this.store.asObservable().subscribe((state) => this.states.push(state));
      }
    }

    afterEach(() => httpTesting().verify());

    it('only touches the store to write or clear errors', async () => {
      const fixture = await renderComponent(SaveComponent);
      const component = fixture.componentInstance;

      component.save('first');
      expectRequest('/api/save').flush({});
      expect(component.states.length).toBe(1);

      component.save('second');
      expectRequest('/api/save').flush('offline', {status: 503, statusText: 'Unavailable'});
      await fixture.whenStable();
      expect(textOf(fixture, '.error')).toContain('503 Unavailable');

      component.save('third');
      expectRequest('/api/save').flush({});
      await fixture.whenStable();
      expect(textOf(fixture, '.error')).toBe('none');
      expect(component.states.length).toBe(3);
    });
  });

  describe('long-lived streams', () => {
    @Injectable({providedIn: 'root'})
    class PriceFeed {
      readonly streams = new Map<string, Subject<number>>();

      watch(symbol: string): Observable<number> {
        const stream = new Subject<number>();
        this.streams.set(symbol, stream);
        return stream;
      }
    }

    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <p class="price">{{ price() ?? '-' }}</p>
        <p class="loading">{{ loading() }}</p>
        <button class="stop" (click)="stop()">Stop</button>
      `,
    })
    class TickerComponent {
      private readonly feed = inject(PriceFeed);
      private readonly store = createStore<{price?: number}>({});
      readonly symbol = this.store.source<string>();
      private readonly priceEffect = this.symbol.effect((symbol) => this.feed.watch(symbol));
      readonly price = this.store.select('price');
      readonly loading = this.priceEffect.loading;

      constructor() {
        this.priceEffect.reduce((draft, price) => {
          draft.price = price;
        });
      }

      stop() {
        this.priceEffect.destroy();
      }
    }

    it('stops loading after the first message and keeps applying later messages', async () => {
      const feed = TestBed.inject(PriceFeed);
      const fixture = await renderComponent(TickerComponent);
      TestBed.runInInjectionContext(() => fixture.componentInstance.symbol('ACME'));
      await fixture.whenStable();
      expect(textOf(fixture, '.loading')).toBe('true');

      feed.streams.get('ACME')!.next(10);
      await fixture.whenStable();
      expect(textOf(fixture, '.loading')).toBe('false');
      expect(textOf(fixture, '.price')).toBe('10');

      feed.streams.get('ACME')!.next(12);
      await fixture.whenStable();
      expect(textOf(fixture, '.price')).toBe('12');
    });

    it('unsubscribes from the previous stream on a new value and from all streams on destroy', async () => {
      const feed = TestBed.inject(PriceFeed);
      const fixture = await renderComponent(TickerComponent);
      TestBed.runInInjectionContext(() => fixture.componentInstance.symbol('ACME'));
      TestBed.runInInjectionContext(() => fixture.componentInstance.symbol('GLOBEX'));

      expect(feed.streams.get('ACME')!.observed).toBe(false);
      expect(feed.streams.get('GLOBEX')!.observed).toBe(true);

      click(fixture, '.stop');
      feed.streams.get('GLOBEX')!.next(99);
      await fixture.whenStable();

      expect(feed.streams.get('GLOBEX')!.observed).toBe(false);
      expect(textOf(fixture, '.price')).toBe('-');
      expect(textOf(fixture, '.loading')).toBe('false');
    });
  });
});
