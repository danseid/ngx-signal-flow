import {ChangeDetectionStrategy, Component, DestroyRef, inject, Injectable, Injector, input, signal} from '@angular/core';
import {AsyncPipe} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {createStore} from '../signal.store';
import {
   click,
   configureIntegrationTestBed,
   expectRequest,
   httpTesting,
   renderComponent,
   textOf
} from './integration.helpers';

describe('source integration', () => {
   beforeEach(() => configureIntegrationTestBed());

   describe('emitting values', () => {
      @Component({
         changeDetection: ChangeDetectionStrategy.OnPush,
         imports: [AsyncPipe],
         template: `
            <p class="count">{{ count() }}</p>
            <p class="last-step">{{ step.asObservable() | async }}</p>
            <button class="tick" (click)="tick()">Tick</button>
            <button class="step" (click)="step(5)">Step 5</button>
         `
      })
      class TickerComponent {
         private readonly store = createStore({count: 0, step: 0});
         readonly tick = this.store.source<void>();
         readonly step = this.store.source<number>(2);
         readonly count = this.store.select('count');

         constructor() {
            this.step.reduce((draft, step) => {
               draft.step = step;
            });
            this.tick.reduce(draft => {
               draft.count += draft.step;
            });
         }
      }

      it('replays the start value to reducers and renders source values through the async pipe', async () => {
         const fixture = await renderComponent(TickerComponent);
         expect(textOf(fixture, '.last-step')).toBe('2');

         click(fixture, '.tick');
         await fixture.whenStable();
         expect(textOf(fixture, '.count')).toBe('2');

         click(fixture, '.step');
         click(fixture, '.tick');
         await fixture.whenStable();

         expect(textOf(fixture, '.last-step')).toBe('5');
         expect(textOf(fixture, '.count')).toBe('7');
      });

      it('does not replay values of sources without a start value', () => {
         const store = createStore({count: 0});
         const source = store.source<number>();
         source(3);

         source.reduce((draft, value) => {
            draft.count = value;
         });

         expect(store().count).toBe(0);
      });
   });

   describe('reducer lifecycle', () => {
      @Injectable({providedIn: 'root'})
      class ClickStore {
         readonly store = createStore({clicks: 0});
         readonly click = this.store.source<void>();
      }

      @Component({
         changeDetection: ChangeDetectionStrategy.OnPush,
         template: `<p class="clicks">{{ clicks() }}</p>`
      })
      class ClickCounterComponent {
         private readonly clickStore = inject(ClickStore);
         readonly clicks = this.clickStore.store.select('clicks');

         constructor() {
            const subscription = this.clickStore.click.reduce(draft => {
               draft.clicks++;
            });
            inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
         }
      }

      it('stops a component-owned reducer on a root source when the component is destroyed', async () => {
         const fixture = await renderComponent(ClickCounterComponent);
         const clickStore = TestBed.inject(ClickStore);

         clickStore.click();
         await fixture.whenStable();
         expect(textOf(fixture, '.clicks')).toBe('1');

         fixture.destroy();
         clickStore.click();

         expect(clickStore.store().clicks).toBe(1);
      });
   });

   describe('connecting Angular signals', () => {
      @Component({
         selector: 'profile-card',
         changeDetection: ChangeDetectionStrategy.OnPush,
         template: `<p class="name">{{ name() }}</p><p class="nickname">{{ nickname() ?? 'none' }}</p>`
      })
      class ProfileCardComponent {
         readonly userName = input<string>();
         readonly userNickname = input<string>();
         private readonly store = createStore<{name: string; nickname?: string}>({name: 'Anonymous', nickname: 'anon'});
         private readonly setName = this.store.source<string>();
         private readonly setNickname = this.store.source<string | undefined>();
         readonly name = this.store.select('name');
         readonly nickname = this.store.select('nickname');

         constructor() {
            this.setName.reduce((draft, name) => {
               draft.name = name;
            });
            this.setNickname.reduce((draft, nickname) => {
               draft.nickname = nickname;
            });
            this.setName.connect(this.userName);
            this.setNickname.connect(this.userNickname, {skipUndefined: false});
         }
      }

      @Component({
         changeDetection: ChangeDetectionStrategy.OnPush,
         imports: [ProfileCardComponent],
         template: `<profile-card [userName]="name()" [userNickname]="nickname()" />`
      })
      class ProfileHostComponent {
         readonly name = signal<string | undefined>(undefined);
         readonly nickname = signal<string | undefined>('ada');
      }

      it('skips undefined inputs by default and forwards them with skipUndefined: false', async () => {
         const fixture = await renderComponent(ProfileHostComponent);
         expect(textOf(fixture, '.name')).toBe('Anonymous');
         expect(textOf(fixture, '.nickname')).toBe('ada');

         fixture.componentInstance.name.set('Ada Lovelace');
         await fixture.whenStable();
         expect(textOf(fixture, '.name')).toBe('Ada Lovelace');

         fixture.componentInstance.name.set(undefined);
         fixture.componentInstance.nickname.set(undefined);
         await fixture.whenStable();

         expect(textOf(fixture, '.name')).toBe('Ada Lovelace');
         expect(textOf(fixture, '.nickname')).toBe('none');
      });

      it('connects outside an injection context when an injector is passed', () => {
         const store = createStore({count: 0});
         const source = store.source<number>();
         const count = signal(1);
         source.reduce((draft, value) => {
            draft.count = value;
         });

         expect(() => source.connect(count)).toThrow();

         source.connect(count, {injector: TestBed.inject(Injector)});
         TestBed.tick();
         expect(store().count).toBe(1);

         count.set(4);
         TestBed.tick();
         expect(store().count).toBe(4);
      });
   });

   describe('destroying a source', () => {
      @Component({
         changeDetection: ChangeDetectionStrategy.OnPush,
         template: `<p class="query">{{ query() }}</p><p class="results">{{ results().join(',') }}</p>`
      })
      class SearchComponent {
         private readonly http = inject(HttpClient);
         private readonly store = createStore<{query: string; results: string[]}>({query: '', results: []});
         readonly term = signal('');
         readonly search = this.store.source<string>();
         readonly query = this.store.select('query');
         readonly results = this.store.select('results');

         constructor() {
            this.search.reduce((draft, query) => {
               draft.query = query;
            });
            this.search.effect(query => this.http.get<string[]>('/api/search', {params: {q: query}}))
               .reduce((draft, results) => {
                  draft.results = results;
               });
            this.search.connect(this.term);
         }
      }

      afterEach(() => httpTesting().verify());

      it('stops reducers, effects and connected signals and cancels pending requests', async () => {
         const fixture = await renderComponent(SearchComponent);
         const component = fixture.componentInstance;
         const initialSearch = expectRequest('/api/search', {q: ''});
         component.term.set('lamp');
         await fixture.whenStable();
         const pending = expectRequest('/api/search', {q: 'lamp'});
         expect(initialSearch.cancelled).toBe(true);

         component.search.destroy();
         component.search('chair');
         component.term.set('table');
         await fixture.whenStable();

         expect(pending.cancelled).toBe(true);
         expect(textOf(fixture, '.query')).toBe('lamp');
         httpTesting().expectNone(request => request.url === '/api/search');
      });
   });
});
