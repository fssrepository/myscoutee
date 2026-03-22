import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostBinding, Input, inject } from '@angular/core';
import { AppContext } from '../../../core';

export type HeaderProgressBarTone = 'default' | 'chat';
export type HeaderProgressBarPlacement = 'edge' | 'inline';
export type HeaderProgressBarState = 'scrolling' | 'loading' | 'loading-overdue';

export interface HeaderProgressBarConfig {
  position?: number;
  state?: HeaderProgressBarState;
  tone?: HeaderProgressBarTone;
  placement?: HeaderProgressBarPlacement;
}

@Component({
  selector: 'app-header-progress-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header-progress-bar.component.html',
  styleUrl: './header-progress-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderProgressBarComponent {
  private readonly appCtx = inject(AppContext);

  @Input() config: HeaderProgressBarConfig | null = null;

  @HostBinding('class.header-progress-bar-host')
  protected readonly hostClass = true;

  @HostBinding('class.header-progress-bar-host--edge')
  protected get hostEdgeClass(): boolean {
    return this.resolvedPlacement === 'edge';
  }

  @HostBinding('class.header-progress-bar-host--inline')
  protected get hostInlineClass(): boolean {
    return this.resolvedPlacement === 'inline';
  }

  @HostBinding('class.header-progress-bar-host--tone-chat')
  protected get hostToneChatClass(): boolean {
    return this.resolvedTone === 'chat';
  }

  @HostBinding('attr.aria-hidden')
  protected readonly ariaHidden = 'true';

  protected get resolvedState(): HeaderProgressBarState | 'offline' {
    if (!this.appCtx.isOnline()) {
      return 'offline';
    }
    return this.config?.state ?? 'scrolling';
  }

  protected get isScrollingState(): boolean {
    return this.resolvedState === 'scrolling';
  }

  protected get isLoadingState(): boolean {
    return this.resolvedState === 'loading';
  }

  protected get isLoadingOverdueState(): boolean {
    return this.resolvedState === 'loading-overdue';
  }

  protected get isOfflineState(): boolean {
    return this.resolvedState === 'offline';
  }

  protected get resolvedPlacement(): HeaderProgressBarPlacement {
    return this.config?.placement ?? 'edge';
  }

  protected get resolvedTone(): HeaderProgressBarTone {
    return this.config?.tone ?? 'default';
  }

  protected positionTransform(): string {
    if (this.isOfflineState) {
      return 'scaleX(1)';
    }
    return `scaleX(${this.clampUnit(this.config?.position ?? 0)})`;
  }

  private clampUnit(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(1, value));
  }
}
