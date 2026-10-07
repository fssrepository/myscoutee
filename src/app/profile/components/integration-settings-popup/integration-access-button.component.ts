import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { ExplanationGuideService } from '../../../shared/core/base/services/explanation-guide.service';
import type { IntegrationAccessMode } from '../../../shared/core/contracts/integration.interface';
import { IntegrationSettingsStore } from '../../../shared/ui/context/stores/integration-settings.store';
import { AppMenuComponent, type AppMenuItem, type AppMenuRateConfig } from '../../../shared/ui/components/core/menu';
import { RateComponent } from '../../../shared/ui/components/core/menu/items/rate/rate.component';
import { PopupComponent, type PopupModel } from '../../../shared/ui/components/core/popup';
import { I18nPipe } from '../../../shared/ui/pipes/i18n.pipe';

const MODES: readonly IntegrationAccessMode[] = ['blocked', 'write', 'full'];
const STYLE = {
  blocked: {palette: 'danger' as const},
  write: {palette: 'amber' as const},
  full: {palette: 'green' as const}
};

@Component({
  selector: 'app-integration-access-button', standalone: true,
  imports: [AppMenuComponent, RateComponent, PopupComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-menu kind="inline" [items]="actions()" (itemSelect)="edit()"></app-menu>
    @if (open()) {
      <app-popup [model]="model()" [zIndex]="2550">
        <section class="access-editor" data-guide-field="integration-access-editor">
          <app-menu-rate [config]="rate()" (valueChange)="choose($event)"></app-menu-rate>
          <p class="access-description" role="status">{{ ('integration.access.' + draft() + '.description') | i18n }}</p>
          @if (clientId() !== null && mcpClient()) { <small>{{ 'integration.access.mcp.limit' | i18n }}</small> }
          <small>{{ 'integration.access.draft.hint' | i18n }}</small>
        </section>
      </app-popup>
    }
  `,
  styleUrl: './integration-access-button.component.scss'
})
export class IntegrationAccessButtonComponent implements OnDestroy {
  readonly clientId = input<string | null>(null);
  readonly clientName = input('');
  readonly mcpClient = input(false);
  private readonly store = inject(IntegrationSettingsStore);
  private readonly guide = inject(ExplanationGuideService);
  private unregisterGuide: (() => void) | null = null;
  protected readonly open = signal(false);
  protected readonly draft = signal<IntegrationAccessMode>('write');
  private readonly initial = signal<IntegrationAccessMode>('write');
  private openedContext = 0;
  constructor() {
    effect(() => { if (this.open() && this.openedContext !== this.store.contextVersion()) this.close(); });
  }
  protected readonly actions = computed<AppMenuItem[]>(() => {
    const mode = this.open() ? this.draft() : this.store.access(this.clientId());
    return [{id: 'permissions', icon: 'admin_panel_settings', ...STYLE[mode], layout: 'icon', ariaLabel: `integration.access.${mode}.open`,
      disabled: this.store.busy() || this.store.loading()}];
  });
  protected readonly model = computed<PopupModel>(() => ({
    title: 'integration.access.title', subtitle: this.clientName() || 'mcp.url', translateSubtitle: !this.clientName(),
    size: 'small', height: 'auto', mobilePresentation: 'compact', backdropTone: 'dim',
    headerActions: this.draft() === this.initial() ? [] : [{id: 'apply', icon: 'check', palette: 'green',
      ariaLabel: 'integration.access.apply', guideFieldId: 'integration-access-apply'}],
    onAction: () => { this.store.changeAccess(this.clientId(), this.draft()); this.close(); },
    onClose: () => this.close()
  }));
  protected readonly rate = computed<AppMenuRateConfig>(() => ({
    subjectKey: `${this.clientId() ?? 'mcp'}:${this.open()}`, scale: [1, 2, 3], value: MODES.indexOf(this.draft()) + 1,
    label: 'integration.access.level', valueLabel: `integration.access.${this.draft()}`, showCommit: false,
    stateColors: [{background: '#c93848', text: '#fff'}, {background: '#d58a16', text: '#172033'}, {background: '#258451', text: '#fff'}],
    animation: 'none', blinkOnSelect: false, guideFields: {slider: 'integration-access-level'}
  }));
  protected edit(): void {
    this.openedContext = this.store.contextVersion();
    this.initial.set(this.store.access(this.clientId())); this.draft.set(this.initial()); this.open.set(true);
    this.unregisterGuide ??= this.guide.registerContext('profile.integration-access');
  }
  ngOnDestroy(): void { this.unregisterGuide?.(); }
  private close(): void { this.open.set(false); this.unregisterGuide?.(); this.unregisterGuide = null; }
  protected choose(value: number): void { this.draft.set(MODES[Math.round(value) - 1] ?? 'write'); }
}
