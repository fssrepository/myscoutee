import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import { APP_STATIC_DATA } from '../../../../../../app-static-data';
import { AppCalendarDateAdapter, AppCalendarDateFormats } from '../../../../../../app-calendar-date-adapter';
import { AppUtils } from '../../../../../../app-utils';
import { UserExperiencesService, type UserExperiencesRouteConfig } from '../../../../../../core';
import type {
  ExperienceEntry,
  ExperienceFilter,
  ExperienceImportProgressState,
  ExperienceImportStatistics,
  UserExperienceImportDraft
} from '../../../../../../core/contracts/profile.interface';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../menu';
import {
  FormFlowComponent,
  type FormFlowModel
} from '../../flow';
import {
  PopupComponent,
  type PopupActionEvent,
  type PopupModel
} from '../../../popup';
import {
  SingleRowComponent,
  type SingleRowData
} from '../../../smart-list/card';
import {
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListFilters,
  type SmartListLoadPage
} from '../../../smart-list';

type ProfileExperienceManagerMenuId = string;

type ProfileExperienceManagerMenuContext =
  | { kind: 'experienceFilter'; value: ExperienceFilter }
  | { kind: 'experienceType'; value: ExperienceEntry['type'] }
  | { kind: 'experienceQuickAction'; action: 'create' | 'upload' };

interface ExperienceListFilters extends SmartListFilters {
  type: ExperienceFilter;
  revision: number;
}

type ExperienceListRow = SingleRowData<ExperienceEntry> & {
  entry: ExperienceEntry;
};

interface ExperienceImportDialogState {
  visible: boolean;
  fileName: string;
  busy: boolean;
  progress: ExperienceImportProgressState;
  statistics: ExperienceImportStatistics;
  warnings: string[];
  error: string | null;
  draft: UserExperienceImportDraft | null;
}

export interface ProfileExperienceEntriesChange {
  entries: ExperienceEntry[];
  highlightedIds?: readonly string[];
}

@Component({
  selector: 'app-profile-experience-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    AppMenuComponent,
    FormFlowComponent,
    PopupComponent,
    SmartListComponent,
    SingleRowComponent
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ProfileExperienceManagerComponent),
      multi: true
    },
    { provide: DateAdapter, useClass: AppCalendarDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: AppCalendarDateFormats.dateOnly }
  ],
  templateUrl: './profile-experience-manager.component.html',
  styleUrl: './profile-experience-manager.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileExperienceManagerComponent implements ControlValueAccessor, OnChanges {
  @Input() entries: readonly ExperienceEntry[] = [];
  @Input() initialFilter: ExperienceFilter = 'All';
  @Input() userId = '';
  @Input() experienceRouteConfig: UserExperiencesRouteConfig | null = null;
  @Input() emptyHint = 'Try switching the type dropdown to All or use Upload.';
  @Input() allowImport = true;
  @Input() showInlineActions = false;

  @Output() readonly entriesChange = new EventEmitter<ProfileExperienceEntriesChange>();
  @Output() readonly overlayStateChange = new EventEmitter<boolean>();

  @ViewChild('experienceImportInput') private experienceImportInput?: ElementRef<HTMLInputElement>;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly userExperiencesService = inject(UserExperiencesService);
  private experienceImportToken = 0;
  private overlayOpen = false;
  private experienceEntriesRevision = 0;
  protected controlDisabled = false;
  private onValueChange: (entries: ExperienceEntry[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly experienceFilterOptions = APP_STATIC_DATA.experienceFilterOptions;
  protected readonly experienceTypeOptions = APP_STATIC_DATA.experienceTypeOptions;

  protected experienceEntries: ExperienceEntry[] = [];
  protected experienceFilter: ExperienceFilter = 'All';
  protected showExperienceForm = false;
  protected editingExperienceId: string | null = null;
  protected pendingExperienceDeleteId: string | null = null;
  protected highlightedImportedExperienceIds = new Set<string>();
  protected experienceImportDialog: ExperienceImportDialogState = this.createEmptyExperienceImportDialogState();
  protected experienceForm: Omit<ExperienceEntry, 'id'> = this.createEmptyExperienceForm();
  protected experienceSmartListQuery: Partial<ListQuery<ExperienceListFilters>> = this.createExperienceSmartListQuery();
  protected readonly experienceSmartListConfig: SmartListConfig<ExperienceListRow, ExperienceListFilters> = {
    pageSize: 50,
    initialPageSize: 50,
    initialPageCount: 1,
    loadingDelayMs: 0,
    loadingWindowMs: 600,
    defaultView: 'list',
    showBackgroundLoadingProgress: false,
    showStickyHeader: false,
    showFirstGroupMarker: false,
    listLayout: 'stack',
    snapMode: 'none',
    desktopColumns: 1,
    containerClass: 'experience-card-list',
    emptyLabel: 'No entries in this filter',
    emptyDescription: () => this.emptyHint,
    trackBy: (_index, row) => row.id
  };
  protected readonly experienceSmartListLoadPage: SmartListLoadPage<ExperienceListRow, ExperienceListFilters> = query => from(
    this.loadExperienceRowsPage(query)
  );

  writeValue(value: unknown): void {
    this.setLocalEntries(Array.isArray(value) ? value as readonly ExperienceEntry[] : []);
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (entries: ExperienceEntry[]) => void): void {
    this.onValueChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entries']) {
      this.setLocalEntries(this.entries);
    }
    if (changes['initialFilter']) {
      this.setFilter(this.initialFilter);
    }
    if ((changes['userId'] || changes['experienceRouteConfig']) && !changes['entries']) {
      this.bumpExperienceRows();
    }
  }

  private async loadExperienceRowsPage(query: ListQuery<ExperienceListFilters>): Promise<PageResult<ExperienceListRow>> {
    const entries = await this.loadExperienceEntriesForList();
    const rows = this.experienceRowsForFilter(query.filters?.type ?? this.experienceFilter, entries);
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || rows.length || 50));
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const start = page * pageSize;
    return {
      items: rows.slice(start, start + pageSize),
      total: rows.length
    } satisfies PageResult<ExperienceListRow>;
  }

  protected get canSaveExperienceEntry(): boolean {
    return Boolean(
      this.experienceForm.title.trim()
      && this.experienceForm.org.trim()
      && this.isoDateToYearMonth(this.experienceForm.dateFrom)
    );
  }

  protected get canSubmitExperienceImport(): boolean {
    return !this.experienceImportDialog.busy
      && !this.experienceImportDialog.error
      && (this.experienceImportDialog.draft?.importedIds.length ?? 0) > 0;
  }

  openCreate(defaultType: ExperienceEntry['type'] = 'Workspace'): void {
    if (this.controlDisabled) {
      return;
    }
    this.openExperienceForm(undefined, defaultType);
  }

  openImport(): void {
    if (this.controlDisabled || !this.allowImport) {
      return;
    }
    const input = this.experienceImportInput?.nativeElement;
    if (!input) {
      return;
    }
    input.value = '';
    input.click();
  }

  setFilter(filter: ExperienceFilter): void {
    this.experienceFilter = this.isExperienceFilter(filter) ? filter : 'All';
    this.syncExperienceSmartListQuery();
    this.cdr.markForCheck();
  }

  closeActiveOverlay(): boolean {
    if (this.experienceImportDialog.visible) {
      this.cancelExperienceImportDialog();
      return true;
    }
    if (this.showExperienceForm) {
      this.closeExperienceForm();
      return true;
    }
    if (this.pendingExperienceDeleteId) {
      this.cancelExperienceDelete();
      return true;
    }
    return false;
  }

  protected onProfileExperienceMenuSelect(
    event: AppMenuItemSelectEvent<ProfileExperienceManagerMenuId, ProfileExperienceManagerMenuContext>
  ): void {
    const context = event.context;
    if (!context) {
      return;
    }
    switch (context.kind) {
      case 'experienceFilter':
        this.setFilter(context.value);
        return;
      case 'experienceType':
        this.experienceForm = {
          ...this.experienceForm,
          type: context.value
        };
        return;
      case 'experienceQuickAction':
        if (context.action === 'create') {
          this.openCreate(this.experienceFilter === 'All' ? 'Workspace' : this.experienceFilter);
          return;
        }
        this.openImport();
        return;
    }
  }

  protected onExperienceImportFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) {
      return;
    }
    void this.prepareExperienceImport(file);
  }

  protected cancelExperienceImportDialog(): void {
    this.experienceImportToken += 1;
    this.experienceImportDialog = this.createEmptyExperienceImportDialogState();
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  protected async submitExperienceImport(): Promise<void> {
    if (this.controlDisabled || !this.canSubmitExperienceImport || !this.experienceImportDialog.draft) {
      return;
    }
    const draft = this.experienceImportDialog.draft;
    await this.commitExperienceEntries(draft.nextEntries, draft.importedIds);
    this.experienceFilter = 'All';
    this.experienceImportDialog = this.createEmptyExperienceImportDialogState();
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  protected isExperienceEntryHighlighted(entryId: string): boolean {
    return this.highlightedImportedExperienceIds.has(entryId);
  }

  protected experienceImportTypeCount(type: ExperienceEntry['type']): number {
    return this.experienceImportDialog.statistics.countsByType[type] ?? 0;
  }

  protected experienceQuickActionMenuItems(): readonly AppMenuItem<ProfileExperienceManagerMenuId, ProfileExperienceManagerMenuContext>[] {
    return [
      {
        id: 'experience-actions',
        icon: 'add',
        closeIcon: 'close',
        ariaLabel: 'Open experience actions',
        palette: 'blue',
        items: [
          {
            id: 'experience-action-create',
            label: 'Create',
            icon: 'add_circle',
            palette: 'teal',
            surface: 'tinted',
            context: { kind: 'experienceQuickAction', action: 'create' }
          },
          {
            id: 'experience-action-upload',
            label: 'Upload',
            icon: 'upload_file',
            palette: 'orange',
            surface: 'tinted',
            disabled: !this.allowImport,
            context: { kind: 'experienceQuickAction', action: 'upload' }
          }
        ]
      }
    ];
  }

  protected experienceFilterMenuTrigger(): AppMenuTrigger {
    return {
      label: this.experienceFilter,
      icon: this.experienceFilterIcon(this.experienceFilter),
      palette: this.paletteFromProfileTone(this.experienceFilterClass(this.experienceFilter)),
      layout: 'field',
      ariaLabel: 'Open experience filter'
    };
  }

  protected experienceFilterMenuItems(): readonly AppMenuItem<ProfileExperienceManagerMenuId, ProfileExperienceManagerMenuContext>[] {
    return this.experienceFilterOptions.map(option => ({
      id: this.menuItemId('experience-filter', option),
      label: option,
      icon: this.experienceFilterIcon(option),
      kind: 'radio',
      active: option === this.experienceFilter,
      palette: this.paletteFromProfileTone(this.experienceFilterClass(option)),
      surface: 'tinted',
      context: { kind: 'experienceFilter', value: option }
    }));
  }

  protected experienceTypeMenuTrigger(): AppMenuTrigger {
    return {
      label: this.experienceForm.type,
      icon: this.experienceTypeIcon(this.experienceForm.type),
      palette: this.paletteFromProfileTone(this.experienceTypeToneClass(this.experienceForm.type)),
      layout: 'field',
      ariaLabel: 'Open experience type selector'
    };
  }

  protected experienceTypeMenuItems(): readonly AppMenuItem<ProfileExperienceManagerMenuId, ProfileExperienceManagerMenuContext>[] {
    return this.experienceTypeOptions.map(option => ({
      id: this.menuItemId('experience-type', option),
      label: option,
      icon: this.experienceTypeIcon(option),
      kind: 'radio',
      value: option,
      active: option === this.experienceForm.type,
      palette: this.paletteFromProfileTone(this.experienceTypeToneClass(option)),
      surface: 'tinted',
      context: { kind: 'experienceType', value: option }
    }));
  }

  protected experienceFormPopupModel(): PopupModel {
    return {
      title: this.editingExperienceId ? 'Edit Experience' : 'Add Experience',
      ariaLabel: this.editingExperienceId ? 'Edit experience' : 'Add experience',
      closeAriaLabel: 'Close experience form',
      size: 'wide',
      headerTone: 'accent',
      backdropTone: 'dim',
      closeOnBackdrop: true,
      headerActions: [
        {
          id: 'experience-form-save',
          icon: 'done',
          ariaLabel: 'Save experience',
          palette: 'green',
          disabled: !this.canSaveExperienceEntry
        }
      ],
      onClose: () => this.closeExperienceForm(),
      onAction: event => this.onExperienceFormPopupAction(event)
    };
  }

  protected experienceFormPopupZIndex(): number {
    return 4300;
  }

  protected experienceFormFlowModel(): FormFlowModel {
    return {
      title: 'Experience',
      layout: 'grouped',
      tone: this.experienceFormFlowTone(),
      header: false,
      completion: {
        controls: 'required'
      },
      steps: [
        {
          id: 'experience-details',
          title: 'Experience',
          icon: this.experienceTypeIcon(this.experienceForm.type),
          controls: [
            {
              id: 'type',
              bind: 'type',
              kind: 'menu',
              label: 'Type',
              layout: 'half',
              required: true,
              config: {
                kind: 'select',
                title: 'Experience Type',
                trigger: this.experienceTypeMenuTrigger(),
                items: this.experienceTypeMenuItems(),
                closeOnSelect: true
              }
            },
            {
              id: 'city',
              bind: 'city',
              kind: 'text',
              label: 'City',
              layout: 'half'
            },
            {
              id: 'title',
              bind: 'title',
              kind: 'text',
              label: 'Title',
              layout: 'half',
              required: true
            },
            {
              id: 'org',
              bind: 'org',
              kind: 'text',
              label: 'Organization',
              layout: 'half',
              required: true
            },
            {
              id: 'dateFrom',
              bind: 'dateFrom',
              kind: 'date',
              label: 'From',
              layout: 'half',
              required: true,
              config: {
                model: {
                  mode: 'single',
                  precision: 'date',
                  valueFormat: 'iso-date',
                  field: {
                    label: 'From',
                    placeholder: 'YYYY/MM/DD',
                    required: true
                  }
                }
              }
            },
            {
              id: 'dateTo',
              bind: 'dateTo',
              kind: 'date',
              label: 'To',
              layout: 'half',
              config: {
                model: {
                  mode: 'single',
                  precision: 'date',
                  valueFormat: 'iso-date',
                  field: {
                    label: 'To',
                    placeholder: 'Present'
                  }
                }
              }
            },
            {
              id: 'description',
              bind: 'description',
              kind: 'textarea',
              label: 'Description',
              rows: 4,
              layout: 'wide'
            }
          ]
        }
      ]
    };
  }

  private experienceFormFlowTone(): FormFlowModel['tone'] {
    switch (this.experienceForm.type) {
      case 'Workspace':
        return 'orange';
      case 'School':
        return 'blue';
      case 'Online Session':
        return 'green';
      default:
        return 'default';
    }
  }

  private onExperienceFormPopupAction(event: PopupActionEvent): void {
    if (event.action.id !== 'experience-form-save') {
      return;
    }
    void this.saveExperienceEntry();
  }

  protected experienceTypeIcon(type: ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'apartment';
      case 'School':
        return 'school';
      case 'Online Session':
        return 'videocam';
      default:
        return 'rocket_launch';
    }
  }

  protected experienceFilterIcon(option: ExperienceFilter): string {
    switch (option) {
      case 'Workspace':
        return 'apartment';
      case 'School':
        return 'school';
      case 'Online Session':
        return 'videocam';
      case 'Additional Project':
        return 'rocket_launch';
      default:
        return 'filter_alt';
    }
  }

  protected experienceFilterClass(option: ExperienceFilter): string {
    switch (option) {
      case 'Workspace':
        return 'experience-filter-workspace';
      case 'School':
        return 'experience-filter-school';
      case 'Online Session':
        return 'experience-filter-online';
      case 'Additional Project':
        return 'experience-filter-project';
      default:
        return 'experience-filter-all';
    }
  }

  protected experienceTypeToneClass(type: ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'experience-filter-workspace';
      case 'School':
        return 'experience-filter-school';
      case 'Online Session':
        return 'experience-filter-online';
      default:
        return 'experience-filter-project';
    }
  }

  protected openExperienceForm(entry?: ExperienceEntry, defaultType: ExperienceEntry['type'] = 'Workspace'): void {
    if (this.controlDisabled) {
      return;
    }
    this.pendingExperienceDeleteId = null;
    this.showExperienceForm = true;
    if (entry) {
      this.editingExperienceId = entry.id;
      this.experienceForm = {
        type: entry.type,
        title: entry.title,
        org: entry.org,
        city: entry.city,
        dateFrom: this.yearMonthToIsoDate(entry.dateFrom),
        dateTo: entry.dateTo === 'Present' ? '' : this.yearMonthToIsoDate(entry.dateTo),
        description: entry.description
      };
      this.syncOverlayState();
      this.cdr.markForCheck();
      return;
    }
    this.editingExperienceId = null;
    this.resetExperienceForm(defaultType);
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  protected closeExperienceForm(): void {
    this.showExperienceForm = false;
    this.editingExperienceId = null;
    this.resetExperienceForm();
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  protected async saveExperienceEntry(): Promise<void> {
    if (this.controlDisabled || !this.canSaveExperienceEntry) {
      return;
    }
    const dateFrom = this.isoDateToYearMonth(this.experienceForm.dateFrom);
    if (!dateFrom) {
      return;
    }
    const dateTo = this.isoDateToYearMonth(this.experienceForm.dateTo) || 'Present';
    const payload: Omit<ExperienceEntry, 'id'> = {
      ...this.experienceForm,
      dateFrom,
      title: this.experienceForm.title.trim(),
      org: this.experienceForm.org.trim(),
      city: this.experienceForm.city.trim(),
      dateTo: dateTo || 'Present',
      description: this.experienceForm.description.trim()
    };
    const nextEntries = this.editingExperienceId
      ? this.experienceEntries.map(item => item.id === this.editingExperienceId ? { ...item, ...payload } : item)
      : [
          ...this.experienceEntries,
          { id: this.createExperienceId(), ...payload }
        ];
    await this.commitExperienceEntries(nextEntries);
    this.showExperienceForm = false;
    this.editingExperienceId = null;
    this.resetExperienceForm();
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  protected requestExperienceDelete(entryId: string): void {
    if (this.controlDisabled) {
      return;
    }
    this.pendingExperienceDeleteId = entryId;
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  protected onExperienceRowSharedMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as {
      row?: ExperienceListRow;
      card?: ExperienceListRow;
      action?: { id?: string };
    } | null | undefined;
    const row = context?.row ?? context?.card;
    if (!row || !context?.action?.id) {
      return;
    }
    const entry = row.entry ?? row.eagerDetail;
    if (!entry) {
      return;
    }
    if (context.action.id === 'edit') {
      this.openExperienceForm(entry);
      return;
    }
    if (context.action.id === 'delete') {
      this.requestExperienceDelete(entry.id);
    }
  }

  protected cancelExperienceDelete(): void {
    this.pendingExperienceDeleteId = null;
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  protected async confirmExperienceDelete(): Promise<void> {
    if (this.controlDisabled || !this.pendingExperienceDeleteId) {
      return;
    }
    const nextEntries = this.experienceEntries.filter(item => item.id !== this.pendingExperienceDeleteId);
    await this.commitExperienceEntries(nextEntries);
    this.pendingExperienceDeleteId = null;
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  private async prepareExperienceImport(file: File): Promise<void> {
    const importToken = ++this.experienceImportToken;
    this.experienceImportDialog = {
      ...this.createEmptyExperienceImportDialogState(),
      visible: true,
      fileName: file.name,
      busy: true,
      progress: {
        stage: 'reading',
        percent: 0,
        label: 'Preparing import preview'
      }
    };
    this.syncOverlayState();
    this.cdr.markForCheck();

    try {
      const draft = await this.userExperiencesService.prepareUserExperienceImport(
        file,
        this.experienceEntries,
        progress => {
          if (importToken !== this.experienceImportToken) {
            return;
          }
          this.experienceImportDialog = {
            ...this.experienceImportDialog,
            visible: true,
            fileName: file.name,
            busy: true,
            progress,
            error: null
          };
          this.cdr.markForCheck();
        }
      );
      if (importToken !== this.experienceImportToken) {
        return;
      }
      this.experienceImportDialog = {
        visible: true,
        fileName: file.name,
        busy: false,
        progress: {
          stage: 'ready',
          percent: 100,
          label: draft.statistics.detectedCount > 0 ? 'Import preview ready' : 'No experience items recognized'
        },
        statistics: draft.statistics,
        warnings: [...draft.warnings],
        error: null,
        draft
      };
      this.syncOverlayState();
      this.cdr.markForCheck();
    } catch (error) {
      if (importToken !== this.experienceImportToken) {
        return;
      }
      this.experienceImportDialog = {
        ...this.createEmptyExperienceImportDialogState(),
        visible: true,
        fileName: file.name,
        error: this.resolveExperienceImportError(error),
        progress: {
          stage: 'ready',
          percent: 100,
          label: 'Import preview unavailable'
        }
      };
      this.syncOverlayState();
      this.cdr.markForCheck();
    }
  }

  private createEmptyExperienceForm(defaultType: ExperienceEntry['type'] = 'Workspace'): Omit<ExperienceEntry, 'id'> {
    return {
      type: defaultType,
      title: '',
      org: '',
      city: '',
      dateFrom: '',
      dateTo: '',
      description: ''
    };
  }

  private resetExperienceForm(defaultType: ExperienceEntry['type'] = 'Workspace'): void {
    this.experienceForm = this.createEmptyExperienceForm(defaultType);
  }

  private yearMonthToIsoDate(value: string): string {
    const parsed = AppUtils.fromYearMonth(value);
    return parsed ? AppUtils.toIsoDate(parsed) : '';
  }

  private isoDateToYearMonth(value: string): string {
    const normalized = `${value ?? ''}`.trim();
    if (/^\d{4}-\d{2}$/.test(normalized)) {
      return normalized;
    }
    const parsed = AppUtils.fromIsoDate(normalized);
    return parsed ? AppUtils.toYearMonth(parsed) : '';
  }

  private createEmptyExperienceImportDialogState(): ExperienceImportDialogState {
    return {
      visible: false,
      fileName: '',
      busy: false,
      progress: {
        stage: 'ready',
        percent: 0,
        label: ''
      },
      statistics: this.createEmptyExperienceImportStatistics(),
      warnings: [],
      error: null,
      draft: null
    };
  }

  private createEmptyExperienceImportStatistics(): ExperienceImportStatistics {
    return {
      detectedCount: 0,
      importedCount: 0,
      duplicateCount: 0,
      countsByType: {
        Workspace: 0,
        School: 0,
        'Online Session': 0,
        'Additional Project': 0
      }
    };
  }

  private async loadExperienceEntriesForList(): Promise<ExperienceEntry[]> {
    if (!this.hasExperienceRoute()) {
      return this.experienceEntries;
    }
    const userId = this.normalizedUserId();
    const routedEntries = await this.userExperiencesService.loadUserExperiences(userId, this.experienceRouteConfig);
    if (
      this.experienceEntries.length > 0
      && this.experienceEntriesSignature(routedEntries) !== this.experienceEntriesSignature(this.experienceEntries)
    ) {
      const seededEntries = await this.userExperiencesService.saveUserExperiences(
        userId,
        this.experienceEntries,
        this.experienceRouteConfig
      );
      this.replaceLocalEntriesWithoutListRefresh(seededEntries);
      return seededEntries;
    }
    this.replaceLocalEntriesWithoutListRefresh(routedEntries);
    return routedEntries;
  }

  private async commitExperienceEntries(
    entries: readonly ExperienceEntry[],
    highlightedIds: readonly string[] | null = null
  ): Promise<void> {
    const savedEntries = await this.saveExperienceEntries(entries);
    this.setLocalEntries(savedEntries, highlightedIds);
    this.emitEntriesChange(savedEntries, highlightedIds ?? undefined);
  }

  private async saveExperienceEntries(entries: readonly ExperienceEntry[]): Promise<ExperienceEntry[]> {
    if (!this.hasExperienceRoute()) {
      return this.cloneExperienceEntries(entries);
    }
    return this.userExperiencesService.saveUserExperiences(
      this.normalizedUserId(),
      entries,
      this.experienceRouteConfig
    );
  }

  private hasExperienceRoute(): boolean {
    return Boolean(this.normalizedUserId() && this.experienceRouteConfig?.mode);
  }

  private normalizedUserId(): string {
    return this.userId.trim();
  }

  private replaceLocalEntriesWithoutListRefresh(entries: readonly ExperienceEntry[]): void {
    const nextEntries = this.cloneExperienceEntries(entries);
    this.experienceEntries = nextEntries;
    this.pruneHighlightedExperienceIds(nextEntries);
  }

  private experienceEntriesSignature(entries: readonly ExperienceEntry[]): string {
    return entries
      .map(entry => [
        entry.id,
        entry.type,
        entry.title,
        entry.org,
        entry.city,
        entry.dateFrom,
        entry.dateTo,
        entry.description
      ].join('\u0001'))
      .join('\u0002');
  }

  private setLocalEntries(entries: readonly ExperienceEntry[], highlightedIds: readonly string[] | null = null): void {
    const nextEntries = this.cloneExperienceEntries(entries);
    this.experienceEntries = nextEntries;
    if (highlightedIds) {
      const validIds = new Set(nextEntries.map(entry => entry.id));
      this.highlightedImportedExperienceIds = new Set(highlightedIds.filter(id => validIds.has(id)));
      this.bumpExperienceRows();
      return;
    }
    this.pruneHighlightedExperienceIds(nextEntries);
    this.bumpExperienceRows();
  }

  private bumpExperienceRows(): void {
    this.experienceEntriesRevision += 1;
    this.syncExperienceSmartListQuery();
  }

  private syncExperienceSmartListQuery(): void {
    this.experienceSmartListQuery = this.createExperienceSmartListQuery();
  }

  private createExperienceSmartListQuery(): Partial<ListQuery<ExperienceListFilters>> {
    return {
      page: 0,
      pageSize: 50,
      filters: {
        type: this.experienceFilter,
        revision: this.experienceEntriesRevision
      }
    };
  }

  private experienceRowsForFilter(
    filter: ExperienceFilter,
    entries: readonly ExperienceEntry[] = this.experienceEntries
  ): ExperienceListRow[] {
    const filtered = entries.filter(item => filter === 'All' || item.type === filter);
    return [...filtered]
      .sort((a, b) => AppUtils.toSortableDate(b.dateFrom) - AppUtils.toSortableDate(a.dateFrom))
      .map(entry => this.toExperienceRow(entry));
  }

  private toExperienceRow(entry: ExperienceEntry): ExperienceListRow {
    return {
      id: entry.id,
      status: entry.type,
      dateIso: entry.dateFrom,
      title: entry.title,
      subtitle: [entry.org, entry.city].filter(Boolean).join(' · '),
      detail: entry.description,
      icon: this.experienceTypeIcon(entry.type),
      surfaceTone: this.experienceRowSurfaceTone(entry.type),
      badges: [
        {
          label: `${entry.dateFrom} - ${entry.dateTo}`,
          tone: 'inverse',
          position: 'top-right'
        },
        ...(
          this.isExperienceEntryHighlighted(entry.id)
            ? [{ label: 'Imported', icon: 'upload_file', tone: 'warning' as const, position: 'top-right' as const }]
            : []
        )
      ],
      menuActions: ['edit', 'delete'],
      entry,
      eagerDetail: entry
    };
  }

  private experienceRowSurfaceTone(type: ExperienceEntry['type']): ExperienceListRow['surfaceTone'] {
    switch (type) {
      case 'Workspace':
        return 'danger';
      case 'School':
        return 'info';
      case 'Online Session':
        return 'success';
      default:
        return 'accent';
    }
  }

  private emitEntriesChange(entries: readonly ExperienceEntry[], highlightedIds?: readonly string[]): void {
    const nextEntries = this.cloneExperienceEntries(entries);
    this.onValueChange(nextEntries);
    this.onTouched();
    this.entriesChange.emit({
      entries: nextEntries,
      highlightedIds: highlightedIds ? [...highlightedIds] : undefined
    });
  }

  private pruneHighlightedExperienceIds(entries: readonly ExperienceEntry[]): void {
    if (this.highlightedImportedExperienceIds.size === 0) {
      return;
    }
    const validIds = new Set(entries.map(entry => entry.id));
    this.highlightedImportedExperienceIds = new Set(
      [...this.highlightedImportedExperienceIds].filter(id => validIds.has(id))
    );
  }

  private cloneExperienceEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries.map(entry => ({ ...entry }));
  }

  private createExperienceId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `exp-${crypto.randomUUID()}`;
    }
    return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private menuItemId(prefix: string, value: string): string {
    return `${prefix}-${AppUtils.normalizeText(value).replace(/[^a-z0-9]+/g, '-')}`;
  }

  private isExperienceFilter(value: string): value is ExperienceFilter {
    return value === 'All' || this.experienceTypeOptions.includes(value as ExperienceEntry['type']);
  }

  private paletteFromProfileTone(toneClass: string): AppMenuPalette {
    switch (toneClass) {
      case 'experience-filter-school':
        return 'blue';
      case 'experience-filter-workspace':
        return 'red';
      case 'experience-filter-online':
        return 'green';
      case 'experience-filter-project':
      case 'experience-filter-all':
        return 'purple';
      default:
        return 'blue';
    }
  }

  private resolveExperienceImportError(error: unknown): string {
    if (error instanceof Error) {
      const normalizedMessage = error.message.trim();
      if (normalizedMessage) {
        return normalizedMessage;
      }
    }
    return 'Invalid document. Please upload a PDF, DOC, DOCX, ODT, RTF, or TXT file.';
  }

  private syncOverlayState(): void {
    const nextOverlayOpen = Boolean(this.showExperienceForm || this.pendingExperienceDeleteId || this.experienceImportDialog.visible);
    if (nextOverlayOpen === this.overlayOpen) {
      return;
    }
    this.overlayOpen = nextOverlayOpen;
    this.overlayStateChange.emit(nextOverlayOpen);
  }
}
