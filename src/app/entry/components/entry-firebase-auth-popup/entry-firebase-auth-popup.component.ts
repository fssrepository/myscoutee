import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';

import type * as AppTypes from '../../../shared/core/base/models';

@Component({
  selector: 'app-entry-firebase-auth-popup',
  standalone: true,
  imports: [
    FormsModule,
    MatRippleModule,
    MatIconModule
  ],
  templateUrl: './entry-firebase-auth-popup.component.html',
  styleUrl: './entry-firebase-auth-popup.component.scss'
})
export class EntryFirebaseAuthPopupComponent {
  @Input() open = false;
  @Input() busy = false;
  @Input() isMobileView = false;
  @Input() statusMessage = '';

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly authRequested = new EventEmitter<AppTypes.FirebaseAuthRequest>();

  protected authStep: 'providers' | 'email' = 'providers';
  protected email = '';
  protected password = '';
  protected emailError = '';

  protected requestClose(): void {
    this.closeRequested.emit();
  }

  protected requestProvider(provider: Exclude<AppTypes.FirebaseAuthProvider, 'email'>): void {
    this.emailError = '';
    this.authRequested.emit({ provider });
  }

  protected openEmail(): void {
    if (this.busy) {
      return;
    }
    this.authStep = 'email';
    this.emailError = '';
  }

  protected backToProviders(): void {
    if (this.busy) {
      return;
    }
    this.authStep = 'providers';
    this.emailError = '';
  }

  protected requestEmail(): void {
    if (this.busy) {
      return;
    }
    const normalizedEmail = this.email.trim();
    if (!this.isValidEmail(normalizedEmail) || this.password.length < 6) {
      this.emailError = 'Enter a valid email and at least 6 password characters.';
      return;
    }
    this.emailError = '';
    this.authRequested.emit({
      provider: 'email',
      email: normalizedEmail,
      password: this.password
    });
  }

  protected emailSubmitLabel(): string {
    if (this.busy) {
      return 'Connecting...';
    }
    return 'Continue with email';
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
