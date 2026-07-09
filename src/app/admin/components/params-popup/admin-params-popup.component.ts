import {
  CommonModule
} from '@angular/common';
import {
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  MatIconModule
} from '@angular/material/icon';

import {
  AdminParamsService,
  I18nService,
  type AdminParamFieldDto,
  type AdminParamOptionDto,
  type AdminParamsHistoryDto,
  type AdminParamsHistoryItemDto,
  type AdminParamsSectionDto,
  type AdminParamsStateDto
} from '../../../shared/core';
import {
  I18nPipe
} from '../../../shared/ui';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger
} from '../../../shared/ui/components/core/menu';
import {
  IndicatorComponent
} from '../../../shared/ui/components/core/indicator';
import {
  PopupComponent,
  type PopupActionEvent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import {
  AdminMenuStore
} from '../../../shared/ui/context/stores/admin-menu.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';

type AdminParamOption = Readonly<AdminParamOptionDto>;
type AdminParamSelectMenuItemId = `param-option:${string}:${string}`;

interface AdminParamSelectMenuContext {
  field: AdminParamFieldDto;
  option: AdminParamOption;
}

@Component({
  selector: 'app-admin-params-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, AppMenuComponent, IndicatorComponent, I18nPipe, PopupComponent],
  templateUrl: './admin-params-popup.component.html',
  styleUrl: './admin-params-popup.component.scss'
})
export class AdminParamsPopupComponent implements OnDestroy {
  protected readonly admin = inject(AdminMenuStore);
  protected readonly paramsService = inject(AdminParamsService);
  private readonly i18n = inject(I18nService);
  private readonly userProfileStore = inject(UserProfileStore);
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
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const state = await this.paramsService.loadParamsState(this.activeAdminId());
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

  protected paramsPopupModel(): PopupModel {
    return {
      title: 'params',
      subtitle: `${this.selectedSectionLabel()} · v${this.selectedSection()?.version ?? 1}`,
      ariaLabel: 'params',
      closeAriaLabel: 'close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      onClose: () => this.close()
    };
  }

  protected editPopupModel(draft: { section: AdminParamsSectionDto; fields: AdminParamFieldDto[] }): PopupModel {
    return {
      title: draft.section.labelKey || draft.section.label,
      subtitle: `v${draft.section.version}`,
      ariaLabel: draft.section.labelKey || draft.section.label,
      closeAriaLabel: 'cancel',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      showClose: false,
      headerActions: [
        {
          id: 'save-edit',
          icon: 'check',
          ariaLabel: 'save',
          palette: 'success',
          disabled: this.saving(),
          compactOnMobile: true
        },
        {
          id: 'cancel-edit',
          icon: 'close',
          ariaLabel: 'cancel',
          palette: 'default',
          disabled: this.saving(),
          compactOnMobile: true
        }
      ],
      onClose: () => this.cancelEdit(),
      onAction: event => this.onEditPopupAction(event)
    };
  }

  protected historyPopupModel(historyState: AdminParamsHistoryDto): PopupModel {
    return {
      title: historyState.labelKey || historyState.label,
      subtitle: 'history',
      ariaLabel: historyState.labelKey || historyState.label,
      closeAriaLabel: 'close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      showClose: false,
      headerActions: [
        {
          id: 'close-history',
          icon: 'close',
          ariaLabel: 'close',
          palette: 'default',
          disabled: this.reverting(),
          compactOnMobile: true
        }
      ],
      onClose: () => this.closeHistory(),
      onAction: event => this.onHistoryPopupAction(event)
    };
  }

  private onEditPopupAction(event: PopupActionEvent): void {
    if (event.action.id === 'save-edit') {
      void this.saveEdit();
      return;
    }
    if (event.action.id === 'cancel-edit') {
      this.cancelEdit();
    }
  }

  private onHistoryPopupAction(event: PopupActionEvent): void {
    if (event.action.id === 'close-history') {
      this.closeHistory();
    }
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
      const state = await this.paramsService.saveParamsSection(
        draft.section.key,
        draft.fields,
        `Updated ${draft.section.label} parameters.`,
        this.activeAdminId()
      );
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
      const history = await this.paramsService.loadParamsHistory(section.key, this.activeAdminId());
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
      const state = await this.paramsService.revertParamsSection(history.sectionKey, item.version, this.activeAdminId());
      this.state.set(state);
      this.openSectionKey.set(history.sectionKey);
      loadGeneration = ++this.historyLoadGeneration;
      this.historyLoading.set(true);
      const refreshedHistory = await this.paramsService.loadParamsHistory(history.sectionKey, this.activeAdminId());
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

  private selectedSectionLabel(): string {
    const section = this.selectedSection();
    return this.i18n.translate(section?.labelKey || section?.label || 'admin.params.platform', section?.label || 'Platform');
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

  protected textFieldSelectTitle(field: AdminParamFieldDto): string {
    return field.labelKey || field.label || 'Options';
  }

  protected textFieldSelectTrigger(field: AdminParamFieldDto): AppMenuTrigger {
    return {
      label: this.textFieldOptionLabel(field),
      ariaLabel: this.textFieldSelectTitle(field),
      layout: 'field',
      disabled: this.saving() || field.readOnly === true
    };
  }

  protected textFieldSelectItems(
    field: AdminParamFieldDto
  ): readonly AppMenuItem<AdminParamSelectMenuItemId, AdminParamSelectMenuContext>[] {
    return this.textFieldOptions(field).map(option => {
      const selected = this.textFieldOptionSelected(field, option);
      return {
        id: `param-option:${field.key}:${option.value}` as AdminParamSelectMenuItemId,
        kind: 'radio',
        label: option.labelKey || option.label,
        active: selected,
        checked: selected,
        context: { field, option }
      };
    });
  }

  protected onTextFieldSelect(
    event: AppMenuItemSelectEvent<AdminParamSelectMenuItemId, AdminParamSelectMenuContext>
  ): void {
    const context = event.context;
    if (!context) {
      return;
    }
    this.selectTextFieldOption(context.field, context.option, event.sourceEvent);
  }

  protected selectTextFieldOption(field: AdminParamFieldDto, option: AdminParamOption, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.saving()) {
      return;
    }
    this.updateTextField(field, option.value);
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

  private activeAdminId(): string {
    return this.userProfileStore.activeUserId().trim();
  }
}
