import { Injectable, inject, signal } from '@angular/core';

import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import type {
  OperatorRegistryInspectRequestDto,
  OperatorRegistryInspectionDto,
  OperatorRegistryStatusDto
} from '../../../core/contracts/operator.interface';

export type OperatorRegistryBusyAction =
  | 'load'
  | 'inspect'
  | 'confirm'
  | 'retry'
  | 'disconnect'
  | null;

@Injectable({
  providedIn: 'root'
})
export class OperatorRegistryStore {
  private readonly service = inject(OperatorRegistryService);
  private readonly statusRef = signal<OperatorRegistryStatusDto | null>(null);
  private readonly inspectionRef = signal<OperatorRegistryInspectionDto | null>(null);
  private readonly busyActionRef = signal<OperatorRegistryBusyAction>(null);
  private readonly errorRef = signal('');
  private readonly noticeRef = signal('');
  private requestGeneration = 0;

  readonly status = this.statusRef.asReadonly();
  readonly inspection = this.inspectionRef.asReadonly();
  readonly busyAction = this.busyActionRef.asReadonly();
  readonly error = this.errorRef.asReadonly();
  readonly notice = this.noticeRef.asReadonly();

  async loadStatus(): Promise<OperatorRegistryStatusDto | null> {
    return await this.run('load', () => this.service.loadStatus());
  }

  async inspect(request: OperatorRegistryInspectRequestDto): Promise<OperatorRegistryInspectionDto | null> {
    this.inspectionRef.set(null);
    const inspection = await this.run('inspect', () => this.service.inspect(request));
    if (inspection) {
      this.inspectionRef.set(inspection);
    }
    return inspection;
  }

  async confirm(): Promise<OperatorRegistryStatusDto | null> {
    const inspectionToken = this.inspectionRef()?.inspectionToken.trim() ?? '';
    if (!inspectionToken) {
      this.errorRef.set('Inspect the registry identity again before confirming.');
      return null;
    }
    const status = await this.run('confirm', () => this.service.confirm(inspectionToken));
    if (status) {
      this.inspectionRef.set(null);
    }
    return status;
  }

  async retry(): Promise<OperatorRegistryStatusDto | null> {
    return await this.run('retry', () => this.service.retry());
  }

  async disconnect(): Promise<OperatorRegistryStatusDto | null> {
    const status = await this.run('disconnect', () => this.service.disconnect());
    if (status) {
      this.inspectionRef.set(null);
    }
    return status;
  }

  clearInspection(): void {
    this.inspectionRef.set(null);
  }

  setError(message: string): void {
    this.errorRef.set(message.trim());
  }

  setNotice(message: string): void {
    this.noticeRef.set(message.trim());
  }

  clearFeedback(): void {
    this.errorRef.set('');
    this.noticeRef.set('');
  }

  reset(): void {
    this.requestGeneration += 1;
    this.statusRef.set(null);
    this.inspectionRef.set(null);
    this.busyActionRef.set(null);
    this.clearFeedback();
  }

  private async run<T extends OperatorRegistryStatusDto | OperatorRegistryInspectionDto>(
    action: Exclude<OperatorRegistryBusyAction, null>,
    request: () => Promise<T>
  ): Promise<T | null> {
    const requestGeneration = ++this.requestGeneration;
    this.busyActionRef.set(action);
    this.clearFeedback();
    try {
      const result = await request();
      if (requestGeneration !== this.requestGeneration) {
        return null;
      }
      if (isStatus(result)) {
        this.statusRef.set(result);
      }
      return result;
    } catch (error) {
      if (requestGeneration === this.requestGeneration) {
        this.errorRef.set(messageFromError(error, fallbackForAction(action)));
      }
      return null;
    } finally {
      if (requestGeneration === this.requestGeneration) {
        this.busyActionRef.set(null);
      }
    }
  }
}

function isStatus(
  value: OperatorRegistryStatusDto | OperatorRegistryInspectionDto
): value is OperatorRegistryStatusDto {
  return 'lifecycle' in value;
}

function fallbackForAction(action: Exclude<OperatorRegistryBusyAction, null>): string {
  switch (action) {
    case 'load':
      return 'Unable to load the operator registry state.';
    case 'inspect':
      return 'Registry inspection failed.';
    case 'confirm':
      return 'Deployment registration failed.';
    case 'retry':
      return 'Registry retry failed.';
    case 'disconnect':
      return 'Unable to disable the registry connection.';
  }
}

function messageFromError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const source = error as {
      error?: { message?: unknown; detail?: unknown };
      message?: unknown;
      name?: unknown;
    };
    const serverMessage = typeof source.error?.message === 'string'
      ? source.error.message.trim()
      : typeof source.error?.detail === 'string'
        ? source.error.detail.trim()
        : '';
    if (serverMessage) {
      return serverMessage;
    }
    if (source.name === 'TimeoutError') {
      return 'The registry operation timed out. No browser secret was created; retry is safe.';
    }
    if (typeof source.message === 'string' && source.message.trim()) {
      return source.message.trim();
    }
  }
  return fallback;
}

