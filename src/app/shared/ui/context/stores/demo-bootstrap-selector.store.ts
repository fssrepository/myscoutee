import {
  Injectable,
  Type,
  signal
} from '@angular/core';

import type { UserSelectorListItemDto } from '../../../core/contracts/user.interface';

export type DemoBootstrapSelectorMode = 'member' | 'admin';

export interface DemoBootstrapSelectorState {
  updatedMs: number;
  mode: DemoBootstrapSelectorMode;
  selectableModes: readonly DemoBootstrapSelectorMode[];
  title?: string;
  subtitle?: string;
  autoSelectUserId?: string;
  users?: readonly UserSelectorListItemDto[];
  onSelect: (userId: string, mode: DemoBootstrapSelectorMode) => boolean | Promise<boolean>;
  onNewProfile?: () => boolean | Promise<boolean>;
  onClose?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class DemoBootstrapSelectorStore {
  private readonly demoBootstrapSelectorRef = signal<DemoBootstrapSelectorState | null>(null);
  private readonly demoBootstrapSelectorComponentRef = signal<Type<unknown> | null>(null);

  readonly demoBootstrapSelector = this.demoBootstrapSelectorRef.asReadonly();
  readonly demoBootstrapSelectorComponent = this.demoBootstrapSelectorComponentRef.asReadonly();

  openDemoBootstrapSelector(payload: {
    mode: DemoBootstrapSelectorMode;
    selectableModes?: readonly DemoBootstrapSelectorMode[];
    title?: string;
    subtitle?: string;
    autoSelectUserId?: string;
    users?: readonly UserSelectorListItemDto[];
    onSelect: (userId: string, mode: DemoBootstrapSelectorMode) => boolean | Promise<boolean>;
    onNewProfile?: () => boolean | Promise<boolean>;
    onClose?: () => void;
  }): void {
    void this.ensureDemoBootstrapSelectorLoaded();
    const mode = payload.mode === 'admin' ? 'admin' : 'member';
    const selectableModes = this.normalizeSelectableModes(payload.selectableModes, mode);
    this.demoBootstrapSelectorRef.set({
      updatedMs: Date.now(),
      mode,
      selectableModes,
      title: payload.title?.trim() || undefined,
      subtitle: payload.subtitle?.trim() || undefined,
      autoSelectUserId: payload.autoSelectUserId?.trim() || undefined,
      users: payload.users?.map(user => ({ ...user })),
      onSelect: async (userId, selectedMode) => {
        const accepted = await payload.onSelect(userId, selectedMode);
        if (accepted !== false) {
          this.closeDemoBootstrapSelector();
        }
        return accepted;
      },
      onNewProfile: payload.onNewProfile
        ? async () => {
            const accepted = await payload.onNewProfile?.();
            if (accepted !== false) {
              this.closeDemoBootstrapSelector();
            }
            return accepted !== false;
          }
        : undefined,
      onClose: () => {
        try {
          payload.onClose?.();
        } finally {
          this.closeDemoBootstrapSelector();
        }
      }
    });
  }

  closeDemoBootstrapSelector(): void {
    this.demoBootstrapSelectorRef.set(null);
  }

  private normalizeSelectableModes(
    selectableModes: readonly DemoBootstrapSelectorMode[] | null | undefined,
    fallbackMode: DemoBootstrapSelectorMode
  ): readonly DemoBootstrapSelectorMode[] {
    const modes = (selectableModes ?? [fallbackMode])
      .map(mode => mode === 'admin' ? 'admin' : 'member');
    const uniqueModes = [...new Set(modes)];
    return uniqueModes.includes(fallbackMode)
      ? uniqueModes
      : [fallbackMode, ...uniqueModes];
  }

  async ensureDemoBootstrapSelectorLoaded(): Promise<void> {
    if (this.demoBootstrapSelectorComponentRef()) {
      return;
    }
    const module = await import('../../components/demo-bootstrap-selector/demo-bootstrap-selector.component');
    this.demoBootstrapSelectorComponentRef.set(module.DemoBootstrapSelectorComponent);
  }
}
