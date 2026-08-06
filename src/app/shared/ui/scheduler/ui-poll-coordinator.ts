import { Injectable, effect, inject } from '@angular/core';

import { PopupPresenceStore } from '../context/stores/popup-presence.store';

export type UiPollPriority = 'background' | 'foreground';

export interface UiPollTaskContext {
  signal?: AbortSignal;
}

interface QueuedPollTask {
  id: number;
  priority: UiPollPriority;
  controller: AbortController | null;
  task: (context: UiPollTaskContext) => void | Promise<void>;
  resolve: () => void;
  unbindExternalAbort: () => void;
}

@Injectable({ providedIn: 'root' })
export class UiPollCoordinator {
  private readonly popupPresenceStore = inject(PopupPresenceStore);
  private readonly queue: QueuedPollTask[] = [];
  private activeTask: QueuedPollTask | null = null;
  private nextTaskId = 0;

  constructor() {
    effect(() => {
      if (!this.popupPresenceStore.visible()) {
        return;
      }
      this.cancelQueuedBackgroundTasks();
      if (this.activeTask?.priority === 'background') {
        this.activeTask.controller?.abort();
      }
    });
  }

  run(
    priority: UiPollPriority,
    task: (context: UiPollTaskContext) => void | Promise<void>,
    externalSignal?: AbortSignal
  ): Promise<void> {
    if (externalSignal?.aborted || (priority === 'background' && this.popupPresenceStore.visible())) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      const controller = typeof AbortController === 'undefined' ? null : new AbortController();
      const queuedTask: QueuedPollTask = {
        id: ++this.nextTaskId,
        priority,
        controller,
        task,
        resolve,
        unbindExternalAbort: () => undefined
      };
      queuedTask.unbindExternalAbort = this.bindExternalAbort(queuedTask, externalSignal);
      this.queue.push(queuedTask);
      this.sortQueue();
      this.drain();
    });
  }

  private drain(): void {
    if (this.activeTask) {
      return;
    }
    const nextTask = this.nextRunnableTask();
    if (!nextTask) {
      return;
    }
    this.activeTask = nextTask;
    void this.execute(nextTask);
  }

  private async execute(task: QueuedPollTask): Promise<void> {
    try {
      if (!task.controller?.signal.aborted) {
        await task.task({ signal: task.controller?.signal });
      }
    } catch {
      // Polling is background synchronization; retain the last stable UI state.
    } finally {
      task.unbindExternalAbort();
      if (this.activeTask?.id === task.id) {
        this.activeTask = null;
      }
      task.resolve();
      this.drain();
    }
  }

  private nextRunnableTask(): QueuedPollTask | null {
    while (this.queue.length > 0) {
      const candidate = this.queue.shift() ?? null;
      if (!candidate) {
        return null;
      }
      if (candidate.controller?.signal.aborted) {
        candidate.unbindExternalAbort();
        candidate.resolve();
        continue;
      }
      if (candidate.priority === 'background' && this.popupPresenceStore.visible()) {
        candidate.controller?.abort();
        candidate.unbindExternalAbort();
        candidate.resolve();
        continue;
      }
      return candidate;
    }
    return null;
  }

  private cancelQueuedBackgroundTasks(): void {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const task = this.queue[index];
      if (task.priority !== 'background') {
        continue;
      }
      this.queue.splice(index, 1);
      task.controller?.abort();
      task.unbindExternalAbort();
      task.resolve();
    }
  }

  private bindExternalAbort(task: QueuedPollTask, externalSignal?: AbortSignal): () => void {
    if (!externalSignal) {
      return () => undefined;
    }
    const abort = () => {
      task.controller?.abort();
      if (this.activeTask?.id === task.id) {
        return;
      }
      const index = this.queue.findIndex(candidate => candidate.id === task.id);
      if (index >= 0) {
        this.queue.splice(index, 1);
      }
      task.unbindExternalAbort();
      task.resolve();
    };
    externalSignal.addEventListener('abort', abort, { once: true });
    return () => externalSignal.removeEventListener('abort', abort);
  }

  private sortQueue(): void {
    this.queue.sort((left, right) => {
      if (left.priority === right.priority) {
        return left.id - right.id;
      }
      return left.priority === 'foreground' ? -1 : 1;
    });
  }
}
