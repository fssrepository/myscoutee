import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { GDPR_CONTENT } from '../../../shared/gdpr-data';

@Component({
  selector: 'app-entry-consent-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './entry-consent-popup.component.html',
  styleUrl: './entry-consent-popup.component.scss'
})
export class EntryConsentPopupComponent {
  @Input() open = false;
  @Input() viewOnly = false;

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly acceptRequested = new EventEmitter<void>();
  @Output() readonly rejectRequested = new EventEmitter<void>();

  protected readonly gdprContent = GDPR_CONTENT;

  protected requestClose(): void {
    this.closeRequested.emit();
  }

  protected requestAccept(): void {
    this.acceptRequested.emit();
  }

  protected requestReject(): void {
    this.rejectRequested.emit();
  }
}
