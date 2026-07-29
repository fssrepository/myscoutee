import {
  Component,
  OnDestroy,
  computed,
  inject
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  MatIconModule
} from '@angular/material/icon';

import {
  I18nService
} from '../../../shared/core';
import type {
  GlobalIdentityState
} from '../../../shared/core/contracts/global-identity.interface';
import {
  AppMenuComponent,
  FormFlowComponent,
  I18nPipe,
  IndicatorComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type FormFlowModel
} from '../../../shared/ui';
import {
  GlobalIdentityStore
} from '../../../shared/ui/context/stores/global-identity.store';

interface GlobalIdentityConsentForm {
  accepted: boolean;
}

type GlobalIdentityActionId =
  | 'global-identity-reload'
  | 'global-identity-link'
  | 'global-identity-rotate'
  | 'global-identity-unlink';

@Component({
  selector: 'app-profile-global-identity-popup',
  standalone: true,
  imports: [
    FormsModule,
    MatIconModule,
    AppMenuComponent,
    FormFlowComponent,
    I18nPipe,
    IndicatorComponent
  ],
  templateUrl: './global-identity-popup.component.html',
  styleUrl: './global-identity-popup.component.scss'
})
export class ProfileGlobalIdentityPopupComponent implements OnDestroy {
  private readonly store = inject(GlobalIdentityStore);
  private readonly i18n = inject(I18nService);

  protected readonly status = this.store.status;
  protected readonly loading = this.store.loading;
  protected readonly busyAction = this.store.busyAction;
  protected readonly error = this.store.error;
  protected readonly busy = this.store.busy;
  protected readonly showConsent = computed(() => {
    const status = this.status();
    return status !== null
      && !status.linked
      && status.state !== 'LINK'
      && status.state !== 'CORRECT'
      && status.state !== 'UNLINK';
  });
  protected consentForm: GlobalIdentityConsentForm = {
    accepted: false
  };

  constructor() {
    void this.store.load();
  }

  ngOnDestroy(): void {
    this.store.clear();
  }

  protected consentFlowModel(): FormFlowModel {
    return {
      title: this.i18n.translate('global.identity.consent.title'),
      layout: 'grouped',
      tone: 'blue',
      header: false,
      summary: {
        enabled: false
      },
      completion: {
        controls: 'none'
      },
      save: null,
      steps: [{
        id: 'global-identity-consent',
        title: this.i18n.translate('global.identity.consent.title'),
        chrome: 'none',
        controls: [{
          id: 'global-identity-consent-accepted',
          bind: 'accepted',
          kind: 'checkbox',
          layout: 'wide',
          label: this.i18n.translate('global.identity.consent.label'),
          description: this.i18n.translate(
            'global.identity.consent.description'
          ),
          required: true,
          disabled: this.busy()
        }]
      }]
    };
  }

  protected onConsentValueChange(value: unknown): void {
    const record = this.record(value);
    this.consentForm = {
      accepted: record['accepted'] === true
    };
  }

  protected actionItems(): readonly AppMenuItem<GlobalIdentityActionId>[] {
    const status = this.status();
    const busyAction = this.busyAction();
    const items: AppMenuItem<GlobalIdentityActionId>[] = [{
      id: 'global-identity-reload',
      label: 'global.identity.action.reload',
      icon: 'refresh',
      layout: 'action',
      palette: 'slate',
      disabled: this.busy(),
      ariaLabel: 'global.identity.action.reload'
    }];
    if (!status || status.state === 'UNAVAILABLE') {
      return items;
    }
    if (status.state === 'LINK' || status.state === 'CORRECT') {
      items.push(this.actionItem(
        'global-identity-link',
        'global.identity.action.retry',
        'sync',
        'blue',
        busyAction === 'link'
      ));
      return items;
    }
    if (status.state === 'UNLINK') {
      items.push(this.actionItem(
        'global-identity-unlink',
        'global.identity.action.retry',
        'sync',
        'warning',
        busyAction === 'unlink'
      ));
      return items;
    }
    if (status.linked) {
      if (status.rotationRequired === true) {
        items.push(this.actionItem(
          'global-identity-rotate',
          'global.identity.action.rotate',
          'key',
          'amber',
          busyAction === 'rotate'
        ));
      }
      items.push(this.actionItem(
        'global-identity-unlink',
        'global.identity.action.unlink',
        'link_off',
        'danger',
        busyAction === 'unlink'
      ));
      return items;
    }
    items.push(this.actionItem(
      'global-identity-link',
      'global.identity.action.link',
      'link',
      'blue',
      busyAction === 'link',
      !status.syncAvailable || !this.consentForm.accepted
    ));
    return items;
  }

  protected onAction(
    event: AppMenuItemSelectEvent<GlobalIdentityActionId>
  ): void {
    switch (event.id) {
      case 'global-identity-reload':
        void this.store.load();
        return;
      case 'global-identity-link':
        if (
          this.status()?.state === 'UNLINKED'
          && !this.consentForm.accepted
        ) {
          return;
        }
        void this.store.link();
        return;
      case 'global-identity-rotate':
        void this.store.rotate();
        return;
      case 'global-identity-unlink':
        void this.store.unlink();
    }
  }

  protected stateLabel(state: GlobalIdentityState): string {
    return `global.identity.state.${state.toLowerCase()}`;
  }

  protected stateIcon(state: GlobalIdentityState): string {
    switch (state) {
      case 'ACTIVE':
        return 'verified_user';
      case 'LINK':
      case 'CORRECT':
      case 'UNLINK':
      case 'PENDING':
        return 'pending_actions';
      case 'UNLINKED':
        return 'link_off';
      default:
        return 'cloud_off';
    }
  }

  protected statePalette(state: GlobalIdentityState): string {
    switch (state) {
      case 'ACTIVE':
        return 'success';
      case 'LINK':
      case 'CORRECT':
      case 'UNLINK':
      case 'PENDING':
        return 'pending';
      case 'UNLINKED':
        return 'neutral';
      default:
        return 'unavailable';
    }
  }

  protected formatTimestamp(value: string | null): string {
    if (!value) {
      return '—';
    }
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private actionItem(
    id: GlobalIdentityActionId,
    label: string,
    icon: string,
    palette: AppMenuPalette,
    loading: boolean,
    disabled = false
  ): AppMenuItem<GlobalIdentityActionId> {
    return {
      id,
      label,
      icon,
      layout: 'action',
      palette,
      disabled: disabled || this.busy(),
      ariaLabel: label,
      progress: loading
        ? {
            state: 'loading',
            shape: 'button'
          }
        : null
    };
  }

  private record(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null
      ? value as Record<string, unknown>
      : {};
  }
}
