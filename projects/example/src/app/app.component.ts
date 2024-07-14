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
