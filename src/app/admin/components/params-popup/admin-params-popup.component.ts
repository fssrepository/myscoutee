import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { I18nPipe } from '../../../shared/ui';
import { ProgressIndicatorComponent } from '../../../shared/ui/components/progress-indicator';
import {
  type AdminParamFieldDto,
  type AdminParamOptionDto,
  type AdminParamsHistoryDto,
  type AdminParamsHistoryItemDto,
  type AdminParamsSectionDto,
  type AdminParamsStateDto
} from '../../models/admin-params.model';
import { AdminParamsService } from '../../services/admin-params.service';
import { AdminShellService } from '../../services/admin-shell.service';

type AdminParamOption = Readonly<AdminParamOptionDto>;

@Component({
  selector: 'app-admin-params-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ProgressIndicatorComponent, I18nPipe],
  templateUrl: './admin-params-popup.component.html',
  styleUrl: './admin-params-popup.component.scss'
})
export class AdminParamsPopupComponent implements OnDestroy {
  protected readonly admin = inject(AdminShellService);
  protected readonly paramsService = inject(AdminParamsService);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly reverting = signal(false);
  protected readonly revertingVersion = signal<number | null>(null);
  protected readonly error = signal('');
  protected readonly state = signal<AdminParamsStateDto | null>(null);
  protected readonly openSectionKey = signal('');
  protected readonly editDraft = signal<{ section: AdminParamsSectionDto; fields: AdminParamFieldDto[] } | null>(null);
  protected readonly history = signal<AdminParamsHistoryDto | null>(null);
  protected readonly historyLoading = signal(false);
  protected readonly inspectedVersion = signal<AdminParamsHistoryItemDto | null>(null);
  protected readonly openTextSelectKey = signal('');
  protected readonly selectedSection = computed(() => {
    const key = this.openSectionKey();
    return this.state()?.sections.find(section => section.key === key) ?? this.state()?.sections[0] ?? null;
  });
  private historyLoadGeneration = 0;

  constructor() {
    void this.load();
  }

  ngOnDestroy(): void {
    this.historyLoadGeneration += 1;
    this.editDraft.set(null);
    this.history.set(null);
    this.historyLoading.set(false);
    this.openTextSelectKey.set('');
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const state = await this.paramsService.loadParamsState();
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

  protected openEdit(section?: AdminParamsSectionDto, event?: Event): void {
    event?.stopPropagation();
    const selected = section ?? this.selectedSection();
    if (!selected || this.loading() || this.saving()) {
      return;
    }
    this.editDraft.set({
      section: selected,
      fields: selected.fields.map(field => ({ ...field }))
    });
    this.openTextSelectKey.set('');
  }

  protected cancelEdit(): void {
    if (this.saving()) {
      return;
    }
    this.editDraft.set(null);
    this.openTextSelectKey.set('');
  }

  protected async saveEdit(): Promise<void> {
    const draft = this.editDraft();
    if (!draft || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const state = await this.paramsService.saveParamsSection(
        draft.section.key,
        draft.fields,
        `Updated ${draft.section.label} parameters.`
      );
      this.state.set(state);
      this.openSectionKey.set(draft.section.key);
      this.editDraft.set(null);
      this.openTextSelectKey.set('');
    } catch (error) {
      this.error.set(this.messageFromError(error, 'Unable to save parameters.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async openHistory(section: AdminParamsSectionDto, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.loading() || this.saving()) {
      return;
    }
    const loadGeneration = ++this.historyLoadGeneration;
    this.error.set('');
    this.inspectedVersion.set(null);
    this.history.set({
      sectionKey: section.key,
      label: section.label,
      labelKey: section.labelKey,
      versions: []
    });
    this.historyLoading.set(true);
    try {
      const history = await this.paramsService.loadParamsHistory(section.key);
      if (this.historyLoadGeneration !== loadGeneration) {
        return;
      }
      this.history.set(history);
    } catch (error) {
      if (this.historyLoadGeneration === loadGeneration) {
        this.history.set(null);
        this.error.set(this.messageFromError(error, 'Unable to load parameter history.'));
      }
    } finally {
      if (this.historyLoadGeneration === loadGeneration) {
        this.historyLoading.set(false);
      }
    }
  }

  protected closeHistory(): void {
    if (this.reverting()) {
      return;
    }
    this.historyLoadGeneration += 1;
    this.history.set(null);
    this.historyLoading.set(false);
    this.inspectedVersion.set(null);
  }

  protected inspectVersion(item: AdminParamsHistoryItemDto, event?: Event): void {
    event?.stopPropagation();
    this.inspectedVersion.set(this.inspectedVersion()?.version === item.version ? null : item);
  }

  protected async revertVersion(item: AdminParamsHistoryItemDto, event?: Event): Promise<void> {
    event?.stopPropagation();
    const history = this.history();
    if (!history || item.active || this.reverting()) {
      return;
    }
    this.reverting.set(true);
    this.revertingVersion.set(item.version);
    this.error.set('');
    let loadGeneration = 0;
    try {
      const state = await this.paramsService.revertParamsSection(history.sectionKey, item.version);
      this.state.set(state);
      this.openSectionKey.set(history.sectionKey);
      loadGeneration = ++this.historyLoadGeneration;
      this.historyLoading.set(true);
      const refreshedHistory = await this.paramsService.loadParamsHistory(history.sectionKey);
      if (this.historyLoadGeneration !== loadGeneration) {
        return;
      }
      this.history.set(refreshedHistory);
      this.inspectedVersion.set(refreshedHistory.versions.find(version => version.active) ?? null);
    } catch (error) {
      if (loadGeneration === 0 || this.historyLoadGeneration === loadGeneration) {
        this.error.set(this.messageFromError(error, 'Unable to revert parameters.'));
      }
    } finally {
      if (loadGeneration > 0 && this.historyLoadGeneration === loadGeneration) {
        this.historyLoading.set(false);
      }
      this.revertingVersion.set(null);
      this.reverting.set(false);
    }
  }

  protected fieldsByGroup(fields: readonly AdminParamFieldDto[]): { group: string; groupKey: string; fields: AdminParamFieldDto[] }[] {
    const groups = new Map<string, AdminParamFieldDto[]>();
    const groupKeys = new Map<string, string>();
    for (const field of fields) {
      const group = `${field.group ?? ''}`.trim() || 'General';
      if (!groupKeys.has(group)) {
        groupKeys.set(group, `${field.groupKey ?? ''}`.trim());
      }
      groups.set(group, [...(groups.get(group) ?? []), field]);
    }
    return [...groups.entries()].map(([group, groupFields]) => ({
      group,
      groupKey: groupKeys.get(group) ?? '',
      fields: groupFields
    }));
  }

  protected sectionDate(value: string | null | undefined): string {
    const date = new Date(`${value ?? ''}`);
    if (Number.isNaN(date.getTime())) {
      return `${value ?? ''}`.trim();
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  protected fieldValueLabel(field: AdminParamFieldDto): string {
    if (field.valueType === 'text') {
      return this.textFieldOptionLabel(field);
    }
    const value = Number(field.numberValue);
    const formatted = Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, '');
    return [formatted, `${field.unit ?? ''}`.trim()].filter(Boolean).join(' ');
  }

  protected textFieldOptions(field: AdminParamFieldDto): readonly AdminParamOption[] {
    return field.options ?? [];
  }

  protected textFieldOptionLabel(field: AdminParamFieldDto): string {
    const value = `${field.textValue ?? ''}`.trim();
    return this.textFieldOptions(field).find(option => option.value === value)?.label ?? value;
  }

  protected textFieldSelectOpen(field: AdminParamFieldDto): boolean {
    return this.openTextSelectKey() === field.key;
  }

  protected toggleTextFieldSelect(field: AdminParamFieldDto, event?: Event): void {
    event?.stopPropagation();
    if (this.saving() || !this.textFieldOptions(field).length) {
      return;
    }
    this.openTextSelectKey.set(this.textFieldSelectOpen(field) ? '' : field.key);
  }

  protected closeTextFieldSelect(event?: Event): void {
    event?.stopPropagation();
    this.openTextSelectKey.set('');
  }

  protected selectTextFieldOption(field: AdminParamFieldDto, option: AdminParamOption, event?: Event): void {
    event?.stopPropagation();
    if (this.saving()) {
      return;
    }
    this.updateTextField(field, option.value);
    this.openTextSelectKey.set('');
  }

  protected textFieldOptionSelected(field: AdminParamFieldDto, option: AdminParamOption): boolean {
    return `${field.textValue ?? ''}`.trim() === option.value;
  }

  protected updateTextField(field: AdminParamFieldDto, value: string): void {
    field.textValue = `${value ?? ''}`.trim();
  }

  protected updateNumberField(field: AdminParamFieldDto, value: string): void {
    field.numberValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  private messageFromError(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
