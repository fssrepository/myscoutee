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
  protected emailMode: AppTypes.FirebaseEmailAuthMode = 'sign-in';
  protected email = '';
  protected password = '';
  protected passwordConfirmation = '';
  protected passwordVisible = false;
  protected passwordConfirmationVisible = false;
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
    this.emailMode = 'sign-in';
    this.emailError = '';
  }

  protected backToProviders(): void {
    if (this.busy) {
      return;
    }
    this.authStep = 'providers';
    this.emailError = '';
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  protected togglePasswordConfirmationVisibility(): void {
    this.passwordConfirmationVisible = !this.passwordConfirmationVisible;
  }

  protected setEmailMode(mode: AppTypes.FirebaseEmailAuthMode): void {
    if (this.busy) {
      return;
    }
    this.emailMode = mode;
    this.emailError = '';
    if (mode === 'sign-in') {
      this.passwordConfirmation = '';
    }
  }

  protected requestEmail(): void {
    if (this.busy) {
      return;
    }
    const normalizedEmail = this.email.trim();
    if (!this.isValidEmail(normalizedEmail)) {
      this.emailError = 'Adj meg érvényes email címet.';
      return;
    }
    if (this.emailMode === 'sign-in' && this.password.length < 6) {
      this.emailError = 'Adj meg legalább 6 karakteres jelszót.';
      return;
    }
    if (this.emailMode === 'create' && !this.isCreatePasswordValid()) {
      this.emailError = 'A fiók létrehozásához teljesítsd a jelszó feltételeit.';
      return;
    }
    if (this.emailMode === 'create' && this.password !== this.passwordConfirmation) {
      this.emailError = 'A két jelszó nem egyezik.';
      return;
    }
    this.emailError = '';
    this.authRequested.emit({
      provider: 'email',
      emailMode: this.emailMode,
      email: normalizedEmail,
      password: this.password
    });
  }

  protected emailSubmitLabel(): string {
    if (this.busy) {
      return 'Kapcsolódás...';
    }
    return this.emailMode === 'create' ? 'Fiók létrehozása' : 'Belépés';
  }

  protected emailPasswordAutocomplete(): string {
    return this.emailMode === 'create' ? 'new-password' : 'current-password';
  }

  protected passwordPlaceholder(): string {
    return this.emailMode === 'create' ? 'Min. 8 karakter, betű és szám' : 'Jelszó';
  }

  protected passwordInputType(): string {
    return this.passwordVisible ? 'text' : 'password';
  }

  protected passwordConfirmationInputType(): string {
    return this.passwordConfirmationVisible ? 'text' : 'password';
  }

  protected passwordStrengthLevel(): number {
    const value = this.password;
    if (!value) {
      return 0;
    }
    const checks = [
      value.length >= 8,
      value.length >= 12,
      /[a-z]/.test(value) && /[A-Z]/.test(value),
      /\d/.test(value),
      /[^A-Za-z0-9]/.test(value)
    ];
    return Math.min(4, Math.max(1, checks.filter(Boolean).length));
  }

  protected passwordStrengthSegments(): number[] {
    return [1, 2, 3, 4];
  }

  protected passwordStrengthText(): string {
    switch (this.passwordStrengthLevel()) {
      case 1:
        return 'Gyenge';
      case 2:
        return 'Alap';
      case 3:
        return 'Jó';
      case 4:
        return 'Erős';
      default:
        return 'Jelszó erőssége';
    }
  }

  protected passwordHasMinimumLength(): boolean {
    return this.password.length >= 8;
  }

  protected passwordHasLetter(): boolean {
    return /\p{L}/u.test(this.password);
  }

  protected passwordHasNumber(): boolean {
    return /\d/.test(this.password);
  }

  protected passwordHasOptionalSymbol(): boolean {
    return /[^\p{L}\d]/u.test(this.password);
  }

  protected passwordConfirmationMatches(): boolean {
    return this.password.length > 0 && this.password === this.passwordConfirmation;
  }

  private isCreatePasswordValid(): boolean {
    return this.passwordHasMinimumLength() && this.passwordHasLetter() && this.passwordHasNumber();
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
