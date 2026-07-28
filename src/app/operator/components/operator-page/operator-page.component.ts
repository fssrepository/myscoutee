import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Type,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type {
  OperatorRegistryLifecycle,
  OperatorRegistryStatusDto
} from '../../../shared/core/contracts/operator.interface';
import { USER_BY_ID_LOAD_CONTEXT_KEY } from '../../../shared/core';
import { IndicatorComponent } from '../../../shared/ui/components/core/indicator';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette
} from '../../../shared/ui/components/core/menu';
import {
  AppRuntimeStore
} from '../../../shared/ui/context/stores/app-runtime.store';
import {
  OperatorMenuStore,
  type OperatorRegistrySection
} from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';

type OperatorSummaryTone = 'muted' | 'active' | 'success' | 'warning' | 'danger';
type OperatorProgressState = 'waiting' | 'active' | 'done' | 'error';

interface OperatorStatusCard {
  id: 'connection' | 'identity' | 'deployment' | 'receipt';
  icon: string;
  label: string;
  value: string;
  detail: string;
  tone: OperatorSummaryTone;
}

interface OperatorProgressStep {
  id: 'inspect' | 'identity' | 'register' | 'receipt';
  icon: string;
  label: string;
  detail: string;
  state: OperatorProgressState;
}

interface OperatorStatusMenuContext {
  section: OperatorRegistrySection;
}

@Component({
  selector: 'app-operator-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppMenuComponent,
    IndicatorComponent,
    MatIconModule,
    NgComponentOutlet
  ],
  templateUrl: './operator-page.component.html',
  styleUrl: './operator-page.component.scss'
})
export class OperatorPageComponent implements OnInit {
  protected readonly registry = inject(OperatorRegistryStore);
  private readonly operatorMenu = inject(OperatorMenuStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly registryPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly profileLoadState = this.runtimeStore.selectLoadingState(
    USER_BY_ID_LOAD_CONTEXT_KEY
  );

  protected readonly status = this.registry.status;
  protected readonly busyAction = this.registry.busyAction;
  protected readonly registryPopupComponent = this.registryPopupComponentRef.asReadonly();
  protected readonly registryPopupOpen = computed(
    () => `${this.operatorMenu.activePopup() ?? ''}` === 'registry'
  );
  protected readonly loading = computed(
    () => this.busyAction() === 'load'
      || this.profileLoadState().status === 'idle'
      || this.profileLoadState().status === 'loading'
      || (!this.status() && !this.errorMessage())
  );
  protected readonly errorMessage = computed(() => {
    const storeError = this.registry.error().trim();
    if (storeError) {
      return storeError;
    }
    const status = this.status();
    if (status?.lastError?.message.trim()) {
      return status.lastError.message.trim();
    }
    return status?.lifecycle === 'ERROR'
      ? 'The registry state needs operator attention.'
      : '';
  });
  protected readonly statusCards = computed<readonly OperatorStatusCard[]>(
    () => this.buildStatusCards(this.status())
  );
  protected readonly statusMenuItems = computed<
    readonly AppMenuItem<OperatorStatusCard['id'], OperatorStatusMenuContext>[]
  >(() => this.statusCards().map(card => ({
    id: card.id,
    label: card.label,
    detail: `${card.value} · ${card.detail}`,
    icon: card.icon,
    kind: 'action',
    layout: 'big',
    palette: this.statusPalette(card.id, card.tone),
    ariaLabel: `Open ${card.label}: ${card.value}. ${card.detail}`,
    context: {
      section: this.registrySection(card.id)
    }
  })));
  protected readonly progressSteps = computed<readonly OperatorProgressStep[]>(
    () => this.buildProgressSteps(this.status())
  );

  constructor() {
    effect(() => {
      if (this.registryPopupOpen()) {
        void this.ensureRegistryPopupLoaded();
      }
    });
  }

  ngOnInit(): void {
    void this.registry.loadStatus();
  }

  protected openStatus(
    event: AppMenuItemSelectEvent<OperatorStatusCard['id'], OperatorStatusMenuContext>
  ): void {
    this.operatorMenu.openRegistry(event.context?.section ?? this.registrySection(event.id));
  }

  private async ensureRegistryPopupLoaded(): Promise<void> {
    if (this.registryPopupComponentRef()) {
      return;
    }
    const module = await import('../operator-registry-popup/operator-registry-popup.component');
    this.registryPopupComponentRef.set(module.OperatorRegistryPopupComponent);
  }

  private buildStatusCards(status: OperatorRegistryStatusDto | null): readonly OperatorStatusCard[] {
    if (!status) {
      return [
        this.loadingCard('connection', 'dns', 'Connection'),
        this.loadingCard('identity', 'key', 'Node identity'),
        this.loadingCard('deployment', 'badge', 'Deployment'),
        this.loadingCard('receipt', 'receipt_long', 'Installation test')
      ];
    }

    const hasDeploymentCode = Boolean(status.enrollment?.deploymentCode.trim());
    const hasReceipt = Boolean(status.enrollment?.installationTestBatchId.trim());

    return [
      {
        id: 'connection',
        icon: 'dns',
        label: 'Connection',
        value: this.connectionLabel(status),
        detail: status.selection?.baseUrl
          ?? (status.enabled ? 'Registry selected' : 'No registry selected'),
        tone: this.lifecycleTone(status.lifecycle)
      },
      {
        id: 'identity',
        icon: 'key',
        label: 'Node identity',
        value: this.identityLabel(status),
        detail: status.nodeIdentity.publicKeyFingerprint
          ? 'Signing key fingerprint available'
          : 'No signing key initialized',
        tone: status.nodeIdentity.state === 'READY' || status.nodeIdentity.state === 'SIMULATED'
          ? 'success'
          : status.nodeIdentity.state === 'INCOMPLETE'
            ? 'danger'
            : 'muted'
      },
      {
        id: 'deployment',
        icon: 'badge',
        label: 'Deployment',
        value: hasDeploymentCode
          ? 'Registered'
          : status.lifecycle === 'PENDING'
            ? 'Registration pending'
            : status.lifecycle === 'ERROR'
              ? 'Action required'
              : 'Not registered',
        detail: hasDeploymentCode
          ? 'Deployment code issued'
          : 'No deployment code',
        tone: hasDeploymentCode
          ? 'success'
          : status.lifecycle === 'PENDING'
            ? 'active'
            : status.lifecycle === 'ERROR'
              ? 'danger'
              : 'muted'
      },
      {
        id: 'receipt',
        icon: 'receipt_long',
        label: 'Installation test',
        value: hasReceipt
          ? 'Accepted'
          : status.lifecycle === 'ERROR'
            ? 'Action required'
            : 'Waiting',
        detail: hasReceipt
          ? 'Signed receipt stored'
          : 'No receipt yet',
        tone: hasReceipt
          ? 'success'
          : status.lifecycle === 'ERROR'
            ? 'danger'
            : status.lifecycle === 'PENDING'
              ? 'active'
              : 'muted'
      }
    ];
  }

  private loadingCard(
    id: OperatorStatusCard['id'],
    icon: string,
    label: string
  ): OperatorStatusCard {
    return {
      id,
      icon,
      label,
      value: this.errorMessage() ? 'Unavailable' : 'Loading',
      detail: this.errorMessage() ? 'State could not be loaded' : 'Reading deployment state',
      tone: this.errorMessage() ? 'danger' : 'muted'
    };
  }

  private connectionLabel(status: OperatorRegistryStatusDto): string {
    if (status.lifecycle === 'DISABLED' || !status.enabled) {
      return status.selection ? 'Disabled' : 'Not configured';
    }
    switch (status.lifecycle) {
      case 'REGISTERED':
        return 'Connected';
      case 'INSPECTED':
        return 'Identity inspected';
      case 'PENDING':
        return 'Connecting';
      case 'ERROR':
        return 'Action required';
      case 'UNCONFIGURED':
        return 'Not configured';
    }
  }

  private identityLabel(status: OperatorRegistryStatusDto): string {
    switch (status.nodeIdentity.state) {
      case 'READY':
        return 'Ready';
      case 'SIMULATED':
        return 'Sample ready';
      case 'INCOMPLETE':
        return 'Incomplete';
      case 'MISSING':
        return 'Missing';
    }
  }

  private lifecycleTone(lifecycle: OperatorRegistryLifecycle): OperatorSummaryTone {
    switch (lifecycle) {
      case 'REGISTERED':
        return 'success';
      case 'INSPECTED':
      case 'PENDING':
        return 'active';
      case 'ERROR':
        return 'danger';
      case 'DISABLED':
        return 'warning';
      case 'UNCONFIGURED':
        return 'muted';
    }
  }

  private statusPalette(
    id: OperatorStatusCard['id'],
    tone: OperatorSummaryTone
  ): AppMenuPalette {
    if (tone === 'danger') {
      return 'red';
    }
    if (tone === 'warning') {
      return 'amber';
    }
    switch (id) {
      case 'connection':
        return 'violet';
      case 'identity':
        return 'blue';
      case 'deployment':
        return 'green';
      case 'receipt':
        return 'teal';
    }
  }

  private registrySection(id: OperatorStatusCard['id']): OperatorRegistrySection {
    switch (id) {
      case 'connection':
        return 'configuration';
      case 'identity':
      case 'deployment':
      case 'receipt':
        return id;
    }
  }

  private buildProgressSteps(status: OperatorRegistryStatusDto | null): readonly OperatorProgressStep[] {
    const lifecycle = status?.lifecycle ?? 'UNCONFIGURED';
    const hasInspection = Boolean(status?.draftInspection || status?.selection);
    const hasIdentity = status?.nodeIdentity.state === 'READY'
      || status?.nodeIdentity.state === 'SIMULATED';
    const hasEnrollment = Boolean(status?.enrollment?.deploymentCode.trim());
    const hasReceipt = Boolean(status?.enrollment?.installationTestBatchId.trim());
    const hasError = lifecycle === 'ERROR';

    return [
      {
        id: 'inspect',
        icon: 'verified_user',
        label: 'Inspect registry identity',
        detail: hasInspection ? 'Registry identity selected' : 'No registry selected',
        state: hasInspection ? 'done' : hasError ? 'error' : 'active'
      },
      {
        id: 'identity',
        icon: 'key',
        label: 'Initialize node identity',
        detail: hasIdentity
          ? status?.nodeIdentity.state === 'SIMULATED'
            ? 'Sample identity'
            : 'Signing identity ready'
          : 'Not initialized',
        state: hasIdentity
          ? 'done'
          : lifecycle === 'PENDING'
            ? 'active'
            : hasError
              ? 'error'
              : 'waiting'
      },
      {
        id: 'register',
        icon: 'app_registration',
        label: 'Register deployment',
        detail: hasEnrollment ? 'Deployment code issued' : 'Awaiting confirmation',
        state: hasEnrollment
          ? 'done'
          : lifecycle === 'PENDING'
            ? 'active'
            : hasError
              ? 'error'
              : 'waiting'
      },
      {
        id: 'receipt',
        icon: 'receipt_long',
        label: 'Store installation receipt',
        detail: hasReceipt ? 'Installation test accepted' : 'No receipt yet',
        state: hasReceipt
          ? 'done'
          : lifecycle === 'PENDING'
            ? 'active'
            : hasError
              ? 'error'
              : 'waiting'
      }
    ];
  }
}
