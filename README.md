# 🚀 ngx-signal-flow

[![CI](https://github.com/danseid/ngx-signal-flow/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/danseid/ngx-signal-flow/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/danseid/ngx-signal-flow/badges/coverage.json)](https://github.com/danseid/ngx-signal-flow/actions/workflows/ci.yml)
[![Branch coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/danseid/ngx-signal-flow/badges/branches.json)](https://github.com/danseid/ngx-signal-flow/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ngx-signal-flow)](https://www.npmjs.com/package/ngx-signal-flow)
[![npm downloads](https://img.shields.io/npm/dm/ngx-signal-flow)](https://www.npmjs.com/package/ngx-signal-flow)
[![createStore size](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/danseid/ngx-signal-flow/badges/bundle-size.json)](#performance-checks)
[![createCoreStore size](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/danseid/ngx-signal-flow/badges/core-bundle-size.json)](#performance-checks)
[![Angular](https://img.shields.io/npm/dependency-version/ngx-signal-flow/peer/@angular/core?label=angular)](https://angular.dev)
[![License](https://img.shields.io/npm/l/ngx-signal-flow)](LICENSE)
[![semantic-release](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

Welcome to ngx-signal-flow, a lightweight state management library for Angular applications! 🌟

## 📖 Overview

ngx-signal-flow keeps your state in an Angular signal, updates it with [Immer](https://immerjs.github.io/immer/) recipes, and uses RxJS for event sources and asynchronous side effects.

### ✨ Features

- 🔄 State as Angular signals, with memoized selectors and computed values
- ✏️ Immutable updates written as mutations, powered by Immer
- 📡 Sources that connect events, signals and component inputs to the store
- 💥 Effects with loading and error signals for HTTP calls and other side effects
- ↩️ Optional undo and redo history
- 🔒 Type-safe reducers, effects and selectors for any number of inputs
- 📦 Tree-shakable features and a store variant without RxJS
- ✅ Unit, integration and peer-compatibility tests

## 📦 Installation

ngx-signal-flow supports **Angular 19, 20, 21, and 22** with **RxJS 7.5.5 or later** and **Immer 10.1 or later**.

To install ngx-signal-flow, run the following command in your Angular project:

```Bash
npm install ngx-signal-flow
```

## 🚀 Getting Started

Here’s a quick guide to get you started with ngx-signal-flow:

### 1. Define your state

```TypeScript
type AppState = {
  count: number;
};
```

### 2. Create your store, sources, reducers and selectors (signals)

```TypeScript
import { Injectable } from '@angular/core';
import { createStore } from 'ngx-signal-flow';

@Injectable({
  providedIn: 'root',
})
export class AppStore {
  private readonly store = createStore<AppState>({ count: 0 });

  // SOURCES
  readonly increment = this.store.source<number>();
  readonly decrement = this.store.source<number>();

  // SELECTORS
  readonly count = this.store.select('count');

  constructor() {
    // REDUCERS
    this.increment.reduce((draft, value) => {
      draft.count += value;
    });

    this.decrement.reduce((draft, value) => {
      draft.count -= value;
    });
  }
}
```

### 3. Use the store in your components

```TypeScript
import { Component, inject } from '@angular/core';
import { AppStore } from './app.store';

@Component({
  selector: 'app-root',
  template: `
    <button (click)="store.increment(1)">Increment</button>
    <button (click)="store.decrement(1)">Decrement</button>
    <p>Count: {{ store.count() }}</p>
  `,
})
export class AppComponent {
  store = inject(AppStore);
}
```

### 4. Enjoy reactive state management in your Angular application! 🎉

This is just a basic example to get you started. You don't need a store class: the store is a plain function, so you can also create it directly in a component.

## 📚 Deep Dive

### 📦 Store

The store is the central piece of ngx-signal-flow. It holds your state and provides methods to interact with it.

#### Creating a Store - createStore

To create a store, use the `createStore` function with the initial state as an argument. Calling the store returns the current state and tracks it like any other signal.

```TypeScript
import { createStore } from 'ngx-signal-flow';

const store = createStore<State>({ count: 0 });
store(); // { count: 0 }
```

Optional features are passed after the initial state. Features you don't use are left out of your bundle.

```TypeScript
import { createStore, withHistory, withMapSet } from 'ngx-signal-flow';

const store = createStore<State>({ count: 0, tags: new Set<string>() }, withHistory(), withMapSet());
```

For stores that only need snapshots, reducers, selectors, and computed values, use `createCoreStore`. It leaves RxJS, sources, effects, and history out of the consumer bundle.

```TypeScript
import { createCoreStore } from 'ngx-signal-flow';

const store = createCoreStore<State>({ count: 0 });
const count = store.select('count');

store.reduce((draft) => {
  draft.count++;
});
```

#### Store as Observable - asObservable

`store.asObservable()` emits the current state and every later change. Changes arrive in the order they happened, even when a subscriber changes the state while it is being notified. The observable is read-only; use `reduce` to change the state.

```TypeScript
store.asObservable().subscribe((state: State) => {
  // handle state changes
});
```

#### Selecting Store State - select

To read one key of the state, use `store.select` with the key as an argument. It returns a memoized Angular signal that you can use in templates, components and `computed`.

```TypeScript
const count = store.select('count');

// use
{{ count() }}
```

#### Computed Values - compute

To derive a value from one or more keys of the state, use `store.compute`. Pass the keys first and the function last; the function receives the values in the same order. The result is a signal that only recomputes when one of the keys changes.

```TypeScript
const doubleCount = store.compute('count', (count) => count * 2);
const fullName = store.compute('firstName', 'lastName', (firstName, lastName) => `${firstName} ${lastName}`);

// use
{{ doubleCount() }}
{{ fullName() }}
```

#### Modify Store State - reduce

To modify the state of the store, use `store.reduce` with an Immer recipe. A recipe that changes nothing does not notify anyone.

```TypeScript
store.reduce((draft) => {
  draft.count = draft.count + 1;
});
```

You can also reduce the latest values of several sources. The reducer runs once every source has emitted at least once, and again whenever one of them emits.

```TypeScript
store.reduce(source, (draft, value: number) => {
  draft.count = draft.count + value;
});

store.reduce(source1, source2, (draft, val1: number, val2: string) => {
  draft.count = draft.count + val1;
  draft.name = val2;
});
```

#### Observe State Changes - effect

To run code for the current state and after every change, pass a single function to `store.effect`. It returns an object with `destroy()`.

```TypeScript
const logger = store.effect((state: State) => {
  console.log('State changed:', state);
});

logger.destroy();
```

#### State History - undo, redo

To undo or redo state changes, create the store with the `withHistory()` feature. `canUndo` and `canRedo` are signals, so templates and `computed` values update on their own.

```TypeScript
import { createStore, withHistory } from 'ngx-signal-flow';

const store = createStore<State>({ count: 0 }, withHistory());
store.reduce((draft) => {
  draft.count = draft.count + 1;
});
// store().count === 1
store.canRedo(); // false
store.canUndo(); // true
store.undo();
// store().count === 0
store.canUndo(); // false
store.canRedo(); // true
store.redo();
// store().count === 1
```

The history keeps the last 100 changes by default. Use `limit` to change that, or `Infinity` to keep every change:

```TypeScript
const store = createStore<State>({ count: 0 }, withHistory({ limit: 20 }));
```

#### Map and Set State - withMapSet

Immer needs a plugin to update `Map` and `Set` values. Enable it with the `withMapSet()` feature, which works with both `createStore` and `createCoreStore`.

```TypeScript
import { createStore, withMapSet } from 'ngx-signal-flow';

const store = createStore({ selected: new Set<number>() }, withMapSet());
store.reduce((draft) => {
  draft.selected.add(1);
});
```

#### Teardown - destroy

`store.destroy()` stops every source, reducer and effect created through the store and completes its observable. Call it when the owner of the store is destroyed:

```TypeScript
@Injectable()
export class TodoStore {
  private readonly store = createStore<State>({ todos: [] });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.store.destroy());
  }
}
```

Stores provided in `root` usually live as long as the application and don't need this.

### 📡 Sources

Sources emit values into the store. Create them with `store.source`, and call a source like a function to emit a value.

```TypeScript
// no initial value
const source = store.source<number>();
// with initial value, which can also be null
const source = store.source(0);
// emit a value
source(1);
```

A source only accepts a call without a value if its type allows `undefined`, like `store.source<void>()` for plain triggers.

#### Connect a Signal or Input - connect

Use `source.connect` to forward an Angular `input()` or any other signal into an existing source.
`undefined` is skipped by default, so optional inputs can be wired without a manual `effect`. Pass `{skipUndefined: false}` to forward it for sources whose type includes `undefined`.
Values are forwarded asynchronously, the same way `toObservable` delivers them.
Call it in a constructor or another injection context, or pass an `injector`.

```TypeScript
value = input<number | undefined>(undefined);

constructor() {
  this.store.setCount.connect(this.value);
}
```

#### Modify Store State - reduce

To modify the state of the store, use the `source.reduce` method with a reducer function as an argument.
The emitted value is passed as an argument to the reducer function.

```TypeScript
const reducerSubscription = source.reduce((draft, value: number) => {
  draft.count = draft.count + value;
});

reducerSubscription.unsubscribe();
```

#### Perform Side Effects - effect

To perform side effects based on the values emitted by a source, use the `source.effect` method. The function must return an observable, and the effect subscribes to its source when it is created.

```TypeScript
const loadItem = source.effect((id: number) => {
  return http.get<Item>(`https://api.example.com/items/${id}`);
});
```

### 💥 Effects

Effects run side effects, like HTTP requests, for the values of one or more sources. When a new value arrives while a previous run is still in progress, the previous run is cancelled, like RxJS `switchMap`.

#### Reduce Effect Results - reduce

Use the `reduce` method of the effect to modify state with the values it produces. You can add more than one reducer. If the effect produced a result before the first reducer was attached, for example from a source with a start value, that result is passed to the first reducer.

```TypeScript
const loadItem = source.effect((id: number) => http.get<Item>(`/items/${id}`));

loadItem.reduce((draft, item) => {
  draft.item = item;
});
```

#### Combine Sources

You can combine any number of sources to create an effect that depends on all of them.

```TypeScript
const source1 = store.source<number>(0);
const source2 = store.source<string>('');

const search = store.effect(source1, source2, (value1, value2) => {
  return http.get(`https://api.example.com/${value1}/${value2}`);
});
```

#### Loading and Errors

- `effect.loading` is a signal that is true until the latest run produces a value, fails or completes.
- `effect.error` is a signal with the error of the latest failed run. It is cleared by the next successful result.
- Errors are also written to `state.error`. An effect only clears `state.error` when it wrote that error itself, so one effect's success does not hide another effect's failure.
- Errors that are not `Error` instances, like `HttpErrorResponse`, are wrapped in an `Error` whose `cause` is the original error.
- Call `effect.destroy()` or `source.destroy()` for effects you create dynamically, or `store.destroy()` to stop everything at once.

## ⬆️ Upgrading from 0.x

- Replace the options object with features: `{withPatches: true, historyLimit: 20}` becomes `withHistory({limit: 20})`, and `{withMapSet: true}` becomes `withMapSet()`. Passing the old object throws an error.
- The history keeps 100 changes unless you pass `withHistory({limit: Infinity})`.
- `canUndo` and `canRedo` are signals. Calls like `store.canUndo()` keep working.
- `store.effect(fn)` returns an object with `destroy()` only. Its `loading` and `reduce` never did anything.
- An effect no longer clears errors written by other effects or reducers.
- Calling a source without a value only compiles when its type accepts `undefined`, like `Source<T, void>`.
- RxJS 6 and RxJS 7 before 7.5.5 are no longer supported.

## 🛠️ Development

- `npm test` runs the library tests, and `npm run test:coverage` adds a coverage report.
- `npm run lint` and `npm run format:check` run ESLint and Prettier.
- `npm start` builds the library and serves the example app against the build.
- `npm run compatibility` installs the built library into a fresh project and type-checks and runs it. Pass versions like `-- --angular 19.0 --rxjs 7.5.5 --immer 10.1 --typescript 5.5`.
- `tools/system-npm` replaces the copy of npm that `@semantic-release/npm` would otherwise install with a shim that calls the npm bundled with Node. This keeps `npm audit` free of findings from that nested copy.

## Performance checks

Run `npm run performance` to build the library and report runtime probes, history timings, and minified and gzip bundle sizes. CI uses `npm run performance:check` to enforce deterministic behavior and bundle ceilings.

On every push to `main`, CI publishes the coverage and bundle size badges to the `badges` branch.

## 🚀 Releasing

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/) on GitHub Actions.

Merge conventional commits to `main`:

- `feat:` → minor (e.g. 1.0.0 → 1.1.0)
- `fix:` → patch (e.g. 1.1.0 → 1.1.1)
- `feat:` / `fix:` with a `BREAKING CHANGE:` footer → major. The Angular preset does not recognize `feat!:` headers.

CI tests, versions, publishes `ngx-signal-flow` to npm with provenance, updates `CHANGELOG.md`, and creates a GitHub Release.

## 📜 License

This project is licensed under the MIT License. See the LICENSE file for more details.

## 💬 Contact

For any questions or feedback, feel free to open an issue.
