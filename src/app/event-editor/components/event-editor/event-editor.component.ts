import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { EventEditorForm, EventEditorMode, EventEditorTarget, EventVisibility, EventBlindMode } from '../../../shared/app-types';
import { EventEditorStateService } from '../../services/event-editor-state.service';

@Component({
  selector: 'app-event-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './event-editor.component.html',
  styleUrls: ['./event-editor.component.scss']
})
export class EventEditorComponent implements OnChanges {
  @Input() mode: EventEditorMode = 'edit';
  @Input() readOnly = false;
  @Input() target: EventEditorTarget = 'events';
  @Input() isStacked = false;
  @Input() form!: EventEditorForm;
  @Input() showValidation = false;
  
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() formChange = new EventEmitter<EventEditorForm>();
  @Output() openSubEvents = new EventEmitter<void>();
  @Output() openMembers = new EventEmitter<void>();
  @Output() visibilityChange = new EventEmitter<EventVisibility>();
  @Output() topicsChange = new EventEmitter<string[]>();
  @Output() frequencyChange = new EventEmitter<string>();
  @Output() blindModeChange = new EventEmitter<EventBlindMode>();
  
  protected state = inject(EventEditorStateService);
  
  // Visibility options
  readonly visibilityOptions: EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
  readonly blindModeOptions: EventBlindMode[] = ['Open Event', 'Blind Event'];
  readonly frequencyOptions = ['One-time', 'Daily', 'Weekly', 'Monthly'];
  
  // Track local form state
  protected localForm: EventEditorForm = this.getEmptyForm();
  
  ngOnChanges(): void {
    if (this.form) {
      this.localForm = { ...this.form };
    }
  }
  
  protected onFieldChange(): void {
    this.formChange.emit(this.localForm);
  }
  
  protected canSubmit(): boolean {
    if (this.readOnly) return false;
    return Boolean(
      this.localForm.title.trim() && 
      this.localForm.description.trim() && 
      this.localForm.startAt && 
      this.localForm.endAt
    );
  }
  
  protected fieldInvalid(field: 'title' | 'description'): boolean {
    if (!this.showValidation) return false;
    return !this.localForm[field].trim();
  }
  
  protected onSave(): void {
    this.formChange.emit(this.localForm);
    this.save.emit();
  }
  
  protected onCancel(): void {
    this.cancel.emit();
  }
  
  protected onOpenSubEvents(): void {
    this.openSubEvents.emit();
  }
  
  protected onOpenMembers(): void {
    this.openMembers.emit();
  }
  
  protected onVisibilityChange(visibility: EventVisibility): void {
    this.localForm.visibility = visibility;
    this.visibilityChange.emit(visibility);
    this.onFieldChange();
  }
  
  protected onTopicsChange(topics: string[]): void {
    this.localForm.topics = topics;
    this.topicsChange.emit(topics);
    this.onFieldChange();
  }
  
  protected onFrequencyChange(frequency: string): void {
    this.localForm.frequency = frequency;
    this.frequencyChange.emit(frequency);
    this.onFieldChange();
  }
  
  protected onBlindModeChange(blindMode: EventBlindMode): void {
    this.localForm.blindMode = blindMode;
    this.blindModeChange.emit(blindMode);
    this.onFieldChange();
  }
  
  protected getTitle(): string {
    if (this.mode === 'create') return 'Create Event';
    return this.readOnly ? 'View Event' : 'Edit Event';
  }
  
  protected getVisibilityClass(): string {
    switch (this.localForm.visibility) {
      case 'Public': return 'visibility-public';
      case 'Friends only': return 'visibility-friends';
      case 'Invitation only': return 'visibility-invite';
      default: return '';
    }
  }
  
  protected triggerEventImageUpload(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const input = document.querySelector('#event-image-input') as HTMLInputElement;
    input?.click();
  }
  
  protected onImageFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.localForm.imageUrl = reader.result as string;
      this.onFieldChange();
    };
    reader.readAsDataURL(file);
  }
  
  private getEmptyForm(): EventEditorForm {
    const now = new Date();
    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    
    return {
      title: '',
      description: '',
      imageUrl: '',
      capacityMin: null,
      capacityMax: null,
      startAt: now.toISOString(),
      endAt: end.toISOString(),
      location: '',
      frequency: 'One-time',
      visibility: 'Public',
      blindMode: 'Open Event',
      autoInviter: false,
      ticketing: false,
      topics: [],
      subEvents: []
    };
  }
}
