import { Component, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { EventVisibility, EventBlindMode } from '../../../shared/app-types';
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
export class EventEditorComponent implements OnInit {
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() openSubEvents = new EventEmitter<void>();
  @Output() openMembers = new EventEmitter<void>();
  
  protected state = inject(EventEditorStateService);
  
  // Visibility options
  readonly visibilityOptions: EventVisibility[] = ['Public', 'Friends only', 'Invitation only'];
  readonly blindModeOptions: EventBlindMode[] = ['Open Event', 'Blind Event'];
  readonly frequencyOptions = ['One-time', 'Daily', 'Weekly', 'Monthly'];
  
  ngOnInit(): void {
    // Initialize with default form if empty
    const currentForm = this.state.form();
    if (!currentForm.title && !currentForm.description) {
      this.state.setForm(this.state['defaultForm']());
    }
  }
  
  protected get form() {
    return this.state.form();
  }
  
  protected get mode() {
    return this.state.mode();
  }
  
  protected get readOnly() {
    return this.state.readOnly();
  }
  
  protected get showValidation() {
    return this.state.showRequiredValidation();
  }
  
  protected onFieldChange(): void {
    // Form is updated via the service, no need to emit
  }
  
  protected canSubmit(): boolean {
    return this.state.canSubmit();
  }
  
  protected fieldInvalid(field: 'title' | 'description'): boolean {
    if (!this.showValidation) return false;
    return !this.form[field].trim();
  }
  
  protected onSave(): void {
    if (this.state.validateRequired()) {
      this.state.saveAndClose(this.state.form());
      this.save.emit();
    }
  }
  
  protected onCancel(): void {
    this.state.closeEditor();
    this.cancel.emit();
  }
  
  protected onOpenSubEvents(): void {
    this.openSubEvents.emit();
  }
  
  protected onOpenMembers(): void {
    this.openMembers.emit();
  }

  protected onPublishConfirmCancel(): void {
    this.state.closePublishConfirm();
  }

  protected onPublishConfirmClose(): void {
    this.state.closePublishConfirm();
    this.state.closeEditor();
    this.cancel.emit();
  }
  
  protected onVisibilityChange(visibility: EventVisibility): void {
    this.state.updateForm({ visibility });
  }
  
  protected onTopicsChange(topics: string[]): void {
    this.state.updateForm({ topics });
  }
  
  protected onFrequencyChange(frequency: string): void {
    this.state.updateForm({ frequency });
  }
  
  protected onBlindModeChange(blindMode: EventBlindMode): void {
    this.state.updateForm({ blindMode });
  }
  
  protected onTitleChange(value: string): void {
    this.state.updateForm({ title: value });
  }
  
  protected onDescriptionChange(value: string): void {
    this.state.updateForm({ description: value });
  }
  
  protected onLocationChange(value: string): void {
    this.state.updateForm({ location: value });
  }
  
  protected onCapacityMinChange(value: string): void {
    const num = parseInt(value, 10);
    this.state.updateForm({ capacityMin: isNaN(num) ? null : num });
  }
  
  protected onCapacityMaxChange(value: string): void {
    const num = parseInt(value, 10);
    this.state.updateForm({ capacityMax: isNaN(num) ? null : num });
  }
  
  protected onStartAtChange(value: string): void {
    this.state.updateForm({ startAt: value });
  }
  
  protected onEndAtChange(value: string): void {
    this.state.updateForm({ endAt: value });
  }
  
  protected getTitle(): string {
    if (this.mode === 'create') return 'Create Event';
    return this.readOnly ? 'View Event' : 'Edit Event';
  }
  
  protected getVisibilityClass(): string {
    switch (this.form.visibility) {
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
      this.state.updateForm({ imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  }
  
  protected onAutoInviterChange(): void {
    this.state.updateForm({ autoInviter: !this.form.autoInviter });
  }
  
  protected onTicketingChange(): void {
    this.state.updateForm({ ticketing: !this.form.ticketing });
  }
}
