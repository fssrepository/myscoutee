import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { RouteDelayService } from '../../../shared/core/base/services/route-delay.service';
import {
  AdminService,
  type AdminParamFieldDto,
  type AdminParamsHistoryDto,
  type AdminParamsHistoryItemDto,
  type AdminParamsSectionDto,
  type AdminParamsStateDto
} from '../../admin.service';

@Component({
  selector: 'app-admin-params-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './admin-params-popup.component.html',
  styleUrl: './admin-params-popup.component.scss'
})
export class AdminParamsPopupComponent implements OnDestroy {
  private static readonly LOAD_DEMO_DELAY_MS = 1500;
  private static readonly SAVE_DEMO_DELAY_MS = 1500;

  protected readonly admin = inject(AdminService);
  private readonly routeDelay = inject(RouteDelayService);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly reverting = signal(false);
  protected readonly error = signal('');
  protected readonly state = signal<AdminParamsStateDto | null>(null);
  protected readonly openSectionKey = signal('');
  protected readonly editDraft = signal<{ section: AdminParamsSectionDto; fields: AdminParamFieldDto[] } | null>(null);
  protected readonly history = signal<AdminParamsHistoryDto | null>(null);
  protected readonly inspectedVersion = signal<AdminParamsHistoryItemDto | null>(null);
  protected readonly revertCandidate = signal<AdminParamsHistoryItemDto | null>(null);
  protected readonly selectedSection = computed(() => {
    const key = this.openSectionKey();
    return this.state()?.sections.find(section => section.key === key) ?? this.state()?.sections[0] ?? null;
  });

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.editDraft.set(null);
    this.history.set(null);
    this.revertCandidate.set(null);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [state] = await Promise.all([
        this.admin.loadParamsState(),
        this.routeDelay.waitForRouteDelay('/admin/params', undefined, undefined, AdminParamsPopupComponent.LOAD_DEMO_DELAY_MS)
      ]);
      this.state.set(state);
      if (!this.openSectionKey() && state.sections.length) {
        this.openSectionKey.set(state.sections[0].key);
      }
    } catch (error) {
      this.error.set(this.messageFromError(error, 'Unable to load parameters.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected close(): void {
    this.admin.closePopup();
  }

  protected toggleSection(section: AdminParamsSectionDto): void {
    this.openSectionKey.set(this.openSectionKey() === section.key ? '' : section.key);
  }

  protected openEdit(): void {
    const section = this.selectedSection();
    if (!section || this.saving()) {
      return;
    }
    this.editDraft.set({
      section,
      fields: section.fields.map(field => ({ ...field }))
    });
  }

  protected cancelEdit(): void {
    if (this.saving()) {
      return;
    }
    this.editDraft.set(null);
  }

  protected async saveEdit(): Promise<void> {
    const draft = this.editDraft();
    if (!draft || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const [state] = await Promise.all([
        this.admin.saveParamsSection(
          draft.section.key,
          draft.fields,
          `Updated ${draft.section.label} parameters.`
        ),
        this.routeDelay.waitForRouteDelay('/admin/params/save', undefined, undefined, AdminParamsPopupComponent.SAVE_DEMO_DELAY_MS)
      ]);
      this.state.set(state);
      this.openSectionKey.set(draft.section.key);
      this.editDraft.set(null);
    } catch (error) {
      this.error.set(this.messageFromError(error, 'Unable to save parameters.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async openHistory(section: AdminParamsSectionDto, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.error.set('');
    this.inspectedVersion.set(null);
    this.revertCandidate.set(null);
    try {
      const [history] = await Promise.all([
        this.admin.loadParamsHistory(section.key),
        this.routeDelay.waitForRouteDelay('/admin/params/history', undefined, undefined, 900)
      ]);
      this.history.set(history);
    } catch (error) {
      this.error.set(this.messageFromError(error, 'Unable to load parameter history.'));
    }
  }

  protected closeHistory(): void {
    if (this.reverting()) {
      return;
    }
    this.history.set(null);
    this.inspectedVersion.set(null);
    this.revertCandidate.set(null);
  }

  protected inspectVersion(item: AdminParamsHistoryItemDto): void {
    this.inspectedVersion.set(this.inspectedVersion()?.version === item.version ? null : item);
  }

  protected requestRevert(item: AdminParamsHistoryItemDto, event?: Event): void {
    event?.stopPropagation();
    if (this.reverting()) {
      return;
    }
    this.revertCandidate.set(item);
  }

  protected cancelRevert(): void {
    if (this.reverting()) {
      return;
    }
    this.revertCandidate.set(null);
  }

  protected async confirmRevert(): Promise<void> {
    const candidate = this.revertCandidate();
    const history = this.history();
    if (!candidate || !history || this.reverting()) {
      return;
    }
    this.reverting.set(true);
    this.error.set('');
    try {
      const [state] = await Promise.all([
        this.admin.revertParamsSection(history.sectionKey, candidate.version),
        this.routeDelay.waitForRouteDelay('/admin/params/revert', undefined, undefined, AdminParamsPopupComponent.SAVE_DEMO_DELAY_MS)
      ]);
      this.state.set(state);
      this.openSectionKey.set(history.sectionKey);
      this.history.set(await this.admin.loadParamsHistory(history.sectionKey));
      this.revertCandidate.set(null);
      this.inspectedVersion.set(null);
    } catch (error) {
      this.error.set(this.messageFromError(error, 'Unable to revert parameters.'));
    } finally {
      this.reverting.set(false);
    }
  }

  protected fieldsByGroup(fields: readonly AdminParamFieldDto[]): { group: string; fields: AdminParamFieldDto[] }[] {
    const groups = new Map<string, AdminParamFieldDto[]>();
    for (const field of fields) {
      const group = `${field.group ?? ''}`.trim() || 'General';
      groups.set(group, [...(groups.get(group) ?? []), field]);
    }
    return [...groups.entries()].map(([group, groupFields]) => ({ group, fields: groupFields }));
  }

  protected sectionDate(value: string | null | undefined): string {
    const date = new Date(`${value ?? ''}`);
    if (Number.isNaN(date.getTime())) {
      return `${value ?? ''}`.trim();
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  protected fieldValueLabel(field: AdminParamFieldDto): string {
    if (field.valueType === 'text') {
      return `${field.textValue ?? ''}`.trim();
    }
    const value = Number(field.numberValue);
    const formatted = Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, '');
    return [formatted, `${field.unit ?? ''}`.trim()].filter(Boolean).join(' ');
  }

  protected updateNumberField(field: AdminParamFieldDto, value: string): void {
    field.numberValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  private messageFromError(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
