import { resolveRouteConfig } from '../config';

export abstract class DemoRouteDelayService {
  protected async waitForRouteDelay(
    route: string,
    signal?: AbortSignal,
    abortMessage = 'Request aborted.'
  ): Promise<void> {
    const delayMs = resolveRouteConfig(route).demoDelayMs;
    if (delayMs <= 0) {
      return;
    }
    await this.waitForDelay(delayMs, signal, abortMessage);
  }

  protected waitForDelay(
    delayMs: number,
    signal?: AbortSignal,
    abortMessage = 'Request aborted.'
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.createAbortError(abortMessage));
        return;
      }
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, delayMs);
      const onAbort = () => {
        cleanup();
        reject(this.createAbortError(abortMessage));
      };
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  protected createAbortError(message = 'Request aborted.'): Error {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
  }
}
