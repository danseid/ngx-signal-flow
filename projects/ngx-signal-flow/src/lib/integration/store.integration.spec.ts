import {ChangeDetectionStrategy, Component, effect, inject, Injectable, input} from '@angular/core';
import {AsyncPipe} from '@angular/common';
import {createStore} from '../signal.store';
import {click, configureIntegrationTestBed, renderComponent, textOf} from './integration.helpers';

describe('plain store integration', () => {
   beforeEach(() => configureIntegrationTestBed());

   describe('selectors and computed values', () => {
      type Invoice = {net: number; taxRate: number; discount: number; shipping: number; currency: string};

      @Component({
         changeDetection: ChangeDetectionStrategy.OnPush,
         template: `
            <p class="net">{{ net() }}</p>
            <p class="currency">{{ currency() }}</p>
            <p class="tax">{{ tax() }}</p>
            <p class="discounted">{{ discounted() }}</p>
            <p class="subtotal">{{ subtotal() }}</p>
            <p class="total">{{ total() }}</p>
            <p class="snapshot">{{ snapshot() }}</p>
            <button class="raise" (click)="raise()">Raise</button>
         `
      })
      class InvoiceComponent {
         private readonly store = createStore<Invoice>({net: 100, taxRate: 0.2, discount: 10, shipping: 5, currency: 'EUR'});
         readonly net = this.store.select('net');
         readonly currency = this.store.select('currency');
         readonly tax = this.store.compute('net', net => net * 0.2);
         readonly discounted = this.store.compute('net', 'discount', (net, discount) => net - discount);
         readonly subtotal = this.store.compute('net', 'discount', 'shipping', (net, discount, shipping) => net - discount + shipping);
         readonly withTax = this.store.compute('net', 'discount', 'shipping', 'taxRate',
            (net, discount, shipping, taxRate) => (net - discount) * (1 + taxRate) + shipping
         );
         readonly total = this.store.compute('net', 'discount', 'shipping', 'taxRate', 'currency',
            (net, discount, shipping, taxRate, currency) => `${(net - discount) * (1 + taxRate) + shipping} ${currency}`
         );
         readonly snapshot = () => JSON.stringify(this.store());

         raise() {
            this.store.reduce(draft => {
               draft.net += 100;
            });
         }
      }

      it('renders select and compute with one to five keys and updates them after a reducer', async () => {
         const fixture = await renderComponent(InvoiceComponent);
         expect(textOf(fixture, '.total')).toBe('113 EUR');

         click(fixture, '.raise');
         await fixture.whenStable();

         expect(textOf(fixture, '.net')).toBe('200');
         expect(textOf(fixture, '.currency')).toBe('EUR');
         expect(textOf(fixture, '.tax')).toBe('40');
         expect(textOf(fixture, '.discounted')).toBe('190');
         expect(textOf(fixture, '.subtotal')).toBe('195');
         expect(fixture.componentInstance.withTax()).toBe(233);
         expect(textOf(fixture, '.total')).toBe('233 EUR');
         expect(JSON.parse(textOf(fixture, '.snapshot')!)).toEqual({net: 200, taxRate: 0.2, discount: 10, shipping: 5, currency: 'EUR'});
      });

      it('returns the same selector signal for repeated selects of a key', () => {
         const store = createStore({count: 0});

         expect(store.select('count')).toBe(store.select('count'));
      });
   });

   describe('state stream', () => {
      @Component({
         changeDetection: ChangeDetectionStrategy.OnPush,
         imports: [AsyncPipe],
         template: `
            @if (store.asObservable() | async; as state) {
               <p class="stream">{{ state.count }}</p>
            }
            <button class="increment" (click)="increment()">+</button>
            <button class="noop" (click)="noop()">No-op</button>
         `
      })
      class StreamComponent {
         readonly store = createStore({count: 0});
         emissions = 0;

         constructor() {
            this.store.asObservable().subscribe(() => this.emissions++);
         }

         increment() {
            this.store.reduce(draft => {
               draft.count++;
            });
         }

         noop() {
            this.store.reduce(draft => {
               draft.count = draft.count;
            });
         }
      }

      it('renders the store observable through the async pipe', async () => {
         const fixture = await renderComponent(StreamComponent);
         expect(textOf(fixture, '.stream')).toBe('0');

         click(fixture, '.increment');
         await fixture.whenStable();

         expect(textOf(fixture, '.stream')).toBe('1');
      });

      it('does not emit for reducers that leave the state unchanged', async () => {
         const fixture = await renderComponent(StreamComponent);

         click(fixture, '.noop');
         click(fixture, '.increment');
         click(fixture, '.noop');
         await fixture.whenStable();

         expect(fixture.componentInstance.emissions).toBe(2);
      });
   });

   describe('errors in state', () => {
      @Component({
         changeDetection: ChangeDetectionStrategy.OnPush,
         template: `
            <p class="error">{{ error()?.message ?? 'none' }}</p>
            <button class="fail" (click)="fail()">Fail</button>
            <button class="recover" (click)="recover()">Recover</button>
         `
      })
      class ErrorComponent {
         private readonly store = createStore({count: 0});
         readonly error = this.store.select('error');

         fail() {
            this.store.reduce(draft => {
               draft.error = new Error('Validation failed');
            });
         }

         recover() {
            this.store.reduce(draft => {
               draft.error = undefined;
            });
         }
      }

      it('renders the error field of the base state', async () => {
         const fixture = await renderComponent(ErrorComponent);
         expect(textOf(fixture, '.error')).toBe('none');

         click(fixture, '.fail');
         await fixture.whenStable();
         expect(textOf(fixture, '.error')).toBe('Validation failed');

         click(fixture, '.recover');
         await fixture.whenStable();
         expect(textOf(fixture, '.error')).toBe('none');
      });
   });

   describe('store shared by several components', () => {
      @Injectable({providedIn: 'root'})
      class CartStore {
         private readonly store = createStore<{items: string[]}>({items: []});
         readonly add = this.store.source<string>();
         readonly count = this.store.compute('items', items => items.length);

         constructor() {
            this.add.reduce((draft, item) => {
               draft.items.push(item);
            });
         }
      }

      @Component({
         selector: 'add-to-cart',
         changeDetection: ChangeDetectionStrategy.OnPush,
         template: `<button class="add" (click)="cart.add(product())">Add</button>`
      })
      class AddToCartComponent {
         readonly product = input.required<string>();
         protected readonly cart = inject(CartStore);
      }

      @Component({
         selector: 'cart-badge',
         changeDetection: ChangeDetectionStrategy.OnPush,
         template: `<span class="badge">{{ cart.count() }}</span>`
      })
      class CartBadgeComponent {
         protected readonly cart = inject(CartStore);
      }

      @Component({
         changeDetection: ChangeDetectionStrategy.OnPush,
         imports: [AddToCartComponent, CartBadgeComponent],
         template: `<cart-badge /><add-to-cart product="Lamp" />`
      })
      class ShopComponent {
      }

      it('updates a sibling component through a root store', async () => {
         const fixture = await renderComponent(ShopComponent);
         expect(textOf(fixture, '.badge')).toBe('0');

         click(fixture, '.add');
         click(fixture, '.add');
         await fixture.whenStable();

         expect(textOf(fixture, '.badge')).toBe('2');
      });
   });

   describe('reducing from an Angular effect', () => {
      @Component({
         selector: 'greeting',
         changeDetection: ChangeDetectionStrategy.OnPush,
         template: `<p class="greeting">{{ greeting() }}</p><p class="renders">{{ renders() }}</p>`
      })
      class GreetingComponent {
         readonly name = input('World');
         private readonly store = createStore({name: '', updates: 0});
         readonly greeting = this.store.compute('name', name => `Hello ${name}`);
         readonly renders = this.store.select('updates');

         constructor() {
            effect(() => {
               const name = this.name();
               this.store.reduce(draft => {
                  draft.name = name;
                  draft.updates++;
               });
            });
         }
      }

      it('syncs inputs into the store once per input change', async () => {
         const fixture = await renderComponent(GreetingComponent);
         expect(textOf(fixture, '.greeting')).toBe('Hello World');

         fixture.componentRef.setInput('name', 'Ada');
         await fixture.whenStable();

         expect(textOf(fixture, '.greeting')).toBe('Hello Ada');
         expect(textOf(fixture, '.renders')).toBe('2');
      });
   });
});
