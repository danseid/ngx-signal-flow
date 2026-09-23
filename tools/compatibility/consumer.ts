import {of} from 'rxjs';
import {createCoreStore, createStore, withHistory, withMapSet} from 'ngx-signal-flow';
import type {Effect, SignalStore, Source} from 'ngx-signal-flow';

const expectEqual = <T>(actual: T, expected: T, label: string) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
};

type Cart = {items: string[]; total: number; tags: Set<string>};

const store: SignalStore<Cart> = createStore<Cart>(
  {items: [], total: 0, tags: new Set()},
  withHistory({limit: 10}),
  withMapSet(),
);
const add: Source<Cart, string> = store.source<string>();
const discount = store.source(0);
const reset = store.source<void>();

add.reduce((draft, item) => {
  draft.items.push(item);
  draft.tags.add(item);
});
store.reduce(add, discount, (draft, item, value) => {
  draft.total = item.length - value;
});
reset.reduce((draft) => {
  draft.items = [];
});
const summary = store.compute('items', 'total', (items, total) => `${items.length}:${total}`);
const lookup: Effect<Cart, number> = add.effect((item) => of(item.length * 10));
lookup.reduce((draft, price) => {
  draft.total += price;
});

export const typeOnlyChecks = () => {
  // @ts-expect-error a string source needs a value
  add();
};

add('apple');
expectEqual(summary(), '1:55', 'summary after add');
expectEqual(store().tags.has('apple'), true, 'set value');
expectEqual(store.canUndo(), true, 'canUndo');

store.undo();
expectEqual(store().total, 5, 'total after undo');
expectEqual(store.canRedo(), true, 'canRedo');

reset();
expectEqual(store().items.length, 0, 'items after reset');

const core = createCoreStore({count: 1});
core.reduce((draft) => {
  draft.count++;
});
expectEqual(core.compute('count', (count) => count * 2)(), 4, 'core compute');

store.destroy();
console.log('ngx-signal-flow compatibility check passed');
