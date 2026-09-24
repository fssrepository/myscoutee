import { Component, ViewChild, inject, effect } from '@angular/core';
import { defer, map } from 'rxjs';
import { PopupComponent, PopupModel } from '../core/popup';
import { SmartListComponent, InfoCardComponent, InfoCardData, SmartListConfig, SmartListLoadPage } from '../core/smart-list';
import { AppMenuItemSelectEvent } from '../core/menu';
import { I18nService } from '../../../core/base/services/i18n.service';
import { I18nPipe } from '../../pipes/i18n.pipe';
import { CommunityGroupsStore } from '../../context/stores/community-groups.store';
import { ProfileStore } from '../../context/stores/profile.store';
import { CommunityGroupConverter, GROUP_BUCKET_STYLE, GROUP_CATEGORY_ICON, GROUP_CATEGORY_PALETTE } from '../../converters/community-group.converter';
import { GROUP_CATEGORIES, CommunityGroupSummary, GroupBucket, GroupFilters, GroupCategory } from '../../../core/contracts/community-group.interface';
import { CommunityGroupEditorComponent } from './community-group-editor.component';
@Component({ selector: 'app-community-groups-popup', standalone: true,
  imports: [PopupComponent, SmartListComponent, InfoCardComponent, CommunityGroupEditorComponent, I18nPipe],
  template: `
    <app-popup [model]="model()">
      @if (store.error() && !store.editor()) { <p role="alert">{{ store.error() | i18n }}</p> }
      <app-smart-list [config]="config" [loadPage]="loadPage" [query]="query" [itemTemplate]="cardTemplate"
        (menuItemSelect)="select($event)"></app-smart-list>
      <ng-template #cardTemplate let-card let-openMenu="openMenu">
        <app-info-card [card]="card" [useSharedMenu]="true" (menuRequest)="openMenu($event)"
          (mediaStartClick)="profiles.openProfileView({userId: card.ownerUserId})"
          (mediaEndClick)="store.members(card.eagerDetail)"></app-info-card>
      </ng-template>
    </app-popup>
    @defer (when store.editor()) {
      @if (store.editor(); as editor) { <app-community-group-editor [group]="editor.group" [readOnly]="editor.readOnly" [loading]="editor.loading === true"></app-community-group-editor> }
    }
  `
})
export class CommunityGroupsPopupComponent {
  protected readonly store = inject(CommunityGroupsStore);
  protected readonly profiles = inject(ProfileStore);
  private readonly i18n = inject(I18nService);
  @ViewChild(SmartListComponent) private list?: SmartListComponent<InfoCardData<CommunityGroupSummary>, GroupFilters>;
  protected query: { filters: GroupFilters } = { filters: { bucket: this.store.initialBucket(), category: null } };
  protected readonly config: SmartListConfig<InfoCardData<CommunityGroupSummary>, GroupFilters> = {
    pageSize: 10, initialPageSize: 20, listLayout: 'card-grid', desktopColumns: 3,
    containerClass: { 'experience-card-list': true, 'assets-card-list': true },
    snapMode: 'mandatory', scrollPaddingTop: '2.6rem', footerSpacerHeight: null,
    showStickyHeader: true, showFirstGroupMarker: false,
    trackBy: (_index, card) => card.id, groupBy: card => card.groupLabel ?? '',
    cacheable: { identity: card => card.id }, pollIntervalMs: 30000,
    headerProgress: { enabled: true, placement: 'inline' },
    sortable: { sortKey: card => [card.distanceMetersExact == null ? Number.MAX_SAFE_INTEGER : Math.ceil(card.distanceMetersExact / 5000), -Date.parse(card.dateIso ?? ''), card.id] },
    pollDelta: {
      revision: card => card.eagerDetail?.revision ?? JSON.stringify(card.eagerDetail),
      position: card => card.id,
      load: (query, snapshot, context) => defer(() => this.store.sync({
        bucket: query.filters?.bucket ?? 'hosting', category: query.filters?.category,
        limit: query.pageSize, knownItems: snapshot.knownItems.map(item => ({ id: item.id, revision: `${item.revision}` })),
        tailId: snapshot.loadedTail?.id ?? null
      }, context?.signal)).pipe(map(delta => ({ ...delta, upserts: delta.upserts.map(group => CommunityGroupConverter.card(group, key => this.i18n.translate(key))) })))
    },
    menuItems: context => context.item?.eagerDetail ? CommunityGroupConverter.menu(context.item.eagerDetail, this.store.openUserId()) : []
  };
  protected readonly loadPage: SmartListLoadPage<InfoCardData<CommunityGroupSummary>, GroupFilters> = (query, context) =>
    defer(() => this.store.page(query, context?.signal)).pipe(map(page => ({ ...page,
      items: page.items.map(group => CommunityGroupConverter.card(group, key => this.i18n.translate(key))) })));
  constructor() {
    effect(() => {
      const group = this.store.changed(); if (!group) return;
      const card = CommunityGroupConverter.card(group, key => this.i18n.translate(key));
      const { bucket, category } = this.query.filters;
      const admin = group.role === 'Admin' && group.membershipStatus === 'accepted';
      const matches = (!category || category === group.category) && (bucket === 'hosting' ? admin
        : bucket === 'participation' ? !admin && !!group.membershipStatus
        : (!group.moderationStatus || group.moderationStatus === 'accepted' || admin) && (group.visibility !== 'invitation' || !!group.membershipStatus));
      if (!matches) this.list?.removeVisibleItems(item => item.id === group.id);
      else if (!this.list?.patchVisibleItem(item => item.id === group.id, () => card)) {
        this.list?.reinsertVisibleItem(card, { loadedRange: 'before-or-within' });
      }
    });
  }
  protected select(event: AppMenuItemSelectEvent): void { void this.store.action(event.id, event.context as CommunityGroupSummary); }
  protected model(): PopupModel {
    const bucket = this.query.filters.bucket; const category = this.query.filters.category;
    return { title: 'groups.title', size: 'wide', height: 'full', bodyLayout: 'fill', showToolbar: true,
      toolbarMobileAlign: 'start', onClose: () => this.store.close(),
      headerActions: [{ id: 'create', icon: 'group_add', label: 'groups.create', palette: 'blue' }],
      onAction: () => { this.store.closeEditor(); this.store.error.set(''); this.store.editor.set({ group: null, readOnly: false }); },
      toolbarControls: [
        { id: 'bucket', kind: 'menu', align: 'start', menuKind: 'select',
          trigger: { label: `groups.bucket.${bucket}`, ...GROUP_BUCKET_STYLE[bucket], layout: 'pill',
            counter: bucket === 'explore' ? null : this.store.counters()[bucket] },
          items: (['hosting','participation','explore'] as GroupBucket[]).map(id => ({ id, label: `groups.bucket.${id}`,
            ...GROUP_BUCKET_STYLE[id], kind: 'radio', showCheck: true, active: bucket === id, checked: bucket === id, surface: 'tinted',
            counter: id === 'explore' ? null : this.store.counters()[id] })) },
        { id: 'category', kind: 'menu', align: 'start', menuKind: 'select',
          trigger: { label: category ? `groups.category.${category}` : 'groups.category.all',
            icon: category ? GROUP_CATEGORY_ICON[category] : 'category', palette: category ? GROUP_CATEGORY_PALETTE[category] : 'teal', layout: 'pill' },
          items: [{ id: 'all', label: 'groups.category.all', icon: 'category', palette: 'teal', surface: 'tinted',
            kind: 'radio', showCheck: true, active: !category, checked: !category },
            ...GROUP_CATEGORIES.map(id => ({ id, label: `groups.category.${id}`, icon: GROUP_CATEGORY_ICON[id],
              kind: 'radio' as const, showCheck: true, palette: GROUP_CATEGORY_PALETTE[id], active: category === id, checked: category === id, surface: 'tinted' as const }))] }
      ], onMenuSelect: event => { const value = event.itemSelect.id;
        this.query = { filters: event.control.id === 'bucket'
          ? { ...this.query.filters, bucket: value as GroupBucket }
          : { ...this.query.filters, category: value === 'all' ? null : value as GroupCategory } }; }
    };
  }
}
