import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AppMenuComponent, type AppMenuItem, type AppMenuItemSelectEvent } from '../../../../shared/ui';
import type { CapacityEditorState } from '../../../../shared/ui/context/sub-event-resource-popup.types';

type CapacityEditorMenuContext = { menu: 'save' };

@Component({
  selector: 'app-event-resource-capacity-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, AppMenuComponent],
  templateUrl: './event-resource-capacity-editor.component.html',
  styleUrl: './event-resource-capacity-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventResourceCapacityEditorComponent {
  @Input() editor: CapacityEditorState | null = null;

  @Output() closeRequested = new EventEmitter<Event | undefined>();
  @Output() saveRequested = new EventEmitter<Event | undefined>();
  @Output() minChanged = new EventEmitter<number | string>();
  @Output() maxChanged = new EventEmitter<number | string>();

  protected isSavePending(editor: CapacityEditorState): boolean {
    return editor.busy === true;
  }

  protected saveErrorMessage(editor: CapacityEditorState): string {
    return editor.error?.trim() ?? '';
  }

  protected canSubmit(editor: CapacityEditorState): boolean {
    return !editor.busy
      && editor.capacityMin <= editor.capacityMax
      && editor.capacityMax <= editor.capacityLimit;
  }

  protected capacityEditorSaveMenuItems(editor: CapacityEditorState): readonly AppMenuItem<string, CapacityEditorMenuContext>[] {
    const canSave = this.canSubmit(editor);
    const hasError = this.saveErrorMessage(editor).length > 0;
    return [{
      id: 'capacity-editor-save',
      icon: 'done',
      layout: 'action',
      palette: hasError || (!canSave && !this.isSavePending(editor)) ? 'danger' : 'success',
      disabled: !canSave,
      ariaLabel: 'Save capacity',
      progress: this.isSavePending(editor)
        ? { state: 'loading', shape: 'circle' }
        : (hasError ? { state: 'error', shape: 'circle' } : null),
      context: { menu: 'save' }
    }];
  }

  protected onCapacityEditorMenuSelect(event: AppMenuItemSelectEvent<string, CapacityEditorMenuContext>): void {
    if (event.context?.menu === 'save') {
      this.save(event.sourceEvent);
    }
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.closeRequested.emit(event);
  }

  protected save(event?: Event): void {
    event?.stopPropagation();
    this.saveRequested.emit(event);
  }
}
