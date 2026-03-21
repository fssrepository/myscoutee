import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../base/db';
import { DemoActivityMembersRepository } from '../repositories/activity-members.repository';
import { DemoActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { DemoAssetsRepository } from '../repositories/assets.repository';
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
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly chatsRepository = inject(DemoChatsRepository);
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly activityMembersRepository = inject(DemoActivityMembersRepository);
  private readonly assetsRepository = inject(DemoAssetsRepository);
  private readonly activityResourcesRepository = inject(DemoActivityResourcesRepository);

  private bootstrapPromise: Promise<void> | null = null;
  private ready = false;
  private readonly readyUserIds = new Set<string>();
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

  async ensureUserReady(userId: string, onProgress?: DemoBootstrapProgressListener): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      onProgress?.({
        percent: 100,
        label: 'Demo session ready'
      });
      return;
    }

    await this.ensureReady();

    if (this.readyUserIds.has(normalizedUserId)) {
      onProgress?.({
        percent: 100,
        label: 'Demo session ready'
      });
      return;
    }

    onProgress?.({
      percent: 0,
      label: 'Preparing demo session'
    });
    await this.waitForUiYield();

    this.readyUserIds.add(normalizedUserId);
    onProgress?.({
      percent: 100,
      label: 'Demo session ready'
    });
  }

  private async runBootstrap(): Promise<void> {
    if (this.ready) {
      this.emitProgress({
        percent: 100,
        label: 'Demo data ready'
      });
      return;
    }

    await this.runBootstrapStep(0, 'Preparing demo selector');
    await this.runBootstrapStep(16, 'Loading chats', () => this.chatsRepository.init());
    await this.runBootstrapStep(36, 'Loading events', () => this.eventsRepository.init());
    await this.runBootstrapStep(52, 'Preparing demo users', () => { this.usersRepository.init(); });
    await this.runBootstrapStep(64, 'Loading ratings', () => this.usersRatingsRepository.init());
    await this.runBootstrapStep(76, 'Preparing owned assets', () => this.assetsRepository.init());
    await this.runBootstrapStep(86, 'Preparing activity members', () => this.activityMembersRepository.init());
    await this.runBootstrapStep(94, 'Preparing activity resources', () => this.activityResourcesRepository.init());
    await this.runBootstrapStep(100, 'Syncing demo IndexedDB', () => this.memoryDb.flushToIndexedDb());

    this.ready = true;
    this.emitProgress({
      percent: 100,
      label: 'Demo data ready'
    });
  }

  private async runBootstrapStep(
    percent: number,
    label: string,
    work?: () => void | Promise<void>
  ): Promise<void> {
    this.emitProgress({ percent, label });
    await this.waitForUiYield();
    if (work) {
      await work();
      await this.waitForUiYield();
    }
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
        window.requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(resolve, 0);
    });
  }
}
