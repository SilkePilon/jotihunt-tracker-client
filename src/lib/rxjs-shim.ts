/**
 * Minimal stand-in for `rxjs`, aliased in vite.config.ts. react-auth-kit only uses one BehaviorSubject
 * (RxTokenObject.js): `new BehaviorSubject(value)`, `.subscribe({ next, error, complete })`, `.next(value)` and
 * `.value`. Bundling the real rxjs for that costs ~30 KB gzip in the entry chunk.
 *
 * Semantics kept from rxjs 7: subscribing calls `next` synchronously with the current value, `next()` updates the
 * value before notifying, observers run in subscription order (a snapshot, so (un)subscribing during a
 * notification doesn't affect it), and an observer that throws doesn't stop the others (the error is rethrown
 * asynchronously, like rxjs' reportUnhandledError).
 */

type Observer<T> = {
  next?: ((value: T) => void) | null;
  error?: ((err: unknown) => void) | null;
  complete?: (() => void) | null;
};

export type Subscription = { closed: boolean; unsubscribe: () => void };

function reportUnhandled(err: unknown) {
  setTimeout(() => {
    throw err;
  });
}

export class BehaviorSubject<T> {
  private current: T;
  private observers: Observer<T>[] = [];

  constructor(initialValue: T) {
    this.current = initialValue;
  }

  get value(): T {
    return this.current;
  }

  getValue(): T {
    return this.current;
  }

  next(value: T): void {
    this.current = value;
    for (const observer of this.observers.slice()) {
      try {
        observer.next?.(value);
      } catch (err) {
        reportUnhandled(err);
      }
    }
  }

  subscribe(observerOrNext?: Observer<T> | ((value: T) => void) | null): Subscription {
    const observer: Observer<T> = typeof observerOrNext === 'function' ? { next: observerOrNext } : (observerOrNext ?? {});
    this.observers.push(observer);
    const subscription: Subscription = {
      closed: false,
      unsubscribe: () => {
        if (subscription.closed) return;
        subscription.closed = true;
        this.observers = this.observers.filter((o) => o !== observer);
      },
    };
    try {
      observer.next?.(this.current);
    } catch (err) {
      reportUnhandled(err);
    }
    return subscription;
  }
}
