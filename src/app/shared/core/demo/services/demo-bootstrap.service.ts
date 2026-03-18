import { Injectable, inject } from '@angular/core';

import { DemoActivityMembersRepository } from '../repositories/activity-members.repository';
import { DemoChatsRepository } from '../repositories/chats.repository';
import { DemoEventsRepository } from '../repositories/events.repository';
import { DemoUsersRatingsRepository } from '../repositories/users-ratings.repository';
import { DemoUsersRepository } from '../repositories/users.repository';

export interface DemoBootstrapProgressState {
  percent: number;
  label: string;
}

type DemoBootstrapProgressListener = (state: DemoBootstrapProgressState) => void;

@Injectable({
  providedIn: 'root'
})
export class DemoBootstrapService {
  private readonly chatsRepository = inject(DemoChatsRepository);
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly activityMembersRepository = inject(DemoActivityMembersRepository);

  private bootstrapPromise: Promise<void> | null = null;
  private ready = false;
  private lastProgress: DemoBootstrapProgressState = {
    percent: 0,
    label: 'Preparing demo data'
  };
  private readonly listeners = new Set<DemoBootstrapProgressListener>();

  async ensureReady(onProgress?: DemoBootstrapProgressListener): Promise<void> {
    if (onProgress) {
      this.listeners.add(onProgress);
      onProgress(this.lastProgress);
    }

    if (this.ready) {
      this.emitProgress({
        percent: 100,
        label: 'Demo data ready'
      });
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
      return;
    }

    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.runBootstrap().finally(() => {
        this.bootstrapPromise = null;
      });
    }

    try {
      await this.bootstrapPromise;
    } finally {
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
    }
  }

  private async runBootstrap(): Promise<void> {
    if (this.ready) {
      this.emitProgress({
        percent: 100,
        label: 'Demo data ready'
      });
      return;
    }

    this.emitProgress({
      percent: 0,
      label: 'Preparing demo selector'
    });
    await this.waitForUiYield();

    this.emitProgress({
      percent: 16,
      label: 'Loading chats'
    });
    this.chatsRepository.init();
    await this.waitForUiYield();

    this.emitProgress({
      percent: 36,
      label: 'Loading events'
    });
    this.eventsRepository.init();
    await this.waitForUiYield();

    this.emitProgress({
      percent: 56,
      label: 'Loading ratings'
    });
    this.usersRatingsRepository.init();
    await this.waitForUiYield();

    this.emitProgress({
      percent: 78,
      label: 'Preparing demo users'
    });
    this.usersRepository.init();
    await this.waitForUiYield();

    this.emitProgress({
      percent: 92,
      label: 'Preparing activity members'
    });
    this.activityMembersRepository.init();
    await this.waitForUiYield();

    this.ready = true;
    this.emitProgress({
      percent: 100,
      label: 'Demo data ready'
    });
  }

  private emitProgress(state: DemoBootstrapProgressState): void {
    this.lastProgress = {
      percent: Math.max(0, Math.min(100, Math.round(state.percent))),
      label: state.label.trim() || 'Preparing demo data'
    };

    for (const listener of this.listeners) {
      listener(this.lastProgress);
    }
  }

  private waitForUiYield(): Promise<void> {
    return new Promise(resolve => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
        return;
      }
      setTimeout(resolve, 0);
    });
  }
}
