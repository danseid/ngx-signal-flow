import {ChangeDetectionStrategy, Component, DestroyRef, inject, Injectable} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {createStore} from '../signal.store';
import {configureIntegrationTestBed, renderComponent, textOf} from './integration.helpers';

describe('store-level effect integration', () => {
  @Injectable({providedIn: 'root'})
  class DraftStorage {
    readonly saved: string[] = [];
  }

  @Injectable()
  class ProfileStore {
    private readonly storage = inject(DraftStorage);
    private readonly store = createStore({name: 'Ada'});
    readonly rename = this.store.source<string>();
    readonly name = this.store.select('name');
    readonly persist = this.store.effect((state) => this.storage.saved.push(state.name));

    constructor() {
      this.rename.reduce((draft, name) => {
        draft.name = name;
      });
      inject(DestroyRef).onDestroy(() => this.persist.destroy());
    }
  }

  @Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [ProfileStore],
    template: `<p class="name">{{ profile.name() }}</p>`,
  })
  class ProfileComponent {
    readonly profile = inject(ProfileStore);
  }

  beforeEach(() => configureIntegrationTestBed());

  it('observes the initial state and every change, but not unchanged state', async () => {
    const storage = TestBed.inject(DraftStorage);
    const fixture = await renderComponent(ProfileComponent);
    const profile = fixture.componentInstance.profile;

    profile.rename('Grace');
    profile.rename('Grace');
    await fixture.whenStable();

    expect(textOf(fixture, '.name')).toBe('Grace');
    expect(storage.saved).toEqual(['Ada', 'Grace']);
  });

  it('is not loading after the observer has run', async () => {
    const fixture = await renderComponent(ProfileComponent);
    const profile = fixture.componentInstance.profile;

    profile.rename('Grace');

    expect(profile.persist.loading()).toBe(false);
  });

  it('stops observing when the owning component is destroyed', async () => {
    const storage = TestBed.inject(DraftStorage);
    const fixture = await renderComponent(ProfileComponent);
    const profile = fixture.componentInstance.profile;

    fixture.destroy();
    profile.rename('Linus');

    expect(storage.saved).toEqual(['Ada']);
  });
});
