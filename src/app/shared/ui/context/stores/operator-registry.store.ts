import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import {
  OperatorRegistryService,
  type OperatorRegistryDataSource
} from '../../../core/base/services/operator-registry.service';
import {
  SessionService,
  type AppSession
} from '../../../core/base/services/session.service';
import type {
  OperatorRegistryInspectRequestDto,
  OperatorRegistryInspectionDto,
  OperatorRegistryMutationResultDto,
  OperatorRegistryOptionDto,
  OperatorRegistryStatusDto
} from '../../../core/contracts/operator.interface';
import { normalizeOperatorRegistryBaseUrl } from '../../../core/base/operator-registry-candidate';
import { OperatorLeaderboardStore } from './operator-leaderboard.store';

export type OperatorRegistryBusyAction =
  | 'load'
  | 'inspect'
  | 'confirm'
  | 'register'
  | 'retry'
  | 'disconnect'
  | null;

@Injectable({
  providedIn: 'root'
})
export class OperatorRegistryStore {
  private readonly service = inject(OperatorRegistryService);
  private readonly sessionService = inject(SessionService);
  private readonly leaderboard = inject(OperatorLeaderboardStore);
  private readonly statusRef = signal<OperatorRegistryStatusDto | null>(null);
  private readonly inspectionRef = signal<OperatorRegistryInspectionDto | null>(null);
  private readonly busyActionRef = signal<OperatorRegistryBusyAction>(null);
  private readonly errorRef = signal('');
  private readonly noticeRef = signal('');
  private readonly registryBaseUrlRef = signal('');
  private readonly expectedRegistryScopeRef = signal('');
  private candidateInitialized = false;
  private requestGeneration = 0;
  private boundContextKey = this.currentContextKey();

  readonly status = this.statusRef.asReadonly();
  readonly inspection = this.inspectionRef.asReadonly();
  readonly busyAction = this.busyActionRef.asReadonly();
  readonly error = this.errorRef.asReadonly();
  readonly notice = this.noticeRef.asReadonly();
  readonly registryBaseUrl = this.registryBaseUrlRef.asReadonly();
  readonly expectedRegistryScope = this.expectedRegistryScopeRef.asReadonly();
  readonly registryOptions = computed<readonly OperatorRegistryOptionDto[]>(
    () => this.statusRef()?.registryOptions ?? []
  );
  readonly canInspect = computed(() => {
    const status = this.statusRef();
    return this.busyActionRef() === null
      && Boolean(this.registryBaseUrlRef().trim())
      && !(status?.enabled && status.lifecycle === 'REGISTERED');
  });
  readonly canRegister = computed(() => {
    const baseUrl = this.registryBaseUrlRef().trim();
    if (this.busyActionRef() !== null || !baseUrl) {
      return false;
    }
    const status = this.statusRef();
    const currentUrl = status?.selection?.baseUrl?.trim() ?? '';
    return !(
      status?.enabled
      && status.lifecycle === 'REGISTERED'
      && currentUrl
      && sameRegistryUrl(currentUrl, baseUrl)
    );
  });

  constructor() {
    effect(() => {
      this.bindContext(this.sessionService.session());
    });
  }

  async loadStatus(): Promise<OperatorRegistryStatusDto | null> {
    this.ensureContextBound();
    return await this.run('load', () => this.service.loadStatus());
  }

  async inspect(request: OperatorRegistryInspectRequestDto): Promise<OperatorRegistryInspectionDto | null> {
    this.ensureContextBound();
    this.inspectionRef.set(null);
    const inspection = await this.run('inspect', () => this.service.inspect(request));
    if (inspection) {
      this.inspectionRef.set(inspection);
      this.registryBaseUrlRef.set(inspection.baseUrl);
      this.expectedRegistryScopeRef.set(inspection.registryIdentity.registryScope);
      this.candidateInitialized = true;
    }
    return inspection;
  }

  async confirm(): Promise<OperatorRegistryStatusDto | null> {
    this.ensureContextBound();
    const inspectionToken = this.inspectionRef()?.inspectionToken.trim() ?? '';
    if (!inspectionToken) {
      this.errorRef.set('operator.registration.error.inspection.required');
      return null;
    }
    const status = await this.run('confirm', () => this.service.confirm(inspectionToken));
    if (status) {
      this.inspectionRef.set(null);
    }
    return status;
  }

  async register(): Promise<OperatorRegistryStatusDto | null> {
    this.ensureContextBound();
    const registryBaseUrl = this.registryBaseUrlRef().trim();
    if (!registryBaseUrl) {
      this.errorRef.set('operator.registration.error.registry.required');
      return null;
    }
    const expectedRegistryScope = this.expectedRegistryScopeRef().trim();
    const result = await this.run(
      'register',
      () => this.service.register({
        registryBaseUrl,
        ...(expectedRegistryScope ? { expectedRegistryScope } : {})
      })
    );
    if (result) {
      const status = result.status;
      this.inspectionRef.set(null);
      this.registryBaseUrlRef.set(status.selection?.baseUrl ?? registryBaseUrl);
      this.expectedRegistryScopeRef.set(
        status.selection?.registryScope
        ?? status.selection?.registryIdentity?.registryScope
        ?? this.expectedRegistryScopeRef()
      );
      this.candidateInitialized = true;
      this.leaderboard.applyRegistryMutation(result);
      return status;
    }
    return null;
  }

  async retry(): Promise<OperatorRegistryStatusDto | null> {
    this.ensureContextBound();
    return await this.run('retry', () => this.service.retry());
  }

  async disconnect(): Promise<OperatorRegistryStatusDto | null> {
    this.ensureContextBound();
    const result = await this.run('disconnect', () => this.service.disconnect());
    if (result) {
      this.inspectionRef.set(null);
      this.leaderboard.applyRegistryMutation(result);
      return result.status;
    }
    return null;
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

  setRegistryBaseUrl(value: string): void {
    const nextValue = `${value ?? ''}`;
    if (this.registryBaseUrlRef() === nextValue) {
      return;
    }
    this.registryBaseUrlRef.set(nextValue);
    this.inspectionRef.set(null);
    this.candidateInitialized = true;
  }

  setExpectedRegistryScope(value: string): void {
    const nextValue = `${value ?? ''}`;
    if (this.expectedRegistryScopeRef() === nextValue) {
      return;
    }
    this.expectedRegistryScopeRef.set(nextValue);
    this.inspectionRef.set(null);
    this.candidateInitialized = true;
  }

  reset(): void {
    this.requestGeneration += 1;
    this.statusRef.set(null);
    this.inspectionRef.set(null);
    this.busyActionRef.set(null);
    this.registryBaseUrlRef.set('');
    this.expectedRegistryScopeRef.set('');
    this.candidateInitialized = false;
    this.clearFeedback();
  }

  private async run<
    T extends
      | OperatorRegistryStatusDto
      | OperatorRegistryInspectionDto
      | OperatorRegistryMutationResultDto
  >(
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
      const status = isMutationResult(result)
        ? result.status
        : isStatus(result)
          ? result
          : null;
      if (status) {
        this.statusRef.set(status);
        this.initializeCandidate(status);
      }
      return result;
    } catch (error) {
      if (requestGeneration === this.requestGeneration) {
        this.errorRef.set(messageFromError(error, defaultMessageForAction(action)));
      }
      return null;
    } finally {
      if (requestGeneration === this.requestGeneration) {
        this.busyActionRef.set(null);
      }
    }
  }

  private initializeCandidate(status: OperatorRegistryStatusDto): void {
    if (this.candidateInitialized) {
      return;
    }
    this.registryBaseUrlRef.set(
      status.selection?.baseUrl
      ?? status.candidateDefaults?.baseUrl
      ?? status.registryOptions?.[0]?.baseUrl
      ?? ''
    );
    this.expectedRegistryScopeRef.set(
      status.selection?.registryScope
      ?? status.selection?.registryIdentity?.registryScope
      ?? status.candidateDefaults?.registryScope
      ?? ''
    );
    this.candidateInitialized = true;
  }

  private ensureContextBound(): void {
    this.bindContext(this.sessionService.currentSession());
  }

  private bindContext(session: AppSession | null): void {
    const nextContextKey = operatorRegistryStoreContextKey(
      environment.operatorRegistryDataSource,
      session
    );
    if (nextContextKey === this.boundContextKey) {
      return;
    }
    this.boundContextKey = nextContextKey;
    this.reset();
  }

  private currentContextKey(): string {
    return operatorRegistryStoreContextKey(
      environment.operatorRegistryDataSource,
      this.sessionService.currentSession()
    );
  }
}

export function operatorRegistryStoreContextKey(
  dataSource: OperatorRegistryDataSource,
  session: AppSession | null
): string {
  const sessionIdentity = session?.kind === 'demo'
    ? `demo:${session.userId.trim()}`
    : session?.kind === 'firebase'
      ? `firebase:${session.profile.id.trim()}`
      : 'none';
  return `${dataSource}:${sessionIdentity}`;
}

function isStatus(
  value:
    | OperatorRegistryStatusDto
    | OperatorRegistryInspectionDto
    | OperatorRegistryMutationResultDto
): value is OperatorRegistryStatusDto {
  return 'lifecycle' in value;
}

function isMutationResult(
  value:
    | OperatorRegistryStatusDto
    | OperatorRegistryInspectionDto
    | OperatorRegistryMutationResultDto
): value is OperatorRegistryMutationResultDto {
  return 'status' in value && 'removedLeaderboardEntryIds' in value;
}

function defaultMessageForAction(action: Exclude<OperatorRegistryBusyAction, null>): string {
  switch (action) {
    case 'load':
      return 'operator.registration.error.load';
    case 'inspect':
      return 'operator.registration.error.inspect';
    case 'confirm':
      return 'operator.registration.error.confirm';
    case 'register':
      return 'operator.registration.error.register';
    case 'retry':
      return 'operator.registration.error.retry';
    case 'disconnect':
      return 'operator.registration.error.disconnect';
  }
}

function sameRegistryUrl(left: string, right: string): boolean {
  try {
    return normalizeOperatorRegistryBaseUrl(left, false)
      === normalizeOperatorRegistryBaseUrl(right, false);
  } catch {
    return left.trim().replace(/\/+$/, '') === right.trim().replace(/\/+$/, '');
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
      return 'operator.registration.error.timeout';
    }
    if (typeof source.message === 'string' && source.message.trim()) {
      return source.message.trim();
    }
  }
  return fallback;
}
