import {signal} from "@angular/core";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {BaseState, SignalStore} from "./signal.store";
import {Source} from "./signal.source";

export class Effect<S, T, R> {
  private _loading = signal(false);
  loading = this._loading.asReadonly();

  constructor(
    private store: SignalStore<S>,
    private source: Source<S, T>,
    private effectFn: (value: T) => Observable<R>
  ) {}

  reduce(fn: (draft: S, value: R) => void): void {
    this.source.asObservable().subscribe((value: T) => {
      this.effectFn(value)
        .pipe(tap(() => this._loading.set(true)))
        .subscribe({
          next: (result: R) => {
            this.store.reduce((draft: S) => fn(draft, result));
            this.store.reduce((draft: BaseState<S>) => {
              draft.error = undefined;
            });
            this._loading.set(false);
          },
          error: (error: Error) => {
            this.store.reduce((draft) => {
              draft.error = error;
            });
            this._loading.set(false);
          }
        });
    });
  }
}
