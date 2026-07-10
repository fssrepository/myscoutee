import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  type AppMenuItem,
  PopupComponent,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../../../shared/ui';
import { FormFlowComponent, type FormFlowModel } from '../../../shared/ui/components/core/form/flow';

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
  @Output() readonly cancel = new EventEmitter<Event>();
  @Output() readonly modelChange = new EventEmitter<GroupFormModel>();

  protected groupPopupModel(): PopupModel<unknown> {
    return {
      title: this.title,
      subtitle: this.stageTitle || null,
      ariaLabel: this.title,
      closeAriaLabel: 'Close group form',
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
      onClose: event => this.cancel.emit(event),
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
      ariaLabel: 'Save group',
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
          title: 'Group',
          controls: [
            {
              id: 'name',
              bind: 'name',
              kind: 'text',
              layout: 'wide',
              label: 'Név',
              placeholder: 'Group name',
              required: true
            },
            {
              id: 'capacityMin',
              bind: 'capacityMin',
              kind: 'number',
              layout: 'half',
              label: 'Minimum létszám',
              min: 0,
              step: 1,
              required: true
            },
            {
              id: 'capacityMax',
              bind: 'capacityMax',
              kind: 'number',
              layout: 'half',
              label: 'Maximum létszám',
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
