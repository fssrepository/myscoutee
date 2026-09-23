import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiTaskScheduler } from './ui-task-scheduler';

describe('initial realtime hydration scheduling', () => {
  afterEach(() => vi.useRealTimers());

  it('loads immediately when requested, then uses the normal polling interval', async () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const scheduler = new UiTaskScheduler({ intervalMs: () => 30_000, state: () => 'viewer', task });
    scheduler.restart({ immediate: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    scheduler.destroy();
  });

  it('keeps delayed startup as the default and cancels pending immediate work on destroy', async () => {
    vi.useFakeTimers();
    const task = vi.fn();
    const scheduler = new UiTaskScheduler({ intervalMs: () => 30_000, state: () => 'viewer', task });
    scheduler.restart();
    await vi.advanceTimersByTimeAsync(0);
    expect(task).not.toHaveBeenCalled();
    scheduler.restart({ immediate: true });
    scheduler.destroy();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(task).not.toHaveBeenCalled();
  });
});
