import {ChangeDetectionStrategy, Component, effect, inject, Injectable, input} from '@angular/core';
import {createCoreStore} from '../signal.core';
import {click, configureIntegrationTestBed, renderComponent, textOf, textsOf, typeInto} from './integration.helpers';

describe('core store integration', () => {
   beforeEach(() => configureIntegrationTestBed());

   type Order = {items: string[]; filter: string; discount: number; shipping: number; currency: string};

   @Injectable()
   class OrderStore {
      readonly store = createCoreStore<Order>({items: ['apples', 'bread'], filter: '', discount: 0, shipping: 4, currency: 'EUR'});
      readonly items = this.store.select('items');
      readonly visibleItems = this.store.compute('items', 'filter', (items, filter) => items.filter(item => item.includes(filter)));
      readonly count = this.store.compute('items', items => items.length);
      readonly price = this.store.compute('items', 'discount', 'shipping', (items, discount, shipping) => items.length * 10 - discount + shipping);
      readonly priceLabel = this.store.compute('items', 'discount', 'shipping', 'currency',
         (items, discount, shipping, currency) => `${items.length * 10 - discount + shipping} ${currency}`
      );
      readonly summary = this.store.compute('items', 'filter', 'discount', 'shipping', 'currency',
         (items, filter, discount, shipping, currency) => `${items.length} items, filter "${filter}", ${items.length * 10 - discount + shipping} ${currency}`
      );
      countRuns = 0;
      readonly trackedCount = this.store.compute('items', items => {
         this.countRuns++;
         return items.length;
      });

      add(item: string) {
         this.store.reduce(draft => {
            draft.items.push(item);
         });
      }

      setFilter(filter: string) {
         this.store.reduce(draft => {
            draft.filter = filter;
         });
      }

      setDiscount(discount: number) {
         this.store.reduce(draft => {
            draft.discount = discount;
         });
      }
   }

   @Component({
      selector: 'order',
      changeDetection: ChangeDetectionStrategy.OnPush,
      providers: [OrderStore],
      template: `
         <input class="filter" (input)="order.setFilter($any($event.target).value)">
         <button class="add" (click)="order.add('item ' + (order.count() + 1))">Add</button>
         <ul>
            @for (item of order.visibleItems(); track item) {
               <li>{{ item }}</li>
            }
         </ul>
         <p class="price">{{ order.price() }}</p>
         <p class="price-label">{{ order.priceLabel() }}</p>
         <p class="summary">{{ order.summary() }}</p>
         <p class="tracked">{{ order.trackedCount() }}</p>
      `
   })
   class OrderComponent {
      readonly discount = input(0);
      readonly order = inject(OrderStore);

      constructor() {
         effect(() => this.order.setDiscount(this.discount()));
      }
   }

   it('renders select and compute with one to five keys after reducers', async () => {
      const fixture = await renderComponent(OrderComponent);
      expect(textsOf(fixture, 'li')).toEqual(['apples', 'bread']);

      click(fixture, '.add');
      typeInto(fixture, '.filter', 'i');
      await fixture.whenStable();

      expect(textsOf(fixture, 'li')).toEqual(['item 3']);
      expect(fixture.componentInstance.order.items()).toEqual(['apples', 'bread', 'item 3']);
      expect(textOf(fixture, '.price')).toBe('34');
      expect(textOf(fixture, '.price-label')).toBe('34 EUR');
      expect(textOf(fixture, '.summary')).toBe('3 items, filter "i", 34 EUR');
   });

   it('reduces from an Angular effect that tracks an input', async () => {
      const fixture = await renderComponent(OrderComponent);

      fixture.componentRef.setInput('discount', 5);
      await fixture.whenStable();

      expect(textOf(fixture, '.price')).toBe('19');
   });

   it('does not recompute or emit for unrelated or unchanged state', async () => {
      const fixture = await renderComponent(OrderComponent);
      const order = fixture.componentInstance.order;
      const snapshot = order.store();
      const runsAfterFirstRender = order.countRuns;

      typeInto(fixture, '.filter', 'a');
      await fixture.whenStable();
      expect(order.countRuns).toBe(runsAfterFirstRender);

      const stateBeforeNoop = order.store();
      order.setFilter('a');
      expect(order.store()).toBe(stateBeforeNoop);
      expect(snapshot.filter).toBe('');
   });
});
