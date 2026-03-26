import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-entry-firebase-auth-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule
  ],
  templateUrl: './entry-firebase-auth-popup.component.html',
  styleUrl: './entry-firebase-auth-popup.component.scss'
})
export class EntryFirebaseAuthPopupComponent {
  @Input() open = false;
  @Input() busy = false;
  @Input() isMobileView = false;

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly continueRequested = new EventEmitter<void>();

  protected requestClose(): void {
    this.closeRequested.emit();
  }

  protected requestContinue(): void {
    this.continueRequested.emit();
  }
}
