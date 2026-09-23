import {ChangeDetectionStrategy, Component, DestroyRef, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {createStore} from '../signal.store';
import {click, configureIntegrationTestBed, expectRequest, httpTesting, renderComponent, textOf, textsOf} from './integration.helpers';

describe('store-level reducers and effects over several sources', () => {
   beforeEach(() => configureIntegrationTestBed());
   afterEach(() => httpTesting().verify());

   type Flight = {code: string};
   type FlightSearchState = {origin: string; destination: string; date: string; airportName: string; flights: Flight[]; fares: number[]};

   @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
         <p class="route">{{ route() }}</p>
         <p class="airport">{{ airportName() }}</p>
         <p class="loading">{{ flightsLoading() }}</p>
         <ul>
            @for (flight of flights(); track flight.code) {
               <li>{{ flight.code }}</li>
            }
         </ul>
         <p class="fares">{{ fares().join(',') }}</p>
         <button class="swap" (click)="swap()">Swap</button>
      `
   })
   class FlightSearchComponent {
      private readonly http = inject(HttpClient);
      private readonly store = createStore<FlightSearchState>({
         origin: '',
         destination: '',
         date: '',
         airportName: '',
         flights: [],
         fares: []
      });
      readonly origin = this.store.source<string>();
      readonly destination = this.store.source<string>();
      readonly date = this.store.source<string>();
      readonly route = this.store.compute('origin', 'destination', 'date',
         (origin, destination, date) => origin ? `${origin}-${destination} ${date}` : 'incomplete'
      );
      readonly airportName = this.store.select('airportName');
      readonly flights = this.store.select('flights');
      readonly fares = this.store.select('fares');
      private readonly flightsEffect = this.store.effect(this.origin, this.destination, this.date, (origin, destination, date) =>
         this.http.get<Flight[]>('/api/flights', {params: {origin, destination, date}})
      );
      readonly flightsLoading = this.flightsEffect.loading;

      constructor() {
         const routeReducer = this.store.reduce(this.origin, this.destination, this.date, (draft, origin, destination, date) => {
            draft.origin = origin;
            draft.destination = destination;
            draft.date = date;
         });
         inject(DestroyRef).onDestroy(() => routeReducer.unsubscribe());

         this.store.reduce(this.origin, (draft, origin) => {
            draft.airportName = `${origin} Airport`;
         });
         this.store.effect(this.origin, origin => this.http.get<string>(`/api/airports/${origin}`))
            .reduce((draft, name) => {
               draft.airportName = name;
            });
         this.store.effect(this.origin, this.destination, (origin, destination) =>
            this.http.get<number[]>('/api/fares', {params: {origin, destination}})
         ).reduce((draft, fares) => {
            draft.fares = fares;
         });
         this.flightsEffect.reduce((draft, flights) => {
            draft.flights = flights;
         });
      }

      swap() {
         const {origin, destination} = this.store();
         this.origin(destination);
         this.destination(origin);
      }
   }

   const flushOrigin = (origin: string, name: string) => expectRequest(`/api/airports/${origin}`).flush(name);

   it('reduces and runs single-source effects as soon as that source emits', async () => {
      const fixture = await renderComponent(FlightSearchComponent);

      fixture.componentInstance.origin('BER');
      await fixture.whenStable();
      expect(textOf(fixture, '.airport')).toBe('BER Airport');

      flushOrigin('BER', 'Berlin Brandenburg');
      await fixture.whenStable();

      expect(textOf(fixture, '.airport')).toBe('Berlin Brandenburg');
      expect(textOf(fixture, '.route')).toBe('incomplete');
   });

   it('waits for every source before reducing and running multi-source effects', async () => {
      const fixture = await renderComponent(FlightSearchComponent);
      const component = fixture.componentInstance;

      component.origin('BER');
      flushOrigin('BER', 'Berlin Brandenburg');
      component.destination('LIS');
      expectRequest('/api/fares', {origin: 'BER', destination: 'LIS'}).flush([99, 149]);
      httpTesting().expectNone(request => request.url === '/api/flights');

      component.date('2026-10-01');
      await fixture.whenStable();
      expect(textOf(fixture, '.route')).toBe('BER-LIS 2026-10-01');
      expect(textOf(fixture, '.loading')).toBe('true');

      expectRequest('/api/flights', {origin: 'BER', destination: 'LIS', date: '2026-10-01'}).flush([{code: 'TP 555'}]);
      await fixture.whenStable();

      expect(textsOf(fixture, 'li')).toEqual(['TP 555']);
      expect(textOf(fixture, '.fares')).toBe('99,149');
      expect(textOf(fixture, '.loading')).toBe('false');
   });

   it('reacts to every later change with the latest value of all sources', async () => {
      const fixture = await renderComponent(FlightSearchComponent);
      const component = fixture.componentInstance;
      component.origin('BER');
      flushOrigin('BER', 'Berlin Brandenburg');
      component.destination('LIS');
      expectRequest('/api/fares', {origin: 'BER', destination: 'LIS'}).flush([99]);
      component.date('2026-10-01');
      expectRequest('/api/flights', {origin: 'BER', destination: 'LIS', date: '2026-10-01'}).flush([]);
      await fixture.whenStable();

      click(fixture, '.swap');

      flushOrigin('LIS', 'Lisbon');
      expect(expectRequest('/api/fares', {origin: 'LIS', destination: 'LIS'}).cancelled).toBe(true);
      expect(expectRequest('/api/flights', {origin: 'LIS', destination: 'LIS'}).cancelled).toBe(true);
      expectRequest('/api/fares', {origin: 'LIS', destination: 'BER'}).flush([120]);
      expectRequest('/api/flights', {origin: 'LIS', destination: 'BER', date: '2026-10-01'}).flush([{code: 'TP 556'}]);
      await fixture.whenStable();

      expect(textOf(fixture, '.route')).toBe('LIS-BER 2026-10-01');
      expect(textsOf(fixture, 'li')).toEqual(['TP 556']);
      expect(textOf(fixture, '.fares')).toBe('120');
   });

   it('stops a combined reducer on unsubscribe while store effects keep running until destroyed', async () => {
      const fixture = await renderComponent(FlightSearchComponent);
      const component = fixture.componentInstance;
      component.origin('BER');
      flushOrigin('BER', 'Berlin Brandenburg');
      component.destination('LIS');
      expectRequest('/api/fares').flush([]);
      component.date('2026-10-01');
      expectRequest('/api/flights').flush([]);
      await fixture.whenStable();

      fixture.destroy();
      component.date('2026-12-24');

      expect(component.route()).toBe('BER-LIS 2026-10-01');
      expectRequest('/api/flights', {date: '2026-12-24'}).flush([]);
   });
});
