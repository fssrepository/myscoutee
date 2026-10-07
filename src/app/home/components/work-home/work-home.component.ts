import { ratingCriteriaFor } from '../../../shared/core/contracts/rating-snapshot';
import { ExplanationGuideService } from '../../../shared/core/base/services/explanation-guide.service';
import { ChangeDetectionStrategy, Component, Input, OnDestroy, inject, computed } from '@angular/core';
import { defer, map } from 'rxjs';
import { HomeHeaderComponent } from '../home-header/home-header.component';
import { WorkHomeStore } from '../../../shared/ui/context/stores/work-home.store';
import { CampaignsStore } from '../../../shared/ui/context/stores/campaigns.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { ActivitiesPopupStore } from '../../../shared/ui/context/stores/activities-popup.store';
import { CampaignConverter, CAMPAIGN_CATEGORY_STYLE, CAMPAIGN_KIND_STYLE } from '../../../shared/ui/converters/campaign.converter';
import { CAMPAIGN_CATEGORIES, CAMPAIGN_KINDS, type Campaign, type CampaignFilters, type CampaignCategory, type CampaignKind } from '../../../shared/core/contracts/campaign.interface';
import type { DeploymentBrandingDto } from '../../../shared/core/contracts/deployment-configuration.interface';
import { I18nService } from '../../../shared/core/base/services/i18n.service';
import { SmartListComponent, SingleCardComponent, type SingleCardData, type SmartListConfig, type SmartListLoadPage } from '../../../shared/ui/components/core/smart-list';
import type { AppMenuItem, AppMenuItemSelectEvent } from '../../../shared/ui/components/core/menu';

@Component({ selector: 'app-work-home', standalone: true,
  imports: [HomeHeaderComponent, SmartListComponent, SingleCardComponent],
  template: `<div class="game-page" data-guide-surface="work.home">
    <app-home-header [branding]="branding" [items]="headerItems()" (itemSelect)="headerAction($event)"></app-home-header>
    <section class="game-layout-single"><div class="game-card-deck">
      <app-smart-list class="home-smart-list" data-guide-field="work-campaigns" [config]="config" [query]="store.query()" [loadPage]="loadPage" [fullscreenItemTemplate]="cardTemplate"
        presentation="fullscreen"></app-smart-list>
      <ng-template #cardTemplate let-card>
        @if (card) { <app-single-card [card]="card" (detailClick)="openDetails(card.eagerDetail)"></app-single-card> }
      </ng-template>
    </div></section>
  </div>
`,
  styleUrl: './work-home.component.scss', changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkHomeComponent implements OnDestroy {
  private readonly unregisterGuide = inject(ExplanationGuideService).registerContext('work.home');
  ngOnDestroy(): void { this.unregisterGuide(); }
  @Input({ required: true }) branding!: DeploymentBrandingDto;
  protected readonly store = inject(WorkHomeStore);
  private readonly campaigns = inject(CampaignsStore);
  private readonly profile = inject(UserProfileStore);
  private readonly activities = inject(ActivitiesPopupStore);
  private readonly i18n = inject(I18nService);
  protected readonly config: SmartListConfig<SingleCardData & {id:string;eagerDetail:Campaign}, CampaignFilters & { userId: string }> = {
    pageSize: 10, mobilePageSizeCap: null, presentation: 'fullscreen',
    showBackgroundLoadingProgress: true, headerProgress: { enabled: true }, trackBy: (_index, card) => card.id,
    groupBy: card => this.i18n.translate(`campaign.category.${card.eagerDetail.category}`),
    emptyLabel: 'campaign.empty', emptyDescription: 'campaign.empty.description',
    pagination: { mode: 'rating-stars', ratingBarValue: card => card ? this.store.score(card.id) : 0,
      ratingBarConfig: card => card ? { guideFields:{slider:'rating-input',action:'rating-save'},criteriaDefinition: ratingCriteriaFor(card.ratingDomain), ratingSnapshot: this.store.snapshot(card.id), subjectKey: `${this.profile.activeUserId()}:${card.id}`, scale: [1,2,3,4,5,6,7,8,9,10],
        label: 'campaign.interest', actionLabel: 'Go', presentation: 'fullscreen', blinkOnSelect: false } : null,
      onRatingSelect: (card, score, _query, snapshot) => { if (card?.eagerDetail) this.store.rate(card.eagerDetail, score, snapshot); } }
  };
  protected readonly loadPage: SmartListLoadPage<SingleCardData & {id:string;eagerDetail:Campaign}, CampaignFilters & { userId: string }> = (query, context) =>
    defer(() => this.store.page(query, context?.signal)).pipe(map(page => ({ ...page, items: page.items.map(c =>
      CampaignConverter.imageCard(c,key=>this.i18n.translate(key))) })));
  protected readonly headerItems = computed<AppMenuItem[]>(() => {
    const kind = this.store.filters().kind ?? 'both';
    return [{ id: 'kind', guideId: 'work-kind', label: `campaign.kind.${kind}`, ...CAMPAIGN_KIND_STYLE[kind], kind: 'select-trigger', layout: 'pill',
      items: CAMPAIGN_KINDS.map(id => ({ id, label: `campaign.kind.${id}`, ...CAMPAIGN_KIND_STYLE[id], surface:'tinted', kind: 'radio', checked: id === kind, active: id === kind, showCheck: true })) },
      {id:'category',label:this.store.filters().category?`campaign.category.${this.store.filters().category}`:'groups.category.all',
        ...(this.store.filters().category?CAMPAIGN_CATEGORY_STYLE[this.store.filters().category!]:{icon:'category',palette:'teal' as const}),kind:'select-trigger',layout:'pill',
        items:([{id:'all',label:'groups.category.all',icon:'category',palette:'teal' as const},
          ...CAMPAIGN_CATEGORIES.map(id=>({id,label:`campaign.category.${id}`,...CAMPAIGN_CATEGORY_STYLE[id]}))]).map(item=>({...item,kind:'radio',surface:'tinted',
            checked:item.id===(this.store.filters().category??'all'),active:item.id===(this.store.filters().category??'all')}))},
      { id: 'rates', label: 'ratings', icon: 'history', palette: 'gold', layout: 'pill', kind: 'action',
        counter: this.profile.activeUserProfile()?.activities?.game ?? 0 }];
  });
  protected headerAction(event: AppMenuItemSelectEvent): void {
    if (CAMPAIGN_KINDS.includes(event.id as CampaignKind)) this.store.filters.update(filters => ({ ...filters, kind: event.id as CampaignKind }));
    if(event.id==='all'||CAMPAIGN_CATEGORIES.includes(event.id as CampaignCategory))this.store.filters.update(filters=>({...filters,category:event.id==='all'?null:event.id as CampaignCategory}));
    if (event.id === 'rates') {
      this.campaigns.activityCampaign.set(null);
      this.activities.openActivities('rates', undefined, 'individual-given', false);
    }
  }
  protected openDetails(campaign:Campaign):void{void this.campaigns.edit(campaign,true);}
}
