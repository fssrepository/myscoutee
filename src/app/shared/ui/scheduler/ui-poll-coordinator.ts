import { Injectable, effect, inject } from '@angular/core';

import { PopupPresenceStore } from '../context/stores/popup-presence.store';

export type UiPollPriority = 'background' | 'foreground' | 'notification';

type UiPollLane = 'ui' | 'notification';

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
  private readonly activeTasks = new Map<UiPollLane, QueuedPollTask>();
  private nextTaskId = 0;

  constructor() {
    effect(() => {
      if (!this.popupPresenceStore.visible()) {
        return;
      }
      this.cancelQueuedBackgroundTasks();
      const activeUiTask = this.activeTasks.get('ui');
      if (activeUiTask?.priority === 'background') {
        activeUiTask.controller?.abort();
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
    this.drainLane('notification');
    this.drainLane('ui');
  }

  private drainLane(lane: UiPollLane): void {
    if (this.activeTasks.has(lane)) {
      return;
    }
    const nextTask = this.nextRunnableTask(lane);
    if (!nextTask) {
      return;
    }
    this.activeTasks.set(lane, nextTask);
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
      const lane = this.lane(task.priority);
      if (this.activeTasks.get(lane)?.id === task.id) {
        this.activeTasks.delete(lane);
      }
      task.resolve();
      this.drain();
    }
  }

  private nextRunnableTask(lane: UiPollLane): QueuedPollTask | null {
    while (true) {
      const candidateIndex = this.queue.findIndex(candidate => this.lane(candidate.priority) === lane);
      if (candidateIndex < 0) {
        return null;
      }
      const [candidate] = this.queue.splice(candidateIndex, 1);
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
      if (this.activeTasks.get(this.lane(task.priority))?.id === task.id) {
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
      if (left.priority === 'notification') {
        return -1;
      }
      if (right.priority === 'notification') {
        return 1;
      }
      return left.priority === 'foreground' ? -1 : 1;
    });
  }

  private lane(priority: UiPollPriority): UiPollLane {
    return priority === 'notification' ? 'notification' : 'ui';
  }
}
