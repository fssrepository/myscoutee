import {
  UiDateUtils,
  ExplanationGuideService,
  PopupComponent,
  type PopupModel,
  SmartListComponent,
  type SmartListConfig,
  type SmartListLoadPage,
  AccordionComponent,
  type UiAccordionModel
} from '@fssrepository/myscoutee-components';

import { Component, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { defer } from 'rxjs';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import type { CampaignHistoryItem } from '../../../shared/core/contracts/campaign.interface';
import { CampaignsStore } from '../../../shared/ui/context/stores/activity/campaigns.store';
import { CAMPAIGN_CATEGORY_STYLE, CAMPAIGN_KIND_STYLE } from '../../../shared/ui/converters/activity/campaign.converter';

import { CampaignEditorComponent, campaignViewControl, type CampaignView } from '../../../shared/ui/components/campaigns-popup/campaign-editor.component';
import { ProfileViewPopupComponent } from '../../../profile/components/profile-view-popup/profile-view-popup.component';

/** Work rating context. The shared list and accordion retain their ordinary paging behavior. */
@Component({
  selector: 'app-campaign-history-popup', standalone: true,
  imports: [PopupComponent, SmartListComponent, AccordionComponent, CampaignEditorComponent, ProfileViewPopupComponent],
  template: `@if (store.historyTarget(); as target) {
    <app-popup [model]="model()" [zIndex]="14500">
      <div class="history-content">
        <div class="history-list" [attr.aria-hidden]="view() !== 'details'" [inert]="view() !== 'details'">
          <app-smart-list data-guide-field="history-list" [config]="config" [loadPage]="loadPage" [query]="query()" [itemTemplate]="historyItem"></app-smart-list>
        </div>
        @if (view() === 'organizer') {
          <div class="organizer">
            <app-profile-view-popup [embedded]="true" [profileTarget]="{userId:target.targetUserId,label:target.label ?? null}"></app-profile-view-popup>
          </div>
        }
      </div>
      <ng-template #historyItem let-row>
        <app-accordion data-guide-field="history-campaign" [model]="accordion(row)" [itemTemplate]="details"
          (itemToggle)="toggle($event.id, $event.open)"></app-accordion>
      </ng-template>
      <ng-template #details let-item>
        <app-campaign-editor [embedded]="true" [readOnly]="true" [campaign]="item.context.campaign"></app-campaign-editor>
      </ng-template>
    </app-popup>
  }`,
  styles: [`:host { display: contents; }
    .history-content { display: grid; grid-template: minmax(0, 1fr) / minmax(0, 1fr); flex: 1; min-height: 0; }
    .history-list, .organizer { grid-area: 1 / 1; min-width: 0; }
    .history-list, .organizer, app-smart-list { display: flex; flex: 1; flex-direction: column; min-height: 0; }
    /* Keep the list measured while another tab is visible; a heightless viewport eagerly loads more pages. */
    .history-list[aria-hidden="true"] { visibility: hidden; pointer-events: none; }
    app-accordion, app-campaign-editor { display: block; min-width: 0; }`]
})
export class CampaignHistoryPopupComponent {
  protected readonly store = inject(CampaignsStore);
  private readonly guide = inject(ExplanationGuideService);
  private readonly i18n = inject(I18nService);
  protected readonly view = signal<CampaignView>('details');
  private readonly expanded = signal<Record<string, boolean>>({});
  private readonly firstId = signal<string | null>(null);
  private readonly error = signal('');
  @ViewChild(SmartListComponent) private list?: SmartListComponent<CampaignHistoryItem>;
  protected readonly query = computed(() => ({ filters: { targetUserId: this.store.historyTarget()?.targetUserId } }));
  protected readonly config: SmartListConfig<CampaignHistoryItem> = {
    pageSize: 5, initialPageSize: 5, listLayout: 'stack', snapMode: 'none',
    trackBy: (_index, row) => row.campaign.id, cacheable: { identity: row => row.campaign.id },
    headerProgress: { enabled: true, placement: 'inline' },
    sortable: { sortKey: row => [-Date.parse(row.lastInteractionAtIso), row.campaign.id] },
    groupBy: row => UiDateUtils.smartListDayLabel(new Date(row.lastInteractionAtIso)),
    showFirstGroupMarker: true,
    emptyLabel: () => this.i18n.translate(this.error() || 'campaign.history.empty')
  };
  protected readonly loadPage: SmartListLoadPage<CampaignHistoryItem> = (query, context) =>
    defer(async () => {
      const target = this.store.historyTarget();
      this.error.set('');
      try {
        const page = await this.store.historyPage(query, context?.signal);
        if (!query.cursor) this.firstId.set(page.items[0]?.campaign.id ?? null);
        return page;
      } catch (error) {
        if (!context?.signal?.aborted && target === this.store.historyTarget()) this.error.set('campaign.history.load.failed');
        throw error;
      }
    });
  constructor() {
    effect(onCleanup => { if (this.store.historyTarget()) onCleanup(untracked(() => this.guide.registerContext('work.campaign.history'))); });
    effect(() => {
      this.store.historyTarget();
      this.view.set('details'); this.expanded.set({}); this.firstId.set(null); this.error.set('');
    });
  }
  protected accordion(row: CampaignHistoryItem): UiAccordionModel<string, CampaignHistoryItem> {
    const c = row.campaign;
    return { items: [{ id: c.id, title: c.title, icon: CAMPAIGN_KIND_STYLE[c.kind].icon,
      palette: CAMPAIGN_CATEGORY_STYLE[c.category].palette,
      open: this.expanded()[c.id] ?? this.firstId() === c.id, context: row }] };
  }
  protected toggle(id: string, open: boolean): void { this.expanded.update(value => ({ ...value, [id]: open })); }
  protected readonly model = computed<PopupModel>(() => ({
    title: this.store.historyTarget()?.label || 'campaign.view', subtitle: 'campaign.history', errorMessage: this.error() || this.store.error(),
    size: 'wide', height: 'full', bodyLayout: 'fill', mobilePresentation: 'fullscreen',
    headerControls: [campaignViewControl(this.view()), ...(this.error() ? [{ id: 'retry', kind: 'menu' as const, menuKind: 'inline' as const,
      items: [{ id: 'retry', icon: 'refresh', ariaLabel: 'retry', palette: 'blue' as const }] }] : [])],
    onClose: () => this.store.closeHistory(),
    onMenuSelect: event => {
      if (event.itemSelect.id === 'details' || event.itemSelect.id === 'organizer') this.view.set(event.itemSelect.id);
      else if (event.itemSelect.id === 'retry') this.list?.reload(); // Retry the failed page sequence through SmartList.
    }
  }));
}
