import { ExplanationGuideService } from '../../../core/base/services/explanation-guide.service';
import { AppUtils } from '../../../app-utils';
import { Component, ViewChild, effect, inject, untracked, computed, signal } from '@angular/core';
import { defer, map } from 'rxjs';
import { PopupComponent, PopupModel } from '../core/popup';
import { SmartListComponent, ImageCardComponent, ImageCardData, SmartListConfig, SmartListLoadPage } from '../core/smart-list';
import { I18nService } from '../../../core/base/services/i18n.service';
import { I18nPipe } from '../../pipes/i18n.pipe';
import { CampaignsStore } from '../../context/stores/campaigns.store';
import { ProfileStore } from '../../context/stores/profile.store';
import { CampaignConverter, CAMPAIGN_STATUS_STYLE } from '../../converters/campaign.converter';
import type { Campaign, CampaignFilters, CampaignStatus } from '../../../core/contracts/campaign.interface';
import { CampaignEditorComponent } from './campaign-editor.component';
import { CampaignHistoryPopupComponent } from '../../../../activity/components/campaign-history-popup/campaign-history-popup.component';
import type { AppMenuItemSelectEvent } from '../core/menu';

@Component({ selector: 'app-campaigns-popup', standalone: true,
  imports: [PopupComponent, SmartListComponent, ImageCardComponent, CampaignEditorComponent, CampaignHistoryPopupComponent, I18nPipe],
  template: `
    @if (store.session()) {
      <app-popup [model]="model()" [zIndex]="14000">
        @if (store.error() && !store.editor()) { <p role="alert">{{ store.error() | i18n }}</p> }
        <app-smart-list data-guide-field="campaign-list" [config]="config" [loadPage]="loadPage" [query]="query()" [itemTemplate]="cardTemplate" (menuItemSelect)="action($event)"></app-smart-list>
        <ng-template #cardTemplate let-card>
          <app-image-card [card]="card" [menuId]="'campaign:'+card.id" [sharedMenuItems]="cardMenu(card.eagerDetail)" (mediaAction)="store.toggleSelection(card.eagerDetail)"></app-image-card>
        </ng-template>
      </app-popup>
    }
    @if (store.editor(); as editor) { <app-campaign-editor [campaign]="editor.campaign" [readOnly]="editor.readOnly"></app-campaign-editor> }
    @if (store.historyTarget()) { <app-campaign-history-popup></app-campaign-history-popup> }
  `
})
export class CampaignsPopupComponent {
  protected readonly store = inject(CampaignsStore);
  private readonly i18n = inject(I18nService);
  private readonly profiles = inject(ProfileStore);
  @ViewChild(SmartListComponent) private list?: SmartListComponent<ImageCardData<Campaign>, CampaignFilters>;
  protected readonly query = signal<{ filters: CampaignFilters }>({ filters: { scope: this.store.session()?.select ? this.store.session()?.scope ?? 'all' : 'own', status: 'published' } });
  protected readonly config: SmartListConfig<ImageCardData<Campaign>, CampaignFilters> = {
    pageSize: 10, initialPageSize: 20, listLayout: 'card-grid', containerClass: { 'experience-card-list': true, 'assets-card-list': true },
    trackBy: (_index, card) => card.id, cacheable: { identity: card => card.id },
    headerProgress: { enabled: true, placement: 'inline' },
    sortable: { sortKey: card => [-Date.parse(card.dateIso ?? ''), card.id] },
    groupBy: card => AppUtils.smartListDayLabel(new Date(card.dateIso!)), showFirstGroupMarker: false
  };
  protected readonly loadPage: SmartListLoadPage<ImageCardData<Campaign>, CampaignFilters> = (query, context) =>
    defer(() => this.store.page(query, context?.signal)).pipe(map(page => ({ ...page,
      items: page.items.map(c => this.card(c)) })));
  protected cardMenu(c:Campaign){return this.store.session()?.select?[]:CampaignConverter.menu(c,this.store.session()?.userId??'');}
  private card(c: Campaign): ImageCardData<Campaign> { return CampaignConverter.card(c, key => this.i18n.translate(key), !!this.store.session()?.select, c.id === this.store.selectedId()); }
  private renderedSelectionId: string | null = null;
  private readonly guide = inject(ExplanationGuideService);
  constructor() {
    effect(() => {
      const id = this.store.selectedId();
      const previous = this.renderedSelectionId; this.renderedSelectionId = id;
      untracked(() => {
        for (const key of new Set([previous, id])) if (key)
          this.list?.patchVisibleItem(card => card.id === key, card => this.card(card.eagerDetail!));
      });
    });
    effect(onCleanup => {
      const session = this.store.session();
      if (session) onCleanup(untracked(() => this.guide.registerContext(session.select ? 'work.campaign.select' : 'work.campaigns')));
    });
    effect(() => {
      const campaign = this.store.changed();
      if (!campaign || !this.store.session()) return;
      const f = this.query().filters;
      const matches = campaign.status === f.status && (f.scope !== 'own' || campaign.ownerUserId === this.store.session()?.userId);
      if (!matches) untracked(() => this.list?.removeVisibleItemByIdentity(campaign.id));
      else if (!untracked(() => this.list?.patchVisibleItem(item => item.id === campaign.id, () => this.card(campaign))))
        untracked(() => this.list?.reinsertVisibleItem(this.card(campaign), { loadedRange: 'before-or-within' }));
    });
  }
  protected action(event: AppMenuItemSelectEvent): void {
    const campaign = event.context as Campaign;
    if (event.id === 'author') void this.profiles.openProfileView({ userId: campaign.ownerUserId });
    else void this.store.action(event.id, campaign);
  }
  protected readonly model = computed<PopupModel>(() => {
    const selecting = !!this.store.session()?.select; const status = this.query().filters.status ?? 'published';
    const selected = this.store.selected();
    return { title: selecting ? 'campaign.select' : 'campaign.title', size: 'wide', height: 'full', bodyLayout: 'fill',
      onClose: () => this.store.close(),
      headerControls: [...(selecting ? [] : [{ id: 'status', kind: 'menu' as const, menuKind: 'select' as const,
        trigger: { label: `campaign.status.${status}`, ...CAMPAIGN_STATUS_STYLE[status], layout: 'pill' as const },
        items: (['published', 'draft', 'trash'] as CampaignStatus[]).map(id => ({ id, label: `campaign.status.${id}`,
          ...CAMPAIGN_STATUS_STYLE[id], kind: 'radio' as const, showCheck: true, active: id === status, checked: id === status, surface: 'tinted' as const })) }]), { id: 'actions', kind: 'menu', menuKind: 'inline', closeOnSelect: false, panelAlign: 'end', items: selecting
        ? [...(selected ? [{ id: 'basket', icon: 'shopping_basket', openIcon: 'shopping_basket', kind: 'branch' as const, palette: 'blue' as const,
            counter: 1, ariaLabel: 'campaign.select', items: [{ id: 'selected-campaign', label: selected.title, description: selected.ownerName,
              icon: 'campaign', kind: 'action' as const, palette: 'blue' as const, surface: 'tinted' as const,
              removable: true, removeIcon: 'close', removeAriaLabel: 'remove', closeOnSelect: false }] }] : []),
          { id: 'confirm', icon: 'done', kind: 'action', palette: 'success', ariaLabel: 'confirm',
            disabled: this.store.selectedId() === (this.store.session()?.selectedId ?? null) || !!this.store.selectedId() && !selected }]
        : [{ id: 'create', icon: 'add', ariaLabel: 'campaign.create', kind: 'action', palette: 'green' }] }],
      onMenuSelect: event => {
        if (event.control.id === 'status') this.query.set({ filters: { ...this.query().filters, status: event.itemSelect.id as CampaignStatus } });
        else if (event.itemSelect.id === 'create') void this.store.edit();
        else if (event.itemSelect.id === 'selected-campaign' && event.itemSelect.action === 'remove') this.store.selectedId.set(null);
        else if (event.itemSelect.id === 'confirm') this.store.confirmSelection();
      } };
  });
}
