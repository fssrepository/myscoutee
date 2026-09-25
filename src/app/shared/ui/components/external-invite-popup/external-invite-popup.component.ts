import { Component, effect, inject, signal, untracked } from '@angular/core';
import { IntegrationService } from '../../../core/base/services/integration.service';
import { ActivityInvitePopupStore } from '../../context/stores/activity-invite-popup.store';
import { PopupComponent, type PopupModel } from '../core/popup';
import { CopyLinkComponent } from '../core/copy-link/copy-link.component';
import { I18nPipe } from '../../pipes/i18n.pipe';

@Component({
  selector: 'app-external-invite-popup', standalone: true,
  imports: [PopupComponent, CopyLinkComponent, I18nPipe],
  template: `
    @if (store.externalInvite(); as target) {
      <app-popup [model]="model()" [zIndex]="26000">
        <section class="invite-link">
          <strong>{{ target.title }}</strong>
          <p>{{ 'invite.external.description' | i18n }}</p>
          <app-copy-link [value]="url()" label="invite.external.url" [disabled]="loading()"></app-copy-link>
          @if (loading()) { <p role="status">{{ 'loading' | i18n }}</p> }
          @if (error()) { <p role="alert">{{ 'invite.external.failed' | i18n }}</p> }
        </section>
      </app-popup>
    }
  `,
  styles: [`.invite-link { min-width: 0; padding: .85rem; border: 1px solid #a6d5dd;
    border-radius: 12px; background: #edf9fa; color: #245963; } p { font-size: .85rem; }`]
})
export class ExternalInvitePopupComponent {
  protected readonly store = inject(ActivityInvitePopupStore);
  private readonly integration = inject(IntegrationService);
  protected readonly url = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  constructor() {
    effect(() => { const target = this.store.externalInvite(); if (target) untracked(() => { void this.load(); }); });
  }
  protected model(): PopupModel {
    return { title: 'invite.external.title', size: 'small', height: 'auto', backdropTone: 'dim',
      onClose: () => this.store.externalInvite.set(null),
      headerActions: this.error() ? [{ id: 'retry', icon: 'refresh', label: 'Retry', palette: 'blue' }] : [],
      onAction: () => { void this.load(); } };
  }
  private async load(): Promise<void> {
    const target = this.store.externalInvite(); if (!target) return;
    this.url.set(''); this.loading.set(true); this.error.set(false);
    try {
      const link = await this.integration.externalInviteLink(target);
      if (this.store.externalInvite() === target) this.url.set(link.url);
    } catch { if (this.store.externalInvite() === target) this.error.set(true); }
    finally { if (this.store.externalInvite() === target) this.loading.set(false); }
  }
}
