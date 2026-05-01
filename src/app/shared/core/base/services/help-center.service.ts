import { Injectable, computed, inject, signal } from '@angular/core';

import { DemoHelpCenterService } from '../../demo/services/help-center.service';
import { HttpHelpCenterService } from '../../http/services/help-center.service';
import type { HelpCenterRevisionSaveRequest, HelpCenterState } from '../models';
import { BaseRouteModeService } from './base-route-mode.service';

export const HELP_CENTER_LOAD_CONTEXT_KEY = 'help-center-load';

@Injectable({
  providedIn: 'root'
})
export class HelpCenterService extends BaseRouteModeService {
  private readonly demoHelpCenterService = inject(DemoHelpCenterService);
  private readonly httpHelpCenterService = inject(HttpHelpCenterService);
  private readonly stateRef = signal<HelpCenterState | null>(null);
  private preloadPromise: Promise<HelpCenterState> | null = null;

  readonly state = this.stateRef.asReadonly();
  readonly activeRevision = computed(() => this.stateRef()?.activeRevision ?? null);
  readonly hasActiveRevision = computed(() => Boolean(this.activeRevision()));
  readonly activeVersionLabel = computed(() => {
    const revision = this.activeRevision();
    return revision ? `v${revision.version}` : '';
  });

  async preload(): Promise<HelpCenterState> {
    if (!this.preloadPromise) {
      this.preloadPromise = this.loadState().finally(() => {
        this.preloadPromise = null;
      });
    }
    return this.preloadPromise;
  }

  async refresh(): Promise<HelpCenterState> {
    return this.loadState();
  }

  async loadAdminState(adminUserId: string): Promise<HelpCenterState> {
    const service = this.helpService();
    const state = service instanceof HttpHelpCenterService
      ? await service.loadAdminState(adminUserId)
      : await service.loadState();
    this.stateRef.set(this.cloneState(state));
    return this.cloneState(state);
  }

  async saveRevision(request: HelpCenterRevisionSaveRequest): Promise<HelpCenterState> {
    const state = await this.helpService().saveRevision(request);
    this.stateRef.set(this.cloneState(state));
    return this.cloneState(state);
  }

  async activateRevision(revisionId: string, actorUserId: string): Promise<HelpCenterState> {
    const state = await this.helpService().activateRevision(revisionId, actorUserId);
    this.stateRef.set(this.cloneState(state));
    return this.cloneState(state);
  }

  async deleteRevision(revisionId: string, actorUserId: string): Promise<HelpCenterState> {
    const state = await this.helpService().deleteRevision(revisionId, actorUserId);
    this.stateRef.set(this.cloneState(state));
    return this.cloneState(state);
  }

  private async loadState(): Promise<HelpCenterState> {
    const state = await this.helpService().loadState();
    this.stateRef.set(this.cloneState(state));
    return this.cloneState(state);
  }

  private helpService(): DemoHelpCenterService | HttpHelpCenterService {
    return this.resolveRouteService('/help/active', this.demoHelpCenterService, this.httpHelpCenterService);
  }

  private cloneState(state: HelpCenterState): HelpCenterState {
    return {
      activeRevision: state.activeRevision
        ? {
            ...state.activeRevision,
            sections: state.activeRevision.sections.map(section => ({ ...section }))
          }
        : null,
      revisions: state.revisions.map(revision => ({
        ...revision,
        sections: revision.sections.map(section => ({ ...section }))
      })),
      auditTrail: state.auditTrail.map(entry => ({ ...entry }))
    };
  }
}
