import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import {
  PopupComponent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import {
  OperatorMenuStore,
  type OperatorMenuKind
} from '../../../shared/ui/context/stores/operator-menu.store';

interface PlannedOperatorPanel {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
}

const PANEL_BY_KIND: Readonly<Record<OperatorMenuKind, PlannedOperatorPanel>> = {
  branding: {
    icon: 'palette',
    title: 'Branding',
    subtitle: 'Theme, icon and landing identity',
    description: 'Ten theme presets, deployment icon upload and operator-owned landing labels are planned for the branding milestone.'
  },
  payments: {
    icon: 'payments',
    title: 'Payments',
    subtitle: 'Operator-owned providers',
    description: 'Provider choice and payment credentials will remain deployment-local and will never be copied into the registry.'
  },
  firebase: {
    icon: 'notifications_active',
    title: 'Firebase',
    subtitle: 'Deployment notification configuration',
    description: 'Operator-managed Firebase configuration is planned after the signed registry and reliable MAU rail.'
  },
  leaderboard: {
    icon: 'leaderboard',
    title: 'Leaderboard',
    subtitle: 'Claimed weight and server breakdown',
    description: 'The leaderboard will aggregate operator presentation while keeping each deployment ledger and receipt independently auditable.'
  },
  connections: {
    icon: 'hub',
    title: 'Connections',
    subtitle: 'Group deployments by operator',
    description: 'A separate client-code flow will connect deployments for operator-level presentation. It is not part of deployment claiming.'
  },
  updates: {
    icon: 'system_update_alt',
    title: 'Updates',
    subtitle: 'Signed, operator-approved releases',
    description: 'The server will show a signed release manifest and verified artifact source before an operator explicitly starts an upgrade.'
  },
  community: {
    icon: 'forum',
    title: 'Community',
    subtitle: 'Forum and operator support',
    description: 'Community links will use a configured external provider so deployments do not need a custom forum or form backend.'
  }
};

@Component({
  selector: 'app-operator-planned-popup',
  standalone: true,
  imports: [
    MatIconModule,
    PopupComponent
  ],
  templateUrl: './operator-planned-popup.component.html',
  styleUrl: './operator-planned-popup.component.scss'
})
export class OperatorPlannedPopupComponent {
  protected readonly operatorMenu = inject(OperatorMenuStore);
  protected readonly panel = computed(() => {
    const kind = this.operatorMenu.activePopup();
    return kind ? PANEL_BY_KIND[kind] : null;
  });

  protected popupModel(panel: PlannedOperatorPanel): PopupModel {
    return {
      title: panel.title,
      subtitle: panel.subtitle,
      ariaLabel: `${panel.title} operator workspace`,
      closeAriaLabel: 'Close',
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      onClose: () => this.operatorMenu.closePopup()
    };
  }
}
