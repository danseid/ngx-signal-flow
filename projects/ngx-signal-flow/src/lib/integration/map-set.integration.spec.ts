import {ChangeDetectionStrategy, Component} from '@angular/core';
import {createStore} from '../signal.store';
import {click, configureIntegrationTestBed, renderComponent, textOf} from './integration.helpers';

describe('Map and Set state integration', () => {
   beforeEach(() => configureIntegrationTestBed());

   @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
         @for (id of [1, 2, 3]; track id) {
            <button [class]="'toggle-' + id" (click)="toggle(id)">{{ id }}</button>
         }
         <p class="selection">{{ selection() }}</p>
         <button class="undo" (click)="store.undo()">Undo</button>
      `
   })
   class SelectionComponent {
      readonly store = createStore<{selected: Set<number>}>({selected: new Set()}, {withMapSet: true, withPatches: true});
      readonly toggle = this.store.source<number>();
      readonly selection = this.store.compute('selected', selected => [...selected].sort().join(',') || 'none');

      constructor() {
         this.toggle.reduce((draft, id) => {
            if (!draft.selected.delete(id)) {
               draft.selected.add(id);
            }
         });
      }
   }

   @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
         <p class="cart">{{ summary() }}</p>
         <button class="add-lamp" (click)="add('lamp')">Lamp</button>
         <button class="add-chair" (click)="add('chair')">Chair</button>
      `
   })
   class QuantitiesComponent {
      readonly store = createStore<{quantities: Map<string, number>}>({quantities: new Map()}, {withMapSet: true});
      readonly add = this.store.source<string>();
      readonly summary = this.store.compute('quantities', quantities =>
         [...quantities].map(([product, quantity]) => `${product}:${quantity}`).join(' ') || 'empty'
      );

      constructor() {
         this.add.reduce((draft, product) => {
            draft.quantities.set(product, (draft.quantities.get(product) ?? 0) + 1);
         });
      }
   }

   it('updates Set state immutably and restores it with undo', async () => {
      const fixture = await renderComponent(SelectionComponent);
      const initialSelection = fixture.componentInstance.store().selected;

      click(fixture, '.toggle-3');
      click(fixture, '.toggle-1');
      click(fixture, '.toggle-3');
      await fixture.whenStable();
      expect(textOf(fixture, '.selection')).toBe('1');

      click(fixture, '.undo');
      await fixture.whenStable();

      expect(textOf(fixture, '.selection')).toBe('1,3');
      expect(fixture.componentInstance.store().selected).toBeInstanceOf(Set);
      expect(initialSelection.size).toBe(0);
   });

   it('updates Map state immutably without patches', async () => {
      const fixture = await renderComponent(QuantitiesComponent);
      const initialQuantities = fixture.componentInstance.store().quantities;

      click(fixture, '.add-lamp');
      click(fixture, '.add-chair');
      click(fixture, '.add-lamp');
      await fixture.whenStable();

      expect(textOf(fixture, '.cart')).toBe('lamp:2 chair:1');
      expect(fixture.componentInstance.store().quantities).toBeInstanceOf(Map);
      expect(initialQuantities.size).toBe(0);
      expect(fixture.componentInstance.store.canUndo()).toBe(false);
   });
});
