import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AlertService {
  readonly message = signal<string | null>(null);

  open(message: string) {
    this.message.set(message);
  }

  close() {
    this.message.set(null);
  }
}
