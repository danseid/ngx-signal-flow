# 🚀 ngx-signal-flow

Welcome to ngx-signal-flow, a powerful state management library for Angular applications! 🌟

## 📖 Overview

ngx-signal-flow is a lightweight and efficient state management library designed to simplify state handling in your Angular applications. It leverages RxJS and Angular’s reactive programming capabilities to provide a seamless and scalable solution for managing your application’s state.

### ✨ Features

- 🔄 Reactive state management
- 🛠️ Easy integration with Angular signals
- ✏️ Using [Immer](https://immerjs.github.io/immer/) for state mutation
- 🔒 Type-safe state management
- 📦 Minimal boilerplate code
- ⚡ High performance with RxJS
- ✅ Comprehensive unit tests

## 📦 Installation

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
import { createStore } from "ngx-signal-flow";

@Injectable({
   providedIn: 'root'
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
      this.increment.reduce((draft: AppState, value: number) => {
         draft.count += value;
      });

      this.decrement.reduce((draft: AppState, value: number) => {
         draft.count -= value;
      });
   }
}
```

### 3. Use the store in your components
```TypeScript
import {Component, inject} from '@angular/core';
import {AppStore} from './app.store';


@Component({
   selector: 'app-root',
   standalone: true,
   template: `
       <button (click)="store.increment(1)">Increment</button>
       <button (click)="store.decrement(1)">Decrement</button>
       <p>Count: {{ store.count() }}</p>
   `
})
export class AppComponent {
   store = inject(AppStore);
}
```

### 4. Enjoy reactive state management in your Angular application! 🎉

This is just a basic example to get you started. You don't need to use a store class, you can als use the store directly in your components, 
because it's functional no need to extend a class.


## 📚 Deep Dive

### 📦 Store

The store is the central piece of ngx-signal-flow. It holds your state and provides methods to interact with it. 
#### Creating a Store - createStore
To create a store, use the `createStore` function with initial state as an argument.
```TypeScript
import { createStore } from "ngx-signal-flow";

const store = createStore<State>({ count: 0 });
```

#### Store as Observable
The store is an observable that emits the state whenever it changes. You can subscribe to the store to get the state.
```TypeScript
store.asObservable().subscribe((state: State) => {
  // handle state changes
});
```
#### Selecting Store State - select
To access the state of the store, use the `store.select` method with the key of the state as an argument.
It returns an angular signal, that can be used in the template or in the component.
```TypeScript
const count = store.select('count');

// use
{{ count() }}
```

#### Selectin Store State - compute 
To compute a value from the state of the store, use the `store.compute`. It takes a function that computes the value from the state as an argument.
It returns an angular signal, that can be used in the template or in the component.
You can also use multiple state values to compute a value.
```TypeScript
const doubleCount = store.compute('count', (count: number) => count * 2);
const fullName = store.compute('firstName', 'lastName', (firstName: string, lastName: string) => `${firstName} ${lastName}`);

// use
{{ doubleCount() }}
{{ fullName() }}
```

#### Modify Store State - reduce
To modify the state of the store, use the `store.reduce` method with a reducer function as an argument.
```TypeScript
store.reduce((draft: State) => {
  draft.count  = draft.count + 1;
});
```
You call also use sources to modify the state

```TypeScript
store.reduce(source, (draft: State, value: number) => {
   draft.count = draft.count + value;
});

store.reduce(source1, source2, (draft: State, val1: number, val2: string) => {
   draft.count = draft.count + val1;
   draft.name = val2;
});
```

#### Perform Side Effects - effect
To perform side effects based on the state of the store, use the `store.effect` method with an effect function as an argument.
It is not like other effects, it will be executed every time the state changes.
```TypeScript
store.effect((state: State) => {
  return http.get(`https://api.example.com/${state.count}`);
});
```

#### State History - undo, redo
To undo or redo state changes, use the `store.undo` and `store.redo` methods.
First initialize the store with the `createStore` function with the `withPatches` option set to `true`. Use the `store.undo` and `store.redo` methods to undo or redo state changes.
```TypeScript
const store = createStore<State>({ count: 0 }, { withPatches: true });
store.reduce((draft: State) => {
  draft.count  = draft.count + 1;
});
// store.count === 1
store.canRedo(); // false
store.canUndo(); // true
store.undo();
// store.count === 0
store.canUndo(); // false
store.canRedo(); // true
store.redo();
// store.count === 1
store.canRedo(); // false
store.canUndo(); // true
```

### 📡 Sources

Sources are signals that emit values to the store. Sources are created using the `store.source` method.
To emit a value, you can call the source as a function with the value as an argument.

```TypeScript
// no initial value
const source = store.source<number>()
// with initial value
const source = store.source(0)
// emit a value
source(1)
```
#### Modify Store State - reduce
To modify the state of the store, use the `source.reduce` method with a reducer function as an argument.
The emitted value is passed as an argument to the reducer function.
```TypeScript
source.reduce((draft: State, value: number) => {
  draft.count  = draft.count + value;
});
```
#### Perform Side Effects - effect
To perform side effects based on the values emitted by sources, use the `source.effect` method with an effect function as an argument.
It must return an observable. Effect is lazy, it will only be executed when you actually use it to reduce the state.
```TypeScript
source.effect((value: number) => {
  return http.get(`https://api.example.com/${value}`);
});
```

### 💥 Effects

Effects are functions that perform side effects based on the values emitted by sources. They are used to interact with external services, such as APIs or databases. Effects are defined using the `source.effect` method.
To create an effect, see the example above.

#### Perform Side Effects - reduce
Since effects are lazy, you can use the `effect.reduce` method to subscribe to the effect and modify the state based on the data received from the effect.
```TypeScript
source.effect.reduce((draft: State, data: any) => {
  // modify state based on the data received from the effect
});
```

#### Perform Side Effects - combine Sources
You can combine multiple sources to create an effect that depends on multiple sources.
```TypeScript
const source1 = store.source<number>(0);
const source2 = store.source<string>('');

store.effect(source1, source2, (value1, value2) => {
  return http.get(`https://api.example.com/${value1}/${value2}`);
});
```

#### Convenience State Parameters
- loading: effect.loading - returns a boolean signal that indicates whether the effect is currently running
- error: if error occurs, it will be written to state.error


 
## 📜 License

This project is licensed under the MIT License. See the LICENSE file for more details.

## 💬 Contact

For any questions or feedback, feel free to open an issue.
