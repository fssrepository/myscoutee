import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  type AppMenuItem,
  PopupComponent,
  type PopupMenuSelectEvent,
  type PopupModel,
  FormFlowComponent,
  type FormFlowModel
} from '@fssrepository/myscoutee-components';

export interface GroupFormModel {
  name: string;
  capacityMin: number;
  capacityMax: number;
}

@Component({
  selector: 'app-event-subevent-group-form-popup',
  standalone: true,
  imports: [FormsModule, PopupComponent, FormFlowComponent],
  templateUrl: './event-subevent-group-form-popup.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./event-subevent-group-form-popup.component.scss']
})
export class EventSubeventGroupFormPopupComponent {
  @Input() open = false;
  @Input() title = 'Create Group';
  @Input() stageTitle = '';
  @Input() canSave = false;
  @Input() invalidName = false;
  @Input() saving = false;
  @Input() model: GroupFormModel = {
    name: '',
    capacityMin: 4,
    capacityMax: 7
  };

  @Output() readonly save = new EventEmitter<Event>();
  @Output() readonly cancelled = new EventEmitter<Event>();
  @Output() readonly modelChange = new EventEmitter<GroupFormModel>();

  protected groupPopupModel(): PopupModel<unknown> {
    return {
      title: this.title,
      subtitle: this.stageTitle || null,
      ariaLabel: this.title,
      closeAriaLabel: 'event.group.editor.close.aria',
      closeOnBackdrop: true,
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      bodyLayout: 'overflow',
      backdropTone: 'dim',
      headerControls: [{
        kind: 'menu',
        id: 'group-save',
        menuKind: 'inline',
        items: this.saveMenuItems(),
        closeOnSelect: false
      }],
      onClose: event => this.cancelled.emit(event),
      onMenuSelect: event => this.onSaveMenuSelect(event)
    };
  }

  protected saveMenuItems(): readonly AppMenuItem<'save-group'>[] {
    return [{
      id: 'save-group',
      icon: 'done',
      kind: 'action',
      palette: this.saving || this.canSave ? 'success' : 'danger',
      disabled: !this.canSave || this.saving,
      ariaLabel: 'event.group.editor.save.action',
      progress: this.saving
        ? {
            state: 'loading',
            shape: 'circle'
          }
        : null
    }];
  }

  private onSaveMenuSelect(event: PopupMenuSelectEvent<unknown>): void {
    if (event.itemSelect.id === 'save-group') {
      this.save.emit(event.itemSelect.sourceEvent);
    }
  }

  protected flowModel(): FormFlowModel {
    return {
      title: this.title,
      subtitle: this.stageTitle,
      layout: 'grouped',
      header: false,
      summary: { enabled: false },
      completion: { controls: 'required' },
      save: null,
      steps: [
        {
          id: 'group',
          title: 'group',
          controls: [
            {
              id: 'name',
              bind: 'name',
              kind: 'text',
              layout: 'wide',
              label: 'name',
              placeholder: 'event.group.editor.name.label',
              required: true
            },
            {
              id: 'capacityMin',
              bind: 'capacityMin',
              kind: 'number',
              layout: 'half',
              label: 'event.subevents.group.capacity.min',
              min: 0,
              step: 1,
              required: true
            },
            {
              id: 'capacityMax',
              bind: 'capacityMax',
              kind: 'number',
              layout: 'half',
              label: 'event.subevents.group.capacity.max',
              min: Math.max(0, Math.trunc(Number(this.model.capacityMin) || 0)),
              step: 1,
              required: true
            }
          ]
        }
      ]
    };
  }

  protected onFlowValueChange(value: unknown): void {
    const record = this.isRecord(value) ? value : {};
    const capacityMin = Math.max(0, Math.trunc(Number(record['capacityMin']) || 0));
    const capacityMax = Math.max(capacityMin, Math.trunc(Number(record['capacityMax']) || capacityMin));
    const nextModel = {
      name: `${record['name'] ?? ''}`,
      capacityMin,
      capacityMax
    };
    this.model = nextModel;
    this.modelChange.emit(nextModel);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
