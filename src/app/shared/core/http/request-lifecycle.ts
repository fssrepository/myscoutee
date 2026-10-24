import type { Observable } from 'rxjs';

export function requestWithAbort<T, E = never>(request$: Observable<T>, signal?: AbortSignal, onEmpty?: () => E): Promise<T | E> {
  return new Promise<T | E>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    let settled = false;
    let subscription: { unsubscribe: () => void } | null = null;
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const onAbort = () => {
      if (settled) {
        return;
      }
      settled = true;
      subscription?.unsubscribe();
      cleanup();
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    subscription = request$.subscribe({
      next: value => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      },
      error: error => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      },
      complete: () => {
        cleanup();
        if (!settled && onEmpty) {
          settled = true;
          resolve(onEmpty());
        }
      }
    });
  });
}

function createAbortError(): Error {
  const error = new Error('Request aborted.');
  error.name = 'AbortError';
  return error;
}
