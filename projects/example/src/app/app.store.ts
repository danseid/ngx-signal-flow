
import { Injectable } from '@angular/core';
import {createStore} from "ngx-signal-flow";

type AppState = {
   count: number;
}

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
