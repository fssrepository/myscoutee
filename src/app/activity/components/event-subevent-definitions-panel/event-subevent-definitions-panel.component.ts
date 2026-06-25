import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, Input, inject } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { of } from 'rxjs';

import { AppUtils } from '../../../shared/app-utils';
import { PricingBuilder } from '../../../shared/core/base/builders';
import { ActivityEventDetailDTO, type SubEventDefinitionDTO } from '../../../shared/core/contracts/activity.interface';
import type { DateRangeDto } from '../../../shared/core/contracts/date.interface';
import type * as EventContracts from '../../../shared/core/contracts/event.interface';
import {
  InfoCardComponent,
  SmartListComponent,
  type AppMenuItemSelectEvent,
  type CardMenuActionEvent,
  type InfoCardData,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListLoadPage
} from '../../../shared/ui';
import { ConfirmationDialogService } from '../../../shared/ui/services/confirmation-dialog.service';
import {
  EventSubeventStageFormPopupComponent,
  type EventSubeventStageFormModel,
  type EventSubeventStageFormPopupView,
  type EventSubeventStageInsertPlacement,
  type EventSubeventTournamentLeaderboardType
} from '../event-subevent-stage-form-popup/event-subevent-stage-form-popup.component';

interface SubEventDefinitionsPanelFilters {
  revision: number;
}

interface SubEventDefinitionFormState {
  index: number | null;
  id: string;
  icon: string | null;
  groups: EventContracts.SubEventGroupDTO[];
  model: EventSubeventStageFormModel;
  insertPlacement: EventSubeventStageInsertPlacement;
  insertTargetId: string | null;
}

@Component({
  selector: 'app-event-subevent-definitions-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    SmartListComponent,
    InfoCardComponent,
    EventSubeventStageFormPopupComponent
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EventSubeventDefinitionsPanelComponent),
      multi: true
    }
  ],
  templateUrl: './event-subevent-definitions-panel.component.html',
  styleUrl: './event-subevent-definitions-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventSubeventDefinitionsPanelComponent implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly confirmationDialogService = inject(ConfirmationDialogService);
  private onChange: (value: SubEventDefinitionDTO[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private revision = 0;
  private boundsValue: DateRangeDto | null = null;
  private readonly tournamentLeaderboardTypeOptions: readonly EventSubeventTournamentLeaderboardType[] = ['Score', 'Fifa'];

  @Input() mode: EventContracts.EventMode = 'Casual';
  @Input() readOnly = false;
  @Input()
  set bounds(value: DateRangeDto | null | undefined) {
    this.boundsValue = value ? ActivityEventDetailDTO.normalizeDateRange(value) : null;
    this.refreshDefinitionFormView();
  }

  protected definitions: SubEventDefinitionDTO[] = [];
  protected disabled = false;
  protected definitionForm: SubEventDefinitionFormState | null = null;
  protected definitionFormModelValue: EventSubeventStageFormModel = this.createDefinitionFormModel(null, 1);
  protected definitionFormView: EventSubeventStageFormPopupView = this.createDefinitionFormPopupView(null, this.definitionFormModelValue);
  protected smartListQuery: Partial<ListQuery<SubEventDefinitionsPanelFilters>> = {
    filters: { revision: 0 }
  };

  protected readonly smartListConfig: SmartListConfig<SubEventDefinitionDTO, SubEventDefinitionsPanelFilters> = {
    pageSize: 20,
    defaultView: 'list',
    showStickyHeader: false,
    showGroupMarker: () => false,
    emptyLabel: 'No sub event definitions yet',
    emptyDescription: '',
    listLayout: 'card-grid',
    orientation: 'horizontal',
    desktopColumns: 3,
    snapMode: 'none',
    mobileStepper: true,
    pagination: {
      mode: 'arrows'
    },
    trackBy: (_index, item) => item.id
  };

  protected readonly loadDefinitionsPage: SmartListLoadPage<SubEventDefinitionDTO, SubEventDefinitionsPanelFilters> = () => of({
    items: this.definitions,
    total: this.definitions.length
  } satisfies PageResult<SubEventDefinitionDTO>);

  writeValue(value: readonly SubEventDefinitionDTO[] | null | undefined): void {
    this.definitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(value ?? []);
    this.bumpList();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: SubEventDefinitionDTO[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  protected canEdit(): boolean {
    return !this.readOnly && !this.disabled;
  }

  protected modeLabel(): string {
    return this.mode === 'Tournament' ? 'Tournament' : 'Casual';
  }

  protected countLabel(): string {
    return `${this.definitions.length} item${this.definitions.length === 1 ? '' : 's'}`;
  }

  protected definitionCard(item: SubEventDefinitionDTO, index: number): InfoCardData {
    const capacityLabel = `${item.capacityMin} - ${item.capacityMax}`;
    const sequenceLabel = this.mode === 'Tournament' ? `Stage ${index + 1}` : `Sub Event ${index + 1}`;
    const status = this.definitionStatus(item);
    return {
      id: item.id,
      title: item.name,
      mediaMode: 'title',
      mediaTone: 'neutral',
      mediaTitle: sequenceLabel,
      mediaSubtitle: this.mode,
      mediaIcon: item.icon || (this.mode === 'Tournament' ? 'emoji_events' : 'inventory_2'),
      metaRows: [
        `Capacity ${capacityLabel}`
      ],
      description: item.description || 'No description',
      descriptionLines: 2,
      surfaceTone: 'draft',
      leadingIcon: {
        icon: status.icon,
        tone: status.leadingTone
      },
      mediaStart: {
        variant: 'avatar',
        tone: 'default',
        icon: 'location_on',
        interactive: false
      },
      mediaEnd: {
        variant: 'badge',
        layout: 'badge-with-leading-accessory',
        tone: status.overlayTone,
        label: status.label,
        interactive: false,
        leadingAccessory: {
          icon: status.icon,
          tone: status.accessoryTone
        }
      },
      menuActions: this.canEdit() ? ['edit', 'delete'] : []
    };
  }

  private definitionStatus(item: SubEventDefinitionDTO): {
    label: string;
    icon: string;
    overlayTone: 'public' | 'blocked';
    leadingTone: 'public' | 'invitation';
    accessoryTone: 'positive' | 'negative';
  } {
    if (item.optional) {
      return {
        label: 'Optional',
        icon: 'toggle_on',
        overlayTone: 'public',
        leadingTone: 'public',
        accessoryTone: 'positive'
      };
    }
    return {
      label: 'Mandatory',
      icon: 'block',
      overlayTone: 'blocked',
      leadingTone: 'invitation',
      accessoryTone: 'negative'
    };
  }

  protected definitionMenuContext(item: SubEventDefinitionDTO): Record<string, unknown> {
    return { definitionId: item.id };
  }

  protected onDefinitionMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (!this.canEdit()) {
      return;
    }
    const context = event.context as { definitionId?: unknown } | undefined;
    const definitionId = `${context?.definitionId ?? ''}`.trim();
    const item = this.definitions.find(definition => definition.id === definitionId);
    if (!item) {
      return;
    }
    this.onCardMenuAction(item, {
      id: item.id,
      actionId: event.id,
      action: {
        id: event.id,
        label: `${event.item?.label ?? event.id}`,
        icon: `${event.item?.icon ?? ''}`
      },
      card: this.definitionCard(item, this.definitions.indexOf(item))
    });
  }

  protected openCreateDefinitionForm(event?: Event): void {
    event?.stopPropagation();
    if (!this.canEdit()) {
      return;
    }
    const nextIndex = this.definitions.length + 1;
    const model = this.createDefinitionFormModel(null, nextIndex);
    this.setDefinitionForm({
      index: null,
      id: `subevent-definition-${Date.now()}`,
      icon: null,
      groups: [],
      model,
      insertPlacement: 'after',
      insertTargetId: this.definitions[this.definitions.length - 1]?.id ?? null
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  protected onCardMenuAction(item: SubEventDefinitionDTO, event: CardMenuActionEvent<InfoCardData>): void {
    if (!this.canEdit()) {
      return;
    }
    const index = this.definitions.findIndex(candidate => candidate.id === item.id);
    if (index < 0) {
      return;
    }
    if (event.actionId === 'edit') {
      this.openEditDefinitionForm(index);
      return;
    }
    if (event.actionId === 'delete') {
      this.requestDeleteDefinition(index);
    }
  }

  private createDefinitionFormPopupView(
    state: SubEventDefinitionFormState | null,
    model: EventSubeventStageFormModel
  ): EventSubeventStageFormPopupView {
    const isTournament = this.mode === 'Tournament';
    const isOptional = !isTournament && model.optional === true;
    const insertOptions = this.definitionInsertOptions();
    const leaderboardType = this.normalizedTournamentLeaderboardType(model.tournamentLeaderboardType);
    const timingBounds = this.definitionTimingBounds();
    const timingSummaryMeta = timingBounds
      ? `Main event range ${AppUtils.dateTimeRangeLabel(timingBounds.startAt, timingBounds.endAt, 'Date unavailable')}`
      : (isTournament ? 'Tournament definition' : 'Casual definition');

    return {
      open: Boolean(state),
      parentTitle: 'Sub Events',
      title: this.definitionFormTitle(state),
      readOnly: !this.canEdit(),
      canSave: this.canSaveDefinitionForm(model),
      invalidName: !this.hasText(model.name),
      invalidDescription: !this.hasText(model.description),
      showOptionalToggle: !isTournament,
      modeClass: isOptional ? 'subevent-mode-optional' : 'subevent-mode-mandatory',
      modeIcon: isOptional ? 'toggle_on' : 'block',
      slotBoundTiming: Boolean(timingBounds),
      timingSummaryTitle: timingBounds ? 'Main event range' : 'Definition',
      timingSummaryText: '',
      timingSummaryMeta,
      dateInput: {
        mode: 'range',
        precision: 'minute',
        range: {
          start: { label: 'Start' },
          end: { label: 'End' },
          bounds: timingBounds
            ? {
              start: timingBounds.startAt,
              end: timingBounds.endAt
            }
            : null
        },
        readOnly: !this.canEdit()
      },
      showInsertControls: state?.index === null && insertOptions.length > 0,
      insertFieldLabel: isTournament ? 'Insert Stage' : 'Insert Sub Event',
      insertPlacement: state?.insertPlacement ?? 'after',
      insertTargetId: state?.insertTargetId ?? insertOptions[insertOptions.length - 1]?.id ?? null,
      insertOptions,
      showTournamentFields: isTournament,
      tournamentLeaderboardTypeOptions: this.tournamentLeaderboardTypeOptions,
      tournamentLeaderboardTypeValue: leaderboardType,
      tournamentLeaderboardTypeClass: `tournament-leaderboard-${leaderboardType.toLowerCase()}`,
      tournamentLeaderboardTypeIcon: leaderboardType === 'Fifa' ? 'sports_soccer' : 'leaderboard',
      tournamentEstimatedGroupCountLabel: this.tournamentEstimatedGroupCountLabel(model)
    };
  }

  protected saveDefinitionForm(event?: Event): void {
    event?.stopPropagation();
    const state = this.definitionForm;
    if (!state || !this.canEdit() || !this.canSaveDefinitionForm(state.model)) {
      return;
    }

    const definition = this.definitionFromFormState(state);
    const next = [...this.definitions];
    if (state.index === null) {
      next.splice(this.definitionInsertIndex(state), 0, definition);
    } else {
      next[state.index] = definition;
    }
    this.setDefinitionForm(null);
    this.commit(next);
  }

  protected cancelDefinitionForm(event?: Event): void {
    event?.stopPropagation();
    this.setDefinitionForm(null);
    this.onTouched();
    this.cdr.markForCheck();
  }

  protected selectDefinitionOptional(optional: boolean): void {
    this.patchDefinitionFormModel({ optional });
  }

  protected selectDefinitionInsertPlacement(placement: EventSubeventStageInsertPlacement): void {
    if (!this.definitionForm) {
      return;
    }
    this.setDefinitionForm({
      ...this.definitionForm,
      insertPlacement: placement
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  protected onDefinitionInsertTargetChange(targetId: string | null): void {
    if (!this.definitionForm) {
      return;
    }
    this.setDefinitionForm({
      ...this.definitionForm,
      insertTargetId: targetId
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  protected onDefinitionCapacityMinChange(value: number | string): void {
    this.patchDefinitionFormModel({ capacityMin: this.toNonNegativeInteger(value) });
  }

  protected onDefinitionCapacityMaxChange(value: number | string): void {
    this.patchDefinitionFormModel({ capacityMax: this.toNonNegativeInteger(value) });
  }

  protected onDefinitionTournamentGroupCapacityMinChange(value: number | string): void {
    this.patchDefinitionFormModel({ tournamentGroupCapacityMin: this.toNonNegativeInteger(value) });
  }

  protected onDefinitionTournamentGroupCapacityMaxChange(value: number | string): void {
    this.patchDefinitionFormModel({ tournamentGroupCapacityMax: this.toNonNegativeInteger(value) });
  }

  protected onDefinitionTournamentLeaderboardTypeChange(value: EventSubeventTournamentLeaderboardType | string | null | undefined): void {
    this.patchDefinitionFormModel({ tournamentLeaderboardType: this.normalizedTournamentLeaderboardType(value) });
  }

  protected onDefinitionTournamentAdvancePerGroupChange(value: number | string): void {
    this.patchDefinitionFormModel({ tournamentAdvancePerGroup: this.toNonNegativeInteger(value) });
  }

  private openEditDefinitionForm(index: number): void {
    const item = this.definitions[index];
    if (!item) {
      return;
    }
    this.setDefinitionForm({
      index,
      id: item.id,
      icon: item.icon ?? null,
      groups: (item.groups ?? []).map(group => ({ ...group })),
      model: this.createDefinitionFormModel(item, index + 1),
      insertPlacement: 'after',
      insertTargetId: item.id
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  private requestDeleteDefinition(index: number): void {
    const item = this.definitions[index];
    if (!item) {
      return;
    }
    const label = this.definitionSequenceLabel(index);
    this.confirmationDialogService.open({
      title: this.mode === 'Tournament' ? 'Delete Stage Definition' : 'Delete Sub Event Definition',
      message: `Delete ${label} - ${item.name}?`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      busyConfirmLabel: 'Deleting...',
      confirmTone: 'danger',
      failureMessage: 'Unable to delete sub event definition.',
      onConfirm: () => {
        if (this.definitionForm?.index === index) {
          this.setDefinitionForm(null);
        }
        this.commit(this.definitions.filter((_, itemIndex) => itemIndex !== index));
      }
    });
  }

  private createDefinitionFormModel(item: SubEventDefinitionDTO | null, fallbackIndex: number): EventSubeventStageFormModel {
    const range = this.defaultDefinitionRange(item);
    const groupCapacityMin = this.optionalNonNegativeInteger(item?.tournamentGroupCapacityMin) ?? 0;
    const groupCapacityMax = Math.max(groupCapacityMin, this.optionalNonNegativeInteger(item?.tournamentGroupCapacityMax) ?? groupCapacityMin);
    const optional = this.mode === 'Tournament' ? false : item?.optional ?? true;
    return {
      name: item?.name?.trim() || (this.mode === 'Tournament' ? `Stage ${fallbackIndex}` : `Sub Event ${fallbackIndex}`),
      description: item?.description?.trim() ?? '',
      location: item?.location?.trim() ?? '',
      dateRange: range,
      optional,
      pricing: item?.pricing ? PricingBuilder.clonePricingConfig(item.pricing) : PricingBuilder.createDefaultPricingConfig('subevent'),
      capacityMin: this.toNonNegativeInteger(item?.capacityMin ?? 0),
      capacityMax: this.toNonNegativeInteger(item?.capacityMax ?? 0),
      tournamentGroupCapacityMin: groupCapacityMin,
      tournamentGroupCapacityMax: groupCapacityMax,
      tournamentLeaderboardType: this.normalizedTournamentLeaderboardType(item?.tournamentLeaderboardType),
      tournamentAdvancePerGroup: this.optionalNonNegativeInteger(item?.tournamentAdvancePerGroup) ?? 0
    };
  }

  private definitionFromFormState(state: SubEventDefinitionFormState): SubEventDefinitionDTO {
    const model = state.model;
    const capacityMin = this.toNonNegativeInteger(model.capacityMin);
    const capacityMax = Math.max(capacityMin, this.toNonNegativeInteger(model.capacityMax));
    const groupCapacityMin = this.optionalNonNegativeInteger(model.tournamentGroupCapacityMin);
    const groupCapacityMax = this.optionalNonNegativeInteger(model.tournamentGroupCapacityMax);
    return ActivityEventDetailDTO.normalizeSubEventDefinitions([{
      id: state.id,
      name: model.name,
      description: model.description,
      dateRange: ActivityEventDetailDTO.normalizeDateRange(model.dateRange),
      location: `${model.location ?? ''}`.trim(),
      groups: state.groups.map(group => ({ ...group })),
      tournamentGroupCount: this.optionalNonNegativeInteger(model.tournamentGroupCount),
      tournamentGroupCapacityMin: groupCapacityMin,
      tournamentGroupCapacityMax: Math.max(groupCapacityMin ?? 0, groupCapacityMax ?? groupCapacityMin ?? 0),
      tournamentLeaderboardType: this.normalizedTournamentLeaderboardType(model.tournamentLeaderboardType),
      tournamentAdvancePerGroup: this.optionalNonNegativeInteger(model.tournamentAdvancePerGroup),
      optional: this.mode === 'Tournament' ? false : model.optional === true,
      pricing: model.pricing ? PricingBuilder.clonePricingConfig(model.pricing) : null,
      capacityMin,
      capacityMax,
      icon: state.icon
    }])[0];
  }

  private patchDefinitionFormModel(update: Partial<EventSubeventStageFormModel>): void {
    if (!this.definitionForm) {
      return;
    }
    this.setDefinitionForm({
      ...this.definitionForm,
      model: {
        ...this.definitionForm.model,
        ...update
      }
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  private setDefinitionForm(state: SubEventDefinitionFormState | null): void {
    this.definitionForm = state;
    this.definitionFormModelValue = state?.model ?? this.createDefinitionFormModel(null, this.definitions.length + 1);
    this.definitionFormView = this.createDefinitionFormPopupView(state, this.definitionFormModelValue);
  }

  private definitionFormTitle(state: SubEventDefinitionFormState | null): string {
    const verb = !state || state.index === null ? 'Create' : 'Edit';
    return this.mode === 'Tournament'
      ? `${verb} Stage`
      : `${verb} Sub Event`;
  }

  private definitionSequenceLabel(index: number): string {
    return this.mode === 'Tournament'
      ? `Stage ${index + 1}`
      : `Sub Event ${index + 1}`;
  }

  private definitionInsertOptions(): ReadonlyArray<{ id: string; label: string }> {
    return this.definitions.map((item, index) => ({
      id: item.id,
      label: item.name?.trim() || this.definitionSequenceLabel(index)
    }));
  }

  private definitionInsertIndex(state: SubEventDefinitionFormState): number {
    const targetIndex = this.definitions.findIndex(item => item.id === state.insertTargetId);
    if (targetIndex < 0) {
      return this.definitions.length;
    }
    return state.insertPlacement === 'before' ? targetIndex : targetIndex + 1;
  }

  private canSaveDefinitionForm(model: EventSubeventStageFormModel): boolean {
    return this.hasText(model.name) && this.hasText(model.description);
  }

  private defaultDefinitionRange(item: SubEventDefinitionDTO | null): DateRangeDto {
    const timingBounds = this.definitionTimingBounds();
    const fallbackStart = timingBounds ? this.parseDate(timingBounds.startAt) ?? new Date() : new Date();
    const parsedStart = this.parseDate(item?.dateRange?.startAt) ?? fallbackStart;
    const parsedEndRaw = this.parseDate(item?.dateRange?.endAt)
      ?? (timingBounds ? this.parseDate(timingBounds.endAt) : null)
      ?? new Date(parsedStart.getTime() + (60 * 60 * 1000));
    const parsedEnd = parsedEndRaw.getTime() <= parsedStart.getTime()
      ? new Date(parsedStart.getTime() + (60 * 60 * 1000))
      : parsedEndRaw;
    return {
      startAt: AppUtils.toIsoDateTimeLocal(parsedStart),
      endAt: AppUtils.toIsoDateTimeLocal(parsedEnd),
      precision: 'minute'
    };
  }

  private tournamentEstimatedGroupCountLabel(model: EventSubeventStageFormModel): string {
    const groupMin = Math.max(1, this.toNonNegativeInteger(model.tournamentGroupCapacityMin ?? 0) || 1);
    const groupMax = Math.max(groupMin, this.toNonNegativeInteger(model.tournamentGroupCapacityMax ?? groupMin));
    const stageMin = this.toNonNegativeInteger(model.capacityMin);
    const stageMax = Math.max(stageMin, this.toNonNegativeInteger(model.capacityMax));
    const estimateMin = Math.max(1, Math.ceil(stageMin / groupMax));
    const estimateMax = Math.max(estimateMin, Math.ceil(stageMax / groupMin));
    return `${estimateMin} - ${estimateMax}`;
  }

  private normalizedTournamentLeaderboardType(value: EventSubeventTournamentLeaderboardType | string | null | undefined): EventSubeventTournamentLeaderboardType {
    return `${value ?? ''}`.trim() === 'Fifa' ? 'Fifa' : 'Score';
  }

  private definitionTimingBounds(): DateRangeDto | null {
    const start = this.parseDate(this.boundsValue?.startAt);
    const end = this.parseDate(this.boundsValue?.endAt);
    if (!start || !end || end.getTime() <= start.getTime()) {
      return null;
    }
    return {
      startAt: AppUtils.toIsoDateTimeLocal(start),
      endAt: AppUtils.toIsoDateTimeLocal(end),
      precision: 'minute'
    };
  }

  private refreshDefinitionFormView(): void {
    this.definitionFormView = this.createDefinitionFormPopupView(this.definitionForm, this.definitionFormModelValue);
    this.cdr.markForCheck();
  }

  private optionalNonNegativeInteger(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
  }

  private parseDate(value: unknown): Date | null {
    const raw = `${value ?? ''}`.trim();
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw.replace(/\//g, '-'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private hasText(value: unknown): boolean {
    return `${value ?? ''}`.trim().length > 0;
  }

  private commit(items: readonly SubEventDefinitionDTO[]): void {
    this.definitions = ActivityEventDetailDTO.normalizeSubEventDefinitions(items);
    this.bumpList();
    this.onTouched();
    this.onChange(this.definitions.map(item => ({ ...item })));
    this.cdr.markForCheck();
  }

  private bumpList(): void {
    this.revision += 1;
    this.smartListQuery = {
      filters: { revision: this.revision }
    };
  }

  private toNonNegativeInteger(value: number | string): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
}
