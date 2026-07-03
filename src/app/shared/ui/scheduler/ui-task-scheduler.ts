export interface UiScheduledTaskContext<TState> {
  state: TState;
  signal?: AbortSignal;
}

export interface UiTaskSchedulerConfig<TState> {
  intervalMs: () => number;
  state: () => TState;
  task: (context: UiScheduledTaskContext<TState>) => void | Promise<void>;
}

export class UiTaskScheduler<TState> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;
  private inFlight = false;
  private destroyed = false;
  private lastPositiveIntervalMs = 0;

  constructor(private readonly config: UiTaskSchedulerConfig<TState>) {}

  restart(): void {
    if (this.destroyed) {
      return;
    }
    this.clearTimer();
    this.scheduleNext();
  }

  stop(options: { abort?: boolean } = {}): void {
    this.clearTimer();
    if (options.abort === true) {
      this.abortController?.abort();
      this.abortController = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop({ abort: true });
  }

  private async run(): Promise<void> {
    this.timer = null;
    if (this.destroyed) {
      return;
    }

    const intervalMs = this.normalizedIntervalMs();
    if (intervalMs > 0 && !this.inFlight) {
      const abortController = typeof AbortController === 'undefined'
        ? null
        : new AbortController();
      this.abortController = abortController;
      this.inFlight = true;
      try {
        await this.config.task({
          state: this.config.state(),
          signal: abortController?.signal
        });
      } catch {
        // Scheduled work is background-only; keep the current UI state on failure.
      } finally {
        if (this.abortController === abortController) {
          this.abortController = null;
        }
        this.inFlight = false;
      }
    }

    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.destroyed || this.timer) {
      return;
    }
    const intervalMs = this.normalizedIntervalMs();
    if (intervalMs > 0) {
      this.lastPositiveIntervalMs = intervalMs;
    }
    const delayMs = intervalMs > 0 ? intervalMs : this.lastPositiveIntervalMs;
    if (delayMs <= 0) {
      return;
    }
    this.timer = setTimeout(() => {
      void this.run();
    }, delayMs);
  }

  private clearTimer(): void {
    if (!this.timer) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = null;
  }

  private normalizedIntervalMs(): number {
    return Math.max(0, Math.trunc(Number(this.config.intervalMs()) || 0));
  }
}
