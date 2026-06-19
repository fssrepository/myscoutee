import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DateAdapter, MAT_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';

import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppCalendarDateAdapter, AppCalendarDateFormats } from '../../../app-calendar-date-adapter';
import { AppUtils } from '../../../app-utils';
import { UserExperiencesService } from '../../../core';
import type {
  ExperienceEntry,
  ExperienceFilter,
  ExperienceImportProgressState,
  ExperienceImportStatistics,
  UserExperienceImportDraft
} from '../../../core/contracts/profile.interface';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../menu';

type ProfileExperienceManagerMenuId = string;

type ProfileExperienceManagerMenuContext =
  | { kind: 'experienceFilter'; value: ExperienceFilter }
  | { kind: 'experienceType'; value: ExperienceEntry['type'] }
  | { kind: 'experienceQuickAction'; action: 'create' | 'upload' };

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
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatNativeDateModule,
    AppMenuComponent
  ],
  providers: [
    { provide: DateAdapter, useClass: AppCalendarDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: AppCalendarDateFormats.dateOnly }
  ],
  templateUrl: './profile-experience-manager.component.html',
  styleUrl: './profile-experience-manager.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileExperienceManagerComponent implements OnChanges {
  @Input() entries: readonly ExperienceEntry[] = [];
  @Input() initialFilter: ExperienceFilter = 'All';
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

  protected readonly experienceFilterOptions = APP_STATIC_DATA.experienceFilterOptions;
  protected readonly experienceTypeOptions = APP_STATIC_DATA.experienceTypeOptions;

  protected experienceEntries: ExperienceEntry[] = [];
  protected experienceFilter: ExperienceFilter = 'All';
  protected showExperienceForm = false;
  protected editingExperienceId: string | null = null;
  protected pendingExperienceDeleteId: string | null = null;
  protected highlightedImportedExperienceIds = new Set<string>();
  protected experienceImportDialog: ExperienceImportDialogState = this.createEmptyExperienceImportDialogState();
  protected experienceRangeStart: Date | null = null;
  protected experienceRangeEnd: Date | null = null;
  protected experienceForm: Omit<ExperienceEntry, 'id'> = this.createEmptyExperienceForm();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entries']) {
      this.setLocalEntries(this.entries);
    }
    if (changes['initialFilter']) {
      this.setFilter(this.initialFilter);
    }
  }

  protected get filteredExperienceEntries(): ExperienceEntry[] {
    const filtered = this.experienceEntries.filter(item => this.experienceFilter === 'All' || item.type === this.experienceFilter);
    return [...filtered].sort((a, b) => AppUtils.toSortableDate(b.dateFrom) - AppUtils.toSortableDate(a.dateFrom));
  }

  protected get canSaveExperienceEntry(): boolean {
    return Boolean(this.experienceForm.title.trim() && this.experienceForm.org.trim() && this.experienceRangeStart);
  }

  protected get canSubmitExperienceImport(): boolean {
    return !this.experienceImportDialog.busy
      && !this.experienceImportDialog.error
      && (this.experienceImportDialog.draft?.importedIds.length ?? 0) > 0;
  }

  openCreate(defaultType: ExperienceEntry['type'] = 'Workspace'): void {
    this.openExperienceForm(undefined, defaultType);
  }

  openImport(): void {
    if (!this.allowImport) {
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
        this.experienceForm.type = context.value;
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

  protected submitExperienceImport(): void {
    if (!this.canSubmitExperienceImport || !this.experienceImportDialog.draft) {
      return;
    }
    const draft = this.experienceImportDialog.draft;
    this.setLocalEntries(draft.nextEntries, draft.importedIds);
    this.experienceFilter = 'All';
    this.experienceImportDialog = this.createEmptyExperienceImportDialogState();
    this.emitEntriesChange(this.experienceEntries, draft.importedIds);
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
      shape: 'field',
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
      shape: 'field',
      ariaLabel: 'Open experience type selector'
    };
  }

  protected experienceTypeMenuItems(): readonly AppMenuItem<ProfileExperienceManagerMenuId, ProfileExperienceManagerMenuContext>[] {
    return this.experienceTypeOptions.map(option => ({
      id: this.menuItemId('experience-type', option),
      label: option,
      icon: this.experienceTypeIcon(option),
      kind: 'radio',
      active: option === this.experienceForm.type,
      palette: this.paletteFromProfileTone(this.experienceTypeToneClass(option)),
      surface: 'tinted',
      context: { kind: 'experienceType', value: option }
    }));
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

  protected experienceTypeClass(type: ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'experience-card-workspace';
      case 'School':
        return 'experience-card-school';
      case 'Online Session':
        return 'experience-card-online';
      default:
        return 'experience-card-project';
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
    this.pendingExperienceDeleteId = null;
    this.showExperienceForm = true;
    if (entry) {
      this.editingExperienceId = entry.id;
      this.experienceForm = {
        type: entry.type,
        title: entry.title,
        org: entry.org,
        city: entry.city,
        dateFrom: entry.dateFrom,
        dateTo: entry.dateTo === 'Present' ? '' : entry.dateTo,
        description: entry.description
      };
      this.experienceRangeStart = AppUtils.fromYearMonth(entry.dateFrom);
      this.experienceRangeEnd = entry.dateTo === 'Present' ? null : AppUtils.fromYearMonth(entry.dateTo);
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

  protected saveExperienceEntry(): void {
    if (!this.canSaveExperienceEntry) {
      return;
    }
    const dateFrom = this.experienceRangeStart ? AppUtils.toYearMonth(this.experienceRangeStart) : '';
    if (!dateFrom) {
      return;
    }
    const dateTo = this.experienceRangeEnd ? AppUtils.toYearMonth(this.experienceRangeEnd) : 'Present';
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
    this.setLocalEntries(nextEntries);
    this.showExperienceForm = false;
    this.editingExperienceId = null;
    this.resetExperienceForm();
    this.emitEntriesChange(nextEntries);
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  protected requestExperienceDelete(entryId: string): void {
    this.pendingExperienceDeleteId = entryId;
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  protected cancelExperienceDelete(): void {
    this.pendingExperienceDeleteId = null;
    this.syncOverlayState();
    this.cdr.markForCheck();
  }

  protected confirmExperienceDelete(): void {
    if (!this.pendingExperienceDeleteId) {
      return;
    }
    const nextEntries = this.experienceEntries.filter(item => item.id !== this.pendingExperienceDeleteId);
    this.setLocalEntries(nextEntries);
    this.pendingExperienceDeleteId = null;
    this.emitEntriesChange(nextEntries);
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
    this.experienceRangeStart = null;
    this.experienceRangeEnd = null;
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

  private setLocalEntries(entries: readonly ExperienceEntry[], highlightedIds: readonly string[] | null = null): void {
    const nextEntries = this.cloneExperienceEntries(entries);
    this.experienceEntries = nextEntries;
    if (highlightedIds) {
      const validIds = new Set(nextEntries.map(entry => entry.id));
      this.highlightedImportedExperienceIds = new Set(highlightedIds.filter(id => validIds.has(id)));
      return;
    }
    this.pruneHighlightedExperienceIds(nextEntries);
  }

  private emitEntriesChange(entries: readonly ExperienceEntry[], highlightedIds?: readonly string[]): void {
    this.entriesChange.emit({
      entries: this.cloneExperienceEntries(entries),
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
