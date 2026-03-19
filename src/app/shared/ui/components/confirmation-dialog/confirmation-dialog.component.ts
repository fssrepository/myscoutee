import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';

import { ConfirmationDialogService } from '../../services/confirmation-dialog.service';

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss'
})
export class ConfirmationDialogComponent {
  protected readonly dialogService = inject(ConfirmationDialogService);
  protected readonly dialog = this.dialogService.dialog;

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    const dialog = this.dialog();
    if (!dialog || keyboardEvent.defaultPrevented || !dialog.allowEscapeClose) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    this.dialogService.cancel();
  }

  protected closeFromBackdrop(event: Event): void {
    event.stopPropagation();
    if (!this.dialog()?.allowBackdropClose) {
      return;
    }
    this.dialogService.cancel();
  }

  protected cancel(event?: Event): void {
    event?.stopPropagation();
    this.dialogService.cancel();
  }

  protected confirm(event?: Event): void {
    event?.stopPropagation();
    this.dialogService.confirm();
  }
}
