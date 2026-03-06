import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ExperienceEntry } from '../profile-editor.types';

type ExperienceFilter = 'All' | 'Workspace' | 'School';

@Component({
  selector: 'app-profile-editor-experience-screen',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './profile-editor-experience-screen.component.html',
  styleUrl: './profile-editor-experience-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileEditorExperienceScreenComponent implements OnChanges {
  @Input({ required: true }) entries: ExperienceEntry[] = [];
  @Input() preferredFilter: ExperienceFilter = 'All';

  @Output() entriesChange = new EventEmitter<ExperienceEntry[]>();

  protected readonly filterOptions: ExperienceFilter[] = ['All', 'Workspace', 'School'];
  protected readonly typeOptions: Array<ExperienceEntry['type']> = ['Workspace', 'School', 'Online Session', 'Additional Project'];

  protected filter: ExperienceFilter = 'All';
  protected editingExperienceId: string | null = null;
  protected pendingDeleteId: string | null = null;
  protected showForm = false;
  protected rangeStart: Date | null = null;
  protected rangeEnd: Date | null = null;
  protected form: Omit<ExperienceEntry, 'id'> = {
    type: 'Workspace',
    title: '',
    org: '',
    city: '',
    dateFrom: '',
    dateTo: '',
    description: ''
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['preferredFilter'] && this.preferredFilter !== this.filter) {
      this.filter = this.preferredFilter;
    }
  }

  protected get filteredEntries(): ExperienceEntry[] {
    const filtered = this.entries.filter(item => {
      if (this.filter === 'All') {
        return true;
      }
      return item.type === this.filter;
    });
    return [...filtered].sort((a, b) => this.toSortableDate(b.dateFrom) - this.toSortableDate(a.dateFrom));
  }

  protected openForm(entry?: ExperienceEntry): void {
    this.pendingDeleteId = null;
    this.showForm = true;
    if (entry) {
      this.editingExperienceId = entry.id;
      this.form = {
        type: entry.type,
        title: entry.title,
        org: entry.org,
        city: entry.city,
        dateFrom: entry.dateFrom,
        dateTo: entry.dateTo === 'Present' ? '' : entry.dateTo,
        description: entry.description
      };
      this.rangeStart = this.fromYearMonth(entry.dateFrom);
      this.rangeEnd = entry.dateTo === 'Present' ? null : this.fromYearMonth(entry.dateTo);
      return;
    }
    this.editingExperienceId = null;
    this.resetForm();
  }

  protected closeForm(): void {
    this.showForm = false;
    this.editingExperienceId = null;
    this.resetForm();
  }

  protected saveEntry(): void {
    if (!this.form.title.trim() || !this.form.org.trim() || !this.rangeStart) {
      return;
    }
    const dateFrom = this.toYearMonth(this.rangeStart);
    if (!dateFrom) {
      return;
    }
    const dateTo = this.rangeEnd ? this.toYearMonth(this.rangeEnd) : 'Present';
    const payload: Omit<ExperienceEntry, 'id'> = {
      ...this.form,
      dateFrom,
      title: this.form.title.trim(),
      org: this.form.org.trim(),
      city: this.form.city.trim(),
      dateTo: dateTo || 'Present',
      description: this.form.description.trim()
    };
    if (this.editingExperienceId) {
      this.entries = this.entries.map(item =>
        item.id === this.editingExperienceId
          ? {
              ...item,
              ...payload
            }
          : item
      );
    } else {
      this.entries = [
        ...this.entries,
        {
          id: `exp-${Date.now()}`,
          ...payload
        }
      ];
    }
    this.entriesChange.emit(this.entries);
    this.showForm = false;
    this.editingExperienceId = null;
    this.resetForm();
  }

  protected requestDelete(entryId: string): void {
    this.pendingDeleteId = entryId;
  }

  protected cancelDelete(): void {
    this.pendingDeleteId = null;
  }

  protected confirmDelete(): void {
    if (!this.pendingDeleteId) {
      return;
    }
    this.entries = this.entries.filter(item => item.id !== this.pendingDeleteId);
    this.entriesChange.emit(this.entries);
    this.pendingDeleteId = null;
  }

  protected typeIcon(type: ExperienceEntry['type']): string {
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

  protected typeClass(type: ExperienceEntry['type']): string {
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

  protected filterIcon(option: ExperienceFilter): string {
    if (option === 'Workspace') {
      return 'apartment';
    }
    if (option === 'School') {
      return 'school';
    }
    return 'filter_alt';
  }

  protected filterClass(option: ExperienceFilter): string {
    if (option === 'Workspace') {
      return 'experience-filter-workspace';
    }
    if (option === 'School') {
      return 'experience-filter-school';
    }
    return 'experience-filter-all';
  }

  protected typeToneClass(type: ExperienceEntry['type']): string {
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

  private resetForm(): void {
    this.form = {
      type: 'Workspace',
      title: '',
      org: '',
      city: '',
      dateFrom: '',
      dateTo: '',
      description: ''
    };
    this.rangeStart = null;
    this.rangeEnd = null;
  }

  private fromYearMonth(value: string): Date | null {
    if (!value || value === 'Present') {
      return null;
    }
    const match = value.trim().match(/^(\d{4})[/-](\d{1,2})(?:[/-](\d{1,2}))?$/);
    if (!match) {
      return null;
    }
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = match[3] ? Number.parseInt(match[3], 10) : 1;
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  private toYearMonth(value: Date | null): string {
    if (!value) {
      return '';
    }
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  private toSortableDate(value: string): number {
    if (!value) {
      return Number.POSITIVE_INFINITY;
    }
    const safe = value.replace(/\//g, '-');
    const direct = new Date(safe);
    if (!Number.isNaN(direct.getTime())) {
      return direct.getTime();
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
      return new Date(`${safe}T00:00:00`).getTime();
    }
    if (/^\d{4}-\d{2}$/.test(safe)) {
      return new Date(`${safe}-01T00:00:00`).getTime();
    }
    return Number.POSITIVE_INFINITY;
  }
}

