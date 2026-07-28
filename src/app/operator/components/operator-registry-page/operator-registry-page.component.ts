import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  Type,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import type {
  OperatorRegistryLifecycle,
  OperatorRegistryStatusDto
} from '../../../shared/core/contracts/operator.interface';
import {
  normalizeOperatorRegistryBaseUrl,
  validateOperatorRegistryBaseUrl,
  validateOperatorRegistryScope
} from '../../../shared/core/base/operator-registry-candidate';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';
import {
  OperatorMenuStore,
  type OperatorMenuKind
} from '../../../shared/ui/context/stores/operator-menu.store';

type OperatorPanelId =
  | 'registry'
  | 'branding'
  | 'payments'
  | 'firebase'
  | 'leaderboard'
  | 'connections'
  | 'updates'
  | 'community';

interface OperatorPanel {
  id: OperatorPanelId;
  icon: string;
  label: string;
  description: string;
  available: boolean;
}

interface RegistryProgressStep {
  id: string;
  icon: string;
  label: string;
  detail: string;
  state: 'waiting' | 'active' | 'done' | 'error';
}

const OPERATOR_PANELS: readonly OperatorPanel[] = [
  {
    id: 'registry',
    icon: 'dns',
    label: 'Registry & node',
    description: 'Signed deployment registration and installation receipt',
    available: true
  },
  {
    id: 'branding',
    icon: 'palette',
    label: 'Branding',
    description: 'Theme, icon and landing identity',
    available: false
  },
  {
    id: 'payments',
    icon: 'payments',
    label: 'Payments',
    description: 'Provider selection and operator-owned credentials',
    available: false
  },
  {
    id: 'firebase',
    icon: 'notifications_active',
    label: 'Firebase',
    description: 'Deployment notification configuration',
    available: false
  },
  {
    id: 'leaderboard',
    icon: 'leaderboard',
    label: 'Leaderboard',
    description: 'Claimed weight and deployment breakdown',
    available: false
  },
  {
    id: 'connections',
    icon: 'hub',
    label: 'Connections',
    description: 'Operator client codes and linked deployments',
    available: false
  },
  {
    id: 'updates',
    icon: 'system_update_alt',
    label: 'Updates',
    description: 'Signed release inspection and operator-approved upgrade',
    available: false
  },
  {
    id: 'community',
    icon: 'forum',
    label: 'Community',
    description: 'Forum and operator support shortcuts',
    available: false
  }
];

@Component({
  selector: 'app-operator-registry-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatRippleModule
  ],
  templateUrl: './operator-registry-page.component.html',
  styleUrl: './operator-registry-page.component.scss'
})
export class OperatorRegistryPageComponent implements OnDestroy {
  protected readonly registry = inject(OperatorRegistryStore);
  private readonly operatorMenu = inject(OperatorMenuStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeSubscription: Subscription;
  private formInitialized = false;
  private readonly plannedPopupComponentRef = signal<Type<unknown> | null>(null);

  protected readonly panels = OPERATOR_PANELS;
  protected readonly activePanelId = signal<OperatorPanelId>('registry');
  protected readonly status = this.registry.status;
  protected readonly inspection = this.registry.inspection;
  protected readonly busyAction = this.registry.busyAction;
  protected readonly errorMessage = this.registry.error;
  protected readonly noticeMessage = this.registry.notice;
  protected readonly confirmationAccepted = signal(false);
  protected readonly disconnectConfirmationVisible = signal(false);
  protected readonly copiedValue = signal('');
  protected readonly plannedPopupComponent = this.plannedPopupComponentRef.asReadonly();
  protected readonly registryBaseUrl = signal('');
  protected readonly expectedRegistryScope = signal('');

  protected readonly activePanel = computed(() =>
    this.panels.find(panel => panel.id === this.activePanelId()) ?? this.panels[0]!
  );
  protected readonly busy = computed(() => this.busyAction() !== null);
  protected readonly canInspect = computed(() => {
    const status = this.status();
    return !this.busy()
      && Boolean(this.registryBaseUrl().trim())
      && !(status?.enabled && status.lifecycle === 'REGISTERED');
  });
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
  protected readonly progressSteps = computed<readonly RegistryProgressStep[]>(() =>
    this.buildProgressSteps(this.status())
  );

  constructor() {
    this.routeSubscription = this.route.queryParamMap.subscribe(params => {
      this.activePanelId.set(this.normalizePanelId(params.get('panel')));
    });
    effect(() => {
      if (this.operatorMenu.activePopup()) {
        void this.ensurePlannedPopupLoaded();
      }
    });
    void this.loadStatus();
  }

  ngOnDestroy(): void {
    this.routeSubscription.unsubscribe();
  }

  protected selectPanel(panel: OperatorPanel): void {
    if (!panel.available && panel.id !== 'registry') {
      this.operatorMenu.open(panel.id as OperatorMenuKind);
      return;
    }
    this.operatorMenu.closePopup();
    this.activePanelId.set(panel.id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: panel.id === 'registry' ? {} : { panel: panel.id },
      replaceUrl: true
    });
  }

  protected async loadStatus(): Promise<void> {
    const status = await this.registry.loadStatus();
    if (status) {
      this.applyStatus(status);
    }
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
      this.registryBaseUrl.set(inspection.baseUrl);
      this.expectedRegistryScope.set(inspection.registryIdentity.registryScope);
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
      this.applyStatus(status);
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
      this.applyStatus(status);
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
      this.applyStatus(status);
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
      this.copiedValue.set(normalizedValue);
      this.registry.setNotice(`${label} copied.`);
      setTimeout(() => {
        if (this.copiedValue() === normalizedValue) {
          this.copiedValue.set('');
        }
      }, 1800);
    } catch {
      this.registry.setNotice(`${label} could not be copied. Select the value manually.`);
    }
  }

  protected lifecycleLabel(lifecycle: OperatorRegistryLifecycle): string {
    switch (lifecycle) {
      case 'UNCONFIGURED':
        return 'Not configured';
      case 'INSPECTED':
        return 'Identity inspected';
      case 'PENDING':
        return 'Registration pending';
      case 'REGISTERED':
        return 'Registered';
      case 'ERROR':
        return 'Action required';
      case 'DISABLED':
        return 'Connection disabled';
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

  private applyStatus(status: OperatorRegistryStatusDto): void {
    if (!this.formInitialized) {
      this.registryBaseUrl.set(status.candidateDefaults.baseUrl);
      this.expectedRegistryScope.set(status.candidateDefaults.registryScope);
      this.formInitialized = true;
    }
  }

  private validateRegistryCandidate(): string {
    return validateOperatorRegistryBaseUrl(
      this.registryBaseUrl(),
      this.status()?.mode === 'REAL'
    ) || validateOperatorRegistryScope(this.expectedRegistryScope());
  }

  private normalizePanelId(value: string | null): OperatorPanelId {
    return this.panels.some(panel => panel.id === value)
      ? value as OperatorPanelId
      : 'registry';
  }

  private async ensurePlannedPopupLoaded(): Promise<void> {
    if (this.plannedPopupComponentRef()) {
      return;
    }
    const module = await import('../operator-planned-popup/operator-planned-popup.component');
    this.plannedPopupComponentRef.set(module.OperatorPlannedPopupComponent);
  }

  private buildProgressSteps(status: OperatorRegistryStatusDto | null): readonly RegistryProgressStep[] {
    const lifecycle = status?.lifecycle ?? 'UNCONFIGURED';
    const hasInspection = Boolean(status?.draftInspection || status?.selection);
    const hasIdentity = status?.nodeIdentity.state === 'READY'
      || status?.nodeIdentity.state === 'SIMULATED';
    const hasEnrollment = Boolean(status?.enrollment?.deploymentCode);
    const hasReceipt = Boolean(status?.enrollment?.installationTestBatchId);
    const error = lifecycle === 'ERROR';
    return [
      {
        id: 'inspect',
        icon: 'verified_user',
        label: 'Inspect registry identity',
        detail: hasInspection ? 'Signed scope and key reviewed' : 'No registry selected',
        state: hasInspection ? 'done' : error ? 'error' : 'active'
      },
      {
        id: 'identity',
        icon: 'key',
        label: 'Initialize node identity',
        detail: hasIdentity
          ? status?.nodeIdentity.state === 'SIMULATED' ? 'Sample identity' : 'Private key stored by Java'
          : 'Not initialized',
        state: hasIdentity ? 'done' : lifecycle === 'PENDING' ? 'active' : error ? 'error' : 'waiting'
      },
      {
        id: 'register',
        icon: 'app_registration',
        label: 'Register deployment',
        detail: hasEnrollment ? 'Deployment code issued' : 'Awaiting confirmation',
        state: hasEnrollment ? 'done' : lifecycle === 'PENDING' ? 'active' : error ? 'error' : 'waiting'
      },
      {
        id: 'receipt',
        icon: 'receipt_long',
        label: 'Store installation receipt',
        detail: hasReceipt ? 'Zero-count test batch accepted' : 'No receipt yet',
        state: hasReceipt ? 'done' : lifecycle === 'PENDING' ? 'active' : error ? 'error' : 'waiting'
      }
    ];
  }

}
