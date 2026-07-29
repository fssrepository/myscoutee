import { Injectable, computed, inject, signal } from '@angular/core';

import {
  GlobalIdentityService
} from '../../../core/base/services/global-identity.service';
import type {
  GlobalIdentityStatusDto
} from '../../../core/contracts/global-identity.interface';
import { UserProfileStore } from './user-profile.store';

export type GlobalIdentityBusyAction =
  | 'load'
  | 'link'
  | 'rotate'
  | 'unlink';

@Injectable({
  providedIn: 'root'
})
export class GlobalIdentityStore {
  private readonly service = inject(GlobalIdentityService);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly statusRef = signal<GlobalIdentityStatusDto | null>(null);
  private readonly busyActionRef = signal<GlobalIdentityBusyAction | null>(null);
  private readonly errorRef = signal('');
  private operationVersion = 0;

  readonly status = this.statusRef.asReadonly();
  readonly busyAction = this.busyActionRef.asReadonly();
  readonly error = this.errorRef.asReadonly();
  readonly loading = computed(() => this.busyActionRef() === 'load');
  readonly busy = computed(() => this.busyActionRef() !== null);

  async load(): Promise<void> {
    await this.run('load', () => this.service.loadStatus());
  }

  async link(): Promise<void> {
    await this.run('link', () => this.service.link({ accepted: true }));
  }

  async rotate(): Promise<void> {
    await this.run('rotate', () => this.service.rotate());
  }

  async unlink(): Promise<void> {
    await this.run('unlink', () => this.service.unlink({ confirmed: true }));
  }

  clear(): void {
    this.operationVersion++;
    this.statusRef.set(null);
    this.busyActionRef.set(null);
    this.errorRef.set('');
  }

  private async run(
    action: GlobalIdentityBusyAction,
    operation: () => Promise<GlobalIdentityStatusDto>
  ): Promise<void> {
    if (this.busyActionRef() !== null) {
      return;
    }
    const activeUserId = this.userProfileStore.getActiveUserId().trim();
    const operationVersion = ++this.operationVersion;
    this.busyActionRef.set(action);
    this.errorRef.set('');
    try {
      const status = await operation();
      if (!this.isCurrent(operationVersion, activeUserId)) {
        return;
      }
      this.statusRef.set(this.cloneStatus(status));
    } catch (error) {
      if (!this.isCurrent(operationVersion, activeUserId)) {
        return;
      }
      this.errorRef.set(this.errorKey(error));
    } finally {
      if (this.isCurrent(operationVersion, activeUserId)) {
        this.busyActionRef.set(null);
      }
    }
  }

  private isCurrent(
    operationVersion: number,
    activeUserId: string
  ): boolean {
    return operationVersion === this.operationVersion
      && activeUserId === this.userProfileStore.getActiveUserId().trim();
  }

  private errorKey(error: unknown): string {
    const record = this.record(error);
    const status = Number(record['status']);
    const message = `${record['message'] ?? ''}`.trim();
    if (message.startsWith('global.identity.error.')) {
      return message;
    }
    if (status === 401 || status === 403) {
      return 'global.identity.error.verified.email';
    }
    if (status === 409) {
      return 'global.identity.error.conflict';
    }
    if (status === 408 || message === 'global.identity.error.timeout') {
      return 'global.identity.error.timeout';
    }
    if (status === 503) {
      return 'global.identity.error.unavailable';
    }
    return 'global.identity.error.failed';
  }

  private record(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null
      ? value as Record<string, unknown>
      : {};
  }

  private cloneStatus(
    status: GlobalIdentityStatusDto
  ): GlobalIdentityStatusDto {
    return { ...status };
  }
}
