import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  FormFlowComponent,
  type FormFlowModel
} from '../../../flow';
import {
  FormFlowPopupStore,
  type FormFlowPolicyEditorPopupState
} from '../../../flow/form-flow-popup.store';
import {
  PopupComponent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../../../../popup';

interface PolicyEditorValue {
  id: string;
  title: string;
  description: string;
  required: boolean;
}

@Component({
  selector: 'app-policies-input-popup',
  standalone: true,
  imports: [
    FormsModule,
    FormFlowComponent,
    PopupComponent
  ],
  templateUrl: './policies-input-popup.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoliciesInputPopupComponent implements OnChanges {
  @Input() popup: FormFlowPolicyEditorPopupState | null = null;

  protected draftValue: PolicyEditorValue = this.emptyValue();
  private readonly popupStore = inject(FormFlowPopupStore);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['popup'] && this.popup) {
      this.draftValue = this.normalizeValue(this.popup.value);
    }
  }

  protected popupModel(popup: FormFlowPolicyEditorPopupState): PopupModel<unknown> {
    return {
      title: popup.title,
      subtitle: popup.subtitle,
      ariaLabel: popup.title,
      closeAriaLabel: 'Close policy form',
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      backdropTone: 'dim',
      headerControls: this.headerControls(popup),
      onClose: event => this.close(popup, event),
      onMenuSelect: event => this.onMenuSelect(popup, event)
    };
  }

  protected flowModel(popup: FormFlowPolicyEditorPopupState): FormFlowModel {
    return {
      title: popup.title,
      subtitle: popup.subtitle,
      layout: 'grouped',
      header: false,
      summary: { enabled: false },
      completion: { controls: 'required' },
      save: null,
      steps: [{
        id: 'policy',
        title: '',
        chrome: 'none',
        controls: [
          {
            id: 'title',
            bind: 'title',
            kind: 'text',
            layout: 'wide',
            label: 'Title',
            placeholder: 'Policy title',
            required: true
          },
          {
            id: 'description',
            bind: 'description',
            kind: 'textarea',
            layout: 'wide',
            label: 'Description',
            placeholder: 'Explain the policy clearly.',
            rows: 6,
            required: true
          },
          {
            id: 'required',
            bind: 'required',
            kind: 'checkbox',
            layout: 'wide',
            label: popup.requiredCheckboxLabel
          }
        ]
      }]
    };
  }

  protected updateDraft(value: unknown): void {
    this.draftValue = this.normalizeValue(value, this.draftValue.id);
  }

  private headerControls(popup: FormFlowPolicyEditorPopupState): readonly PopupControl<unknown>[] {
    if (popup.readOnly) {
      return [];
    }
    return [{
      kind: 'menu',
      id: 'policy-editor-actions',
      menuKind: 'inline',
      closeOnSelect: false,
      items: [{
        id: 'policy-save',
        icon: 'done',
        kind: 'action',
        palette: 'green',
        disabled: !this.canSave(),
        closeOnSelect: false,
        ariaLabel: 'Save policy'
      }]
    }];
  }

  private onMenuSelect(
    popup: FormFlowPolicyEditorPopupState,
    event: PopupMenuSelectEvent<unknown>
  ): void {
    if (event.itemSelect.id === 'policy-save' && this.canSave()) {
      this.popupStore.requestPolicyEditorPopupSave(popup.ownerId, this.draftValue, event.itemSelect.sourceEvent);
    }
  }

  private close(popup: FormFlowPolicyEditorPopupState, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.popupStore.requestPolicyEditorPopupClose(popup.ownerId, event);
  }

  private canSave(): boolean {
    return this.draftValue.title.trim().length > 0
      && this.draftValue.description.trim().length > 0;
  }

  private normalizeValue(value: unknown, fallbackId = ''): PolicyEditorValue {
    const record = value && typeof value === 'object'
      ? value as Record<string, unknown>
      : {};
    return {
      id: `${record['id'] ?? fallbackId}`,
      title: `${record['title'] ?? ''}`,
      description: `${record['description'] ?? ''}`,
      required: record['required'] !== false
    };
  }

  private emptyValue(): PolicyEditorValue {
    return {
      id: '',
      title: '',
      description: '',
      required: true
    };
  }
}
