import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {createStore} from '../signal.store';
import {withHistory} from '../signal.features';
import type {StoreFeature} from '../signal.features';
import {
  buttonOf,
  click,
  configureIntegrationTestBed,
  expectRequest,
  httpTesting,
  renderComponent,
  textsOf,
} from './integration.helpers';

describe('undo history integration', () => {
  beforeEach(() => configureIntegrationTestBed());

  const renderNotes = (...features: StoreFeature[]) => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <ul>
          @for (note of notes(); track $index) {
            <li>{{ note }}</li>
          }
        </ul>
        <button class="undo" [disabled]="!store.canUndo()" (click)="store.undo()">Undo</button>
        <button class="redo" [disabled]="!store.canRedo()" (click)="store.redo()">Redo</button>
      `,
    })
    class OptionsNotesComponent {
      readonly store = createStore<{notes: string[]}>({notes: []}, ...features);
      readonly add = this.store.source<string>();
      readonly notes = this.store.select('notes');

      constructor() {
        this.add.reduce((draft, note) => {
          if (!draft.notes.includes(note)) {
            draft.notes.push(note);
          }
        });
      }
    }

    return renderComponent(OptionsNotesComponent);
  };

  it('undoes and redoes through the template within the history limit', async () => {
    const fixture = await renderNotes(withHistory({limit: 2}));
    expect(buttonOf(fixture, '.undo').disabled).toBe(true);

    ['first', 'second', 'third'].forEach((note) => fixture.componentInstance.add(note));
    await fixture.whenStable();
    expect(textsOf(fixture, 'li')).toEqual(['first', 'second', 'third']);

    click(fixture, '.undo');
    click(fixture, '.undo');
    await fixture.whenStable();

    expect(textsOf(fixture, 'li')).toEqual(['first']);
    expect(buttonOf(fixture, '.undo').disabled).toBe(true);
    expect(buttonOf(fixture, '.redo').disabled).toBe(false);

    click(fixture, '.redo');
    fixture.componentInstance.add('replacement');
    await fixture.whenStable();

    expect(textsOf(fixture, 'li')).toEqual(['first', 'second', 'replacement']);
    expect(buttonOf(fixture, '.redo').disabled).toBe(true);
  });

  it('keeps history with the default limit and ignores reducers that change nothing', async () => {
    const fixture = await renderNotes(withHistory());
    const notes = Array.from({length: 5}, (_, index) => `note ${index}`);
    notes.forEach((note) => fixture.componentInstance.add(note));
    fixture.componentInstance.add('note 4');

    notes.forEach(() => fixture.componentInstance.store.undo());
    await fixture.whenStable();

    expect(textsOf(fixture, 'li')).toEqual([]);
    expect(buttonOf(fixture, '.undo').disabled).toBe(true);
  });

  it('keeps no history with a limit of zero', async () => {
    const fixture = await renderNotes(withHistory({limit: 0}));

    fixture.componentInstance.add('first');
    await fixture.whenStable();

    expect(buttonOf(fixture, '.undo').disabled).toBe(true);
  });

  it('treats undo and redo as no-ops without patches', async () => {
    const fixture = await renderNotes();
    fixture.componentInstance.add('first');

    fixture.componentInstance.store.undo();
    fixture.componentInstance.store.redo();
    await fixture.whenStable();

    expect(textsOf(fixture, 'li')).toEqual(['first']);
    expect(buttonOf(fixture, '.undo').disabled).toBe(true);
    expect(buttonOf(fixture, '.redo').disabled).toBe(true);
  });

  it('treats undo and redo as no-ops at the ends of the history', async () => {
    const fixture = await renderNotes(withHistory());
    const emissions: unknown[] = [];
    fixture.componentInstance.store.asObservable().subscribe((state) => emissions.push(state));

    fixture.componentInstance.store.undo();
    fixture.componentInstance.add('first');
    fixture.componentInstance.store.redo();

    expect(emissions.length).toBe(2);
  });

  describe('with effects', () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <ul>
          @for (item of items(); track item) {
            <li>{{ item }}</li>
          }
        </ul>
        <button class="undo" (click)="store.undo()">Undo</button>
        <button class="redo" (click)="store.redo()">Redo</button>
      `,
    })
    class ImportComponent {
      private readonly http = inject(HttpClient);
      readonly store = createStore<{items: string[]}>({items: ['local']}, withHistory());
      readonly importFrom = this.store.source<string>();
      readonly items = this.store.select('items');

      constructor() {
        this.importFrom
          .effect((url) => this.http.get<string[]>(url))
          .reduce((draft, items) => {
            draft.items.push(...items);
          });
      }
    }

    afterEach(() => httpTesting().verify());

    it('makes effect results undoable and redoable', async () => {
      const fixture = await renderComponent(ImportComponent);
      fixture.componentInstance.importFrom('/api/import');
      expectRequest('/api/import').flush(['remote a', 'remote b']);
      await fixture.whenStable();
      expect(textsOf(fixture, 'li')).toEqual(['local', 'remote a', 'remote b']);

      click(fixture, '.undo');
      await fixture.whenStable();
      expect(textsOf(fixture, 'li')).toEqual(['local']);

      click(fixture, '.redo');
      await fixture.whenStable();
      expect(textsOf(fixture, 'li')).toEqual(['local', 'remote a', 'remote b']);
    });

    it('undoes a failed effect back to the state before the error', async () => {
      const fixture = await renderComponent(ImportComponent);
      const store = fixture.componentInstance.store;
      fixture.componentInstance.importFrom('/api/import');
      expectRequest('/api/import').flush('down', {status: 500, statusText: 'Server Error'});
      expect(store().error).toBeDefined();

      store.undo();

      expect(store().error).toBeUndefined();
      expect(store.canRedo()).toBe(true);
    });
  });
});
