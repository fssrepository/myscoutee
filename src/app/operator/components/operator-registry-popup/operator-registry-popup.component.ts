import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';

import {
  normalizeOperatorRegistryBaseUrl,
  validateOperatorRegistryBaseUrl,
  validateOperatorRegistryScope
} from '../../../shared/core/base/operator-registry-candidate';
import type {
  OperatorRegistryStatusDto
} from '../../../shared/core/contracts/operator.interface';
import {
  LinkInputComponent,
  type LinkInputConfig
} from '../../../shared/ui/components/core/form/inputs/link-input';
import {
  IndicatorComponent
} from '../../../shared/ui/components/core/indicator';
import {
  PopupComponent,
  type PopupActionEvent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';
import {
  OperatorMenuStore,
  type OperatorRegistrySection
} from '../../../shared/ui/context/stores/operator-menu.store';

@Component({
  selector: 'app-operator-registry-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    IndicatorComponent,
    LinkInputComponent,
    MatIconModule,
    MatRippleModule,
    PopupComponent
  ],
  templateUrl: './operator-registry-popup.component.html',
  styleUrl: './operator-registry-popup.component.scss'
})
export class OperatorRegistryPopupComponent {
  protected readonly registry = inject(OperatorRegistryStore);
  protected readonly operatorMenu = inject(OperatorMenuStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;
  private sectionRequestVersion = 0;
  private destroyed = false;
  protected readonly status = this.registry.status;
  protected readonly inspection = this.registry.inspection;
  protected readonly busyAction = this.registry.busyAction;
  protected readonly errorMessage = this.registry.error;
  protected readonly noticeMessage = this.registry.notice;
  protected readonly confirmationAccepted = signal(false);
  protected readonly disconnectConfirmationVisible = signal(false);
  protected readonly copiedValue = signal('');
  protected readonly registryBaseUrl = this.registry.registryBaseUrl;
  protected readonly expectedRegistryScope = this.registry.expectedRegistryScope;
  protected readonly registryUrlConfig = computed<LinkInputConfig>(() => {
    const status = this.status();
    const candidate = status?.candidateDefaults;
    const candidateUrl = candidate?.baseUrl.trim() ?? '';
    return {
      label: 'Registry server URL',
      placeholder: 'https://registry.example.com',
      required: true,
      availableUrls: candidateUrl
        ? [{
            url: candidateUrl,
            label: status?.mode === 'DEMO'
              ? status.simulation
                ? 'Explore demo registry'
                : 'Development demo registry'
              : 'Configured registry',
            description: candidate?.registryScope.trim() || candidateUrl
          }]
        : [],
      availableUrlsAriaLabel: 'Select an available registry URL'
    };
  });

  protected readonly busy = computed(() => this.busyAction() !== null);
  protected readonly canInspect = this.registry.canInspect;
  protected readonly canConfirm = computed(() =>
    !this.busy()
    && Boolean(this.inspection()?.inspectionToken.trim())
    && this.confirmationAccepted()
  );
  protected readonly canRetry = computed(() => {
    const status = this.status();
    return !this.busy()
      && Boolean(status?.selection)
      && (
        status?.lifecycle === 'PENDING'
        || status?.lifecycle === 'ERROR'
      );
  });
  protected readonly busyLabel = computed(() => {
    switch (this.busyAction()) {
      case 'inspect':
        return 'Inspecting signed registry identity…';
      case 'confirm':
        return 'Initializing node identity and registering…';
      case 'retry':
        return 'Retrying registry synchronization…';
      case 'disconnect':
        return 'Disabling outbound registry connection…';
      case 'load':
      case null:
        return 'Loading registry state…';
    }
  });

  constructor() {
    effect(() => {
      const open = this.operatorMenu.activePopup() === 'registry';
      const section = this.operatorMenu.registrySection();
      const status = this.status();
      if (!open || !status) {
        return;
      }
      this.revealRegistrySection(section);
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.sectionRequestVersion += 1;
      if (this.copyResetTimer) {
        clearTimeout(this.copyResetTimer);
        this.copyResetTimer = null;
      }
    });
  }

  protected async loadStatus(): Promise<void> {
    await this.registry.loadStatus();
  }

  protected updateRegistryBaseUrl(value: string): void {
    const previousCandidate = this.registryCandidateFor(this.registryBaseUrl());
    const scopeWasCandidateDerived = Boolean(previousCandidate)
      && this.expectedRegistryScope().trim() === previousCandidate?.registryScope.trim();
    this.registry.setRegistryBaseUrl(value);
    const nextCandidate = this.registryCandidateFor(value);
    if (nextCandidate) {
      this.registry.setExpectedRegistryScope(nextCandidate.registryScope);
    } else if (scopeWasCandidateDerived) {
      this.registry.setExpectedRegistryScope('');
    }
  }

  protected popupModel(): PopupModel {
    return {
      title: 'Registry & node',
      subtitle: 'Signed deployment registration and installation receipt',
      ariaLabel: 'Registry and node settings',
      closeAriaLabel: 'Close registry settings',
      translateTitle: false,
      translateSubtitle: false,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerActions: [
        {
          id: 'refresh',
          icon: 'refresh',
          ariaLabel: 'Refresh registry status',
          palette: 'violet',
          disabled: this.busy()
        }
      ],
      onAction: event => this.onPopupAction(event),
      onClose: () => this.close()
    };
  }

  protected close(): void {
    this.disconnectConfirmationVisible.set(false);
    this.confirmationAccepted.set(false);
    this.operatorMenu.closePopup();
  }

  protected async inspectRegistry(): Promise<void> {
    const validationError = this.validateRegistryCandidate();
    if (validationError) {
      this.registry.setError(validationError);
      return;
    }
    this.registry.clearFeedback();
    this.registry.clearInspection();
    this.confirmationAccepted.set(false);
    const inspection = await this.registry.inspect({
      baseUrl: normalizeOperatorRegistryBaseUrl(
        this.registryBaseUrl(),
        this.status()?.mode === 'REAL'
      ),
      ...(this.expectedRegistryScope().trim()
        ? { expectedScope: this.expectedRegistryScope().trim() }
        : {})
    });
    if (inspection) {
      this.registry.setNotice(
        inspection.simulation
          ? 'Sample identity prepared locally. No registry was contacted.'
          : 'Signed registry identity verified. Review its scope and key fingerprint before confirming.'
      );
    }
  }

  protected async confirmRegistry(): Promise<void> {
    const inspection = this.inspection();
    if (!inspection || !this.confirmationAccepted()) {
      return;
    }
    this.registry.clearFeedback();
    this.registry.setNotice(
      inspection.simulation
        ? 'Applying the isolated sample workflow…'
        : 'Initializing the node identity and registering the deployment…'
    );
    const status = await this.registry.confirm();
    if (status) {
      this.confirmationAccepted.set(false);
      this.registry.setNotice(
        status.simulation
          ? 'Sample workflow completed. This is not a production registration or claim.'
          : status.lifecycle === 'REGISTERED'
            ? 'Deployment registration and installation-test receipt are complete.'
            : 'Registration is pending. Retry is safe and keeps the same node identity.'
      );
    }
  }

  protected async retryRegistration(): Promise<void> {
    this.registry.clearFeedback();
    this.registry.setNotice('Retrying with the preserved node identity and idempotency state…');
    const status = await this.registry.retry();
    if (status) {
      this.registry.setNotice(
        status.lifecycle === 'REGISTERED'
          ? 'Registry synchronization completed.'
          : 'The retry was accepted. The deployment remains safe to retry.'
      );
    }
  }

  protected requestDisconnect(): void {
    if (this.busy()) {
      return;
    }
    this.disconnectConfirmationVisible.set(true);
  }

  protected cancelDisconnect(): void {
    this.disconnectConfirmationVisible.set(false);
  }

  protected async disconnectRegistry(): Promise<void> {
    this.disconnectConfirmationVisible.set(false);
    this.registry.clearFeedback();
    const status = await this.registry.disconnect();
    if (status) {
      this.confirmationAccepted.set(false);
      this.registry.setNotice(
        'Outbound registry synchronization is disabled. The node identity, deployment code and signed receipts remain preserved.'
      );
    }
  }

  protected toggleConfirmation(checked: boolean): void {
    this.confirmationAccepted.set(checked);
  }

  protected async copyValue(value: string, label: string): Promise<void> {
    const normalizedValue = value.trim();
    if (!normalizedValue || typeof navigator === 'undefined' || !navigator.clipboard) {
      this.registry.setNotice(`${label} could not be copied. Select the value manually.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(normalizedValue);
      if (this.destroyed) {
        return;
      }
      this.copiedValue.set(normalizedValue);
      this.registry.setNotice(`${label} copied.`);
      if (this.copyResetTimer) {
        clearTimeout(this.copyResetTimer);
      }
      this.copyResetTimer = setTimeout(() => {
        this.copyResetTimer = null;
        if (this.destroyed) {
          return;
        }
        if (this.copiedValue() === normalizedValue) {
          this.copiedValue.set('');
        }
      }, 1800);
    } catch {
      if (this.destroyed) {
        return;
      }
      this.registry.setNotice(`${label} could not be copied. Select the value manually.`);
    }
  }

  protected formatDate(value: string | null | undefined): string {
    const timestamp = Date.parse(`${value ?? ''}`);
    if (!Number.isFinite(timestamp)) {
      return '—';
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  }

  private validateRegistryCandidate(): string {
    return validateOperatorRegistryBaseUrl(
      this.registryBaseUrl(),
      this.status()?.mode === 'REAL'
    ) || validateOperatorRegistryScope(this.expectedRegistryScope());
  }

  private registryCandidateFor(
    value: string
  ): OperatorRegistryStatusDto['candidateDefaults'] | null {
    const candidate = this.status()?.candidateDefaults;
    const candidateUrl = candidate?.baseUrl.trim() ?? '';
    const valueUrl = `${value ?? ''}`.trim();
    if (
      !candidate
      || !candidateUrl
      || !valueUrl
      || validateOperatorRegistryBaseUrl(candidateUrl, false)
      || validateOperatorRegistryBaseUrl(valueUrl, false)
    ) {
      return null;
    }
    return normalizeOperatorRegistryBaseUrl(candidateUrl, false)
      === normalizeOperatorRegistryBaseUrl(valueUrl, false)
      ? candidate
      : null;
  }

  private revealRegistrySection(section: OperatorRegistrySection): void {
    const requestVersion = ++this.sectionRequestVersion;
    const reveal = (): void => {
      if (this.destroyed || requestVersion !== this.sectionRequestVersion) {
        return;
      }
      const target = this.registrySectionElement(section)
        ?? this.registrySectionElement('configuration');
      if (!target) {
        return;
      }
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
      target.focus({ preventScroll: true });
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(reveal));
      return;
    }
    queueMicrotask(reveal);
  }

  private registrySectionElement(section: OperatorRegistrySection): HTMLElement | null {
    return this.elementRef.nativeElement.querySelector<HTMLElement>(
      `[data-registry-section="${section}"]`
    );
  }

  private onPopupAction(event: PopupActionEvent): void {
    if (event.action.id === 'refresh') {
      void this.loadStatus();
    }
  }

}
