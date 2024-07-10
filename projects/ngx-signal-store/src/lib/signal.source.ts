import {BaseState, SignalStore} from "./signal.store";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {Effect} from "./signal.effect";

export class Source<T, S> {
  private source: Subject<S>;

  constructor(
    private store: SignalStore<T>,
    private startValue?: S,
  ) {
    if (startValue) {
      this.source = new BehaviorSubject<S>(startValue);
    } else {
      this.source = new Subject<S>();
    }
  }

  effect<R>(effectFn: (value: S) => Observable<R>): Effect<T, S, R> {
    return new Effect(this.store, this, effectFn);
  }

  reduce(fn: (draft: T, value: S) => void) {
    this.source.subscribe((value: S) => {
      this.store.reduce((draft: T) => fn(draft, value));
    });
  }

  asObservable(): Observable<S> {
    return this.source.asObservable();
  }

  next(value: S) {
    this.source.next(value);
  }
}
