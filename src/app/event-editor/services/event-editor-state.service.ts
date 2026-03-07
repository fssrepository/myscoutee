import { Injectable, signal, computed } from '@angular/core';
import type { 
  EventEditorForm, 
  EventEditorMode, 
  EventEditorTarget,
  SubEventFormItem,
  SubEventTournamentStage,
  SubEventGroupItem,
  SubEventsDisplayMode,
  ActivityListRow
} from '../../shared/app-types';

@Injectable({
  providedIn: 'root'
})
export class EventEditorStateService {
  // Core state
  readonly mode = signal<EventEditorMode>('edit');
  readonly readOnly = signal(false);
  readonly target = signal<EventEditorTarget>('events');
  readonly isStacked = signal(false);
  
  // Form state
  readonly form = signal<EventEditorForm>(this.defaultForm());
  readonly showRequiredValidation = signal(false);
  
  // Sub-events state
  readonly showSubEventForm = signal(false);
  readonly showSubEventGroupForm = signal(false);
  readonly showSubEventRequiredValidation = signal(false);
  readonly displayMode = signal<SubEventsDisplayMode>('Casual');
  readonly showSubEventsDisplayModePicker = signal(false);
  
  // Current editing items
  readonly editingSubEvent = signal<SubEventFormItem | null>(null);
  readonly editingStage = signal<SubEventTournamentStage | null>(null);
  readonly editingGroup = signal<SubEventGroupItem | null>(null);
  
  // Publish confirmation
  readonly publishConfirmContext = signal<'active' | 'stacked' | null>(null);
  
  // Members
  readonly membersRow = signal<ActivityListRow | null>(null);
  
  // Invitation
  readonly invitationId = signal<string | null>(null);
  
  // Computed values
  readonly canSubmit = computed(() => {
    if (this.readOnly()) return false;
    const f = this.form();
    return Boolean(f.title.trim() && f.description.trim() && f.startAt && f.endAt);
  });
  
  readonly canSubmitSubEvent = computed(() => {
    if (this.readOnly()) return false;
    const subEvent = this.editingSubEvent();
    if (!subEvent) return false;
    return Boolean(subEvent.name.trim() && subEvent.startAt && subEvent.endAt);
  });
  
  readonly canSubmitSubEventGroup = computed(() => {
    if (this.readOnly()) return false;
    const stage = this.editingStage();
    if (!stage) return false;
    return true;
  });

  // Actions
  openEditor(options: {
    mode: EventEditorMode;
    target: EventEditorTarget;
    readOnly?: boolean;
    stacked?: boolean;
    invitationId?: string | null;
  }): void {
    this.mode.set(options.mode);
    this.target.set(options.target);
    this.readOnly.set(options.readOnly ?? false);
    this.isStacked.set(options.stacked ?? false);
    this.invitationId.set(options.invitationId ?? null);
    this.showRequiredValidation.set(false);
    this.showSubEventForm.set(false);
    this.showSubEventGroupForm.set(false);
  }
  
  closeEditor(): void {
    this.mode.set('edit');
    this.readOnly.set(false);
    this.target.set('events');
    this.isStacked.set(false);
    this.form.set(this.defaultForm());
    this.showRequiredValidation.set(false);
    this.showSubEventForm.set(false);
    this.showSubEventGroupForm.set(false);
    this.editingSubEvent.set(null);
    this.editingStage.set(null);
    this.editingGroup.set(null);
    this.publishConfirmContext.set(null);
    this.membersRow.set(null);
    this.invitationId.set(null);
  }
  
  updateForm(updates: Partial<EventEditorForm>): void {
    this.form.update(current => ({ ...current, ...updates }));
  }
  
  setForm(form: EventEditorForm): void {
    this.form.set(form);
  }
  
  // Sub-event actions
  openSubEventForm(subEvent?: SubEventFormItem): void {
    this.editingSubEvent.set(subEvent ?? this.createSubEvent());
    this.showSubEventForm.set(true);
    this.showSubEventRequiredValidation.set(false);
  }
  
  closeSubEventForm(): void {
    this.showSubEventForm.set(false);
    this.editingSubEvent.set(null);
  }
  
  saveSubEvent(subEvent: SubEventFormItem): void {
    this.form.update(current => {
      const existingIndex = current.subEvents.findIndex(s => s.id === subEvent.id);
      if (existingIndex >= 0) {
        const newSubEvents = [...current.subEvents];
        newSubEvents[existingIndex] = subEvent;
        return { ...current, subEvents: newSubEvents };
      }
      return { ...current, subEvents: [...current.subEvents, subEvent] };
    });
    this.closeSubEventForm();
  }
  
  deleteSubEvent(id: string): void {
    this.form.update(current => ({
      ...current,
      subEvents: current.subEvents.filter(s => s.id !== id)
    }));
  }
  
  // Stage actions
  openStageForm(stage: SubEventTournamentStage): void {
    this.editingStage.set(stage);
    this.showSubEventGroupForm.set(true);
  }
  
  closeStageForm(): void {
    this.showSubEventGroupForm.set(false);
    this.editingStage.set(null);
  }
  
  // Group actions
  addGroup(): void {
    this.editingGroup.set({ id: `group-${Date.now()}`, name: '' });
  }
  
  saveGroup(group: SubEventGroupItem): void {
    const stage = this.editingStage();
    if (!stage) return;
    
    const updatedGroups = [...(stage.subEvent.groups || []), group];
    const updatedSubEvent = { ...stage.subEvent, groups: updatedGroups };
    
    this.form.update(current => ({
      ...current,
      subEvents: current.subEvents.map(s => 
        s.id === updatedSubEvent.id ? updatedSubEvent : s
      )
    }));
    
    this.editingGroup.set(null);
  }
  
  deleteGroup(groupId: string): void {
    const stage = this.editingStage();
    if (!stage || !stage.subEvent.groups) return;
    
    const updatedGroups = stage.subEvent.groups.filter(g => g.id !== groupId);
    const updatedSubEvent = { ...stage.subEvent, groups: updatedGroups };
    
    this.form.update(current => ({
      ...current,
      subEvents: current.subEvents.map(s => 
        s.id === updatedSubEvent.id ? updatedSubEvent : s
      )
    }));
  }
  
  // Publish confirmation
  openPublishConfirm(context: 'active' | 'stacked'): void {
    this.publishConfirmContext.set(context);
  }
  
  closePublishConfirm(): void {
    this.publishConfirmContext.set(null);
  }
  
  // Display mode
  setDisplayMode(mode: SubEventsDisplayMode): void {
    this.displayMode.set(mode);
    this.showSubEventsDisplayModePicker.set(false);
  }
  
  toggleDisplayModePicker(): void {
    this.showSubEventsDisplayModePicker.update(v => !v);
  }
  
  // Members
  setMembersRow(row: ActivityListRow | null): void {
    this.membersRow.set(row);
  }
  
  // Validation
  validateRequired(): boolean {
    const f = this.form();
    if (!f.title.trim() || !f.description.trim() || !f.startAt || !f.endAt) {
      this.showRequiredValidation.set(true);
      return false;
    }
    this.showRequiredValidation.set(false);
    return true;
  }
  
  validateSubEvent(): boolean {
    const subEvent = this.editingSubEvent();
    if (!subEvent?.name.trim() || !subEvent.startAt || !subEvent.endAt) {
      this.showSubEventRequiredValidation.set(true);
      return false;
    }
    this.showSubEventRequiredValidation.set(false);
    return true;
  }
  
  // Helper to create default form
  private defaultForm(): EventEditorForm {
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
  
  // Create new sub-event
  createSubEvent(): SubEventFormItem {
    const now = new Date();
    const end = new Date(now);
    end.setHours(end.getHours() + 1);
    
    return {
      id: `subevent-${Date.now()}`,
      name: '',
      description: '',
      startAt: now.toISOString(),
      endAt: end.toISOString(),
      location: '',
      optional: false,
      capacityMin: 0,
      capacityMax: 0,
      membersAccepted: 0,
      membersPending: 0,
      carsPending: 0,
      accommodationPending: 0,
      suppliesPending: 0
    };
  }
  
  // Create new tournament stage
  createTournamentStage(subEventId: string): SubEventTournamentStage {
    const subEvent = this.createSubEvent();
    subEvent.id = subEventId;
    subEvent.tournamentGroupCount = 2;
    subEvent.tournamentGroupCapacityMin = 2;
    subEvent.tournamentGroupCapacityMax = 4;
    
    return {
      key: `stage-${Date.now()}`,
      stageNumber: 1,
      title: '',
      subtitle: '',
      description: '',
      rangeLabel: '',
      subEvent,
      groups: [],
      isCurrent: false
    };
  }
}
