import { Component, Input, OnInit, ViewChild, inject, effect } from '@angular/core';
import { AppUtils } from '../../../app-utils';
import { defer, map } from 'rxjs';
import { PopupComponent, PopupModel, PopupControl } from '../core/popup';
import { SmartListComponent, InfoCardComponent, InfoCardData, SmartListConfig, SmartListLoadPage } from '../core/smart-list';
import { AppMenuItemSelectEvent } from '../core/menu';
import { I18nService } from '../../../core/base/services/i18n.service';
import { I18nPipe } from '../../pipes/i18n.pipe';
import { CommunityGroupsStore } from '../../context/stores/community-groups.store';
import { ProfileStore } from '../../context/stores/profile.store';
import { CommunityGroupConverter, GROUP_BUCKET_STYLE, GROUP_CATEGORY_ICON, GROUP_CATEGORY_PALETTE } from '../../converters/community-group.converter';
import { GROUP_CATEGORIES, CommunityGroupSummary, GroupBucket, GroupFilters, GroupCategory, GroupSort, groupSort, groupMembershipBucket } from '../../../core/contracts/community-group.interface';
import { CommunityGroupEditorComponent } from './community-group-editor.component';
import { ContentModerationStore } from '../../context/stores/content-moderation.store';
@Component({ selector: 'app-community-groups-popup', standalone: true,
  imports: [PopupComponent, SmartListComponent, InfoCardComponent, CommunityGroupEditorComponent, I18nPipe],
  template: `
    <app-popup [model]="model()" [zIndex]="explore ? 1200 : null">
      @if (store.error() && !store.editor()) { <p role="alert">{{ store.error() | i18n }}</p> }
      <app-smart-list [config]="config" [loadPage]="loadPage" [query]="query" [itemTemplate]="cardTemplate"
        (menuItemSelect)="select($event)"></app-smart-list>
      <ng-template #cardTemplate let-card let-openMenu="openMenu">
        <app-info-card [card]="card" [useSharedMenu]="true" (menuRequest)="openMenu($event)"
          (mediaStartClick)="profiles.openProfileView({userId: card.ownerUserId})"
          (mediaEndClick)="store.members(card.eagerDetail)"></app-info-card>
      </ng-template>
    </app-popup>
    @defer (when !explore && store.editor()) {
      @if (!explore && store.editor(); as editor) { <app-community-group-editor [group]="editor.group" [readOnly]="editor.readOnly" [loading]="editor.loading === true"></app-community-group-editor> }
    }
  `
})
export class CommunityGroupsPopupComponent implements OnInit {
  @Input() explore = false;
  ngOnInit(): void { if (this.explore) this.query = { filters: { bucket: 'explore', category: null } }; }
  protected readonly store = inject(CommunityGroupsStore);
  protected readonly profiles = inject(ProfileStore);
  private readonly i18n = inject(I18nService);
  private readonly moderation = inject(ContentModerationStore);
  @ViewChild(SmartListComponent) private list?: SmartListComponent<InfoCardData<CommunityGroupSummary>, GroupFilters>;
  protected query: { filters: GroupFilters; sort?: GroupSort } = { filters: { bucket: this.store.initialBucket(), category: null } };
  protected readonly config: SmartListConfig<InfoCardData<CommunityGroupSummary>, GroupFilters> = {
    pageSize: 10, initialPageSize: 20, listLayout: 'card-grid', minColumnWidth: '280px',
    containerClass: { 'experience-card-list': true, 'assets-card-list': true },
    snapMode: 'mandatory', scrollPaddingTop: '2.6rem', footerSpacerHeight: null,
    showStickyHeader: true, showFirstGroupMarker: false,
    trackBy: (_index, card) => card.id, groupBy: card => card.groupLabel ?? '',
    cacheable: { identity: card => card.id }, pollIntervalMs: 30000,
    headerProgress: { enabled: true, placement: 'inline' },
    sortable: { sortKey: (card, _index, query) => groupSort(query.filters?.bucket ?? 'explore', query.sort) === 'distance'
      ? [card.distanceMetersExact ?? Number.MAX_SAFE_INTEGER, card.id]
      : [-Date.parse(card.dateIso ?? ''), card.id] },
    pollDelta: {
      revision: card => card.eagerDetail?.revision ?? JSON.stringify(card.eagerDetail),
      position: card => card.id,
      load: (query, snapshot, context) => defer(() => this.store.sync({
        bucket: query.filters?.bucket ?? 'hosting', category: query.filters?.category,
        sort: groupSort(query.filters?.bucket ?? 'hosting', query.sort),
        limit: query.pageSize, knownItems: snapshot.knownItems.map(item => ({ id: item.id, revision: `${item.revision}` })),
        tailId: snapshot.loadedTail?.id ?? null
      }, context?.signal)).pipe(map(delta => ({ ...delta, upserts: delta.upserts.map(group => this.card(group, groupSort(query.filters?.bucket ?? 'hosting', query.sort))) })))
    },
    menuItems: context => context.item?.eagerDetail ? CommunityGroupConverter.menu(this.withModeration(context.item.eagerDetail), this.store.openUserId()) : []
  };
  protected readonly loadPage: SmartListLoadPage<InfoCardData<CommunityGroupSummary>, GroupFilters> = (query, context) =>
    defer(() => this.store.page(query, context?.signal)).pipe(map(page => ({ ...page,
      items: page.items.map(group => this.card(group, groupSort(query.filters?.bucket ?? 'explore', query.sort))) })));
  private withModeration(group: CommunityGroupSummary): CommunityGroupSummary {
    if (group.role !== 'Admin' || group.membershipStatus !== 'accepted') return group;
    const attention = this.moderation.attention(group.id, group.moderationPending, group.moderationQueueRevision);
    return { ...group, activity: Math.max(0, group.activity - (group.moderationPending ?? 0)) + attention.pending,
      moderationPending: attention.pending, moderationQueueRevision: attention.revision };
  }
  private card(group: CommunityGroupSummary, sort: GroupSort = groupSort(this.query.filters.bucket, this.query.sort)) {
    const card = CommunityGroupConverter.card(this.withModeration(group), key => this.i18n.translate(key));
    if (sort === 'updated') card.groupLabel = AppUtils.smartListDayLabel(new Date(group.updatedAtIso));
    return card;
  }
  constructor() {
    effect(() => {
      const change = this.store.attentionDelta();
      if (!change || change.accountId !== this.store.openUserId()) return;
      this.list?.patchVisibleItem(card => card.id === change.groupId, card => card.eagerDetail ? this.card({
        ...card.eagerDetail, activity: Math.max(0, card.eagerDetail.activity + change.delta),
        membersActivity: Math.max(0, (card.eagerDetail.membersActivity ?? 0) + change.delta)
      }) : card);
    });
    effect(() => {
      for (const groupId of Object.keys(this.moderation.groupSnapshots())) {
        this.list?.patchVisibleItem(card => card.id === groupId, card => card.eagerDetail ? this.card(card.eagerDetail) : card);
      }
    });
    effect(() => {
      const group = this.store.changed(); if (!group) return;
      const card = this.card(group);
      const { bucket, category } = this.query.filters;
      const matches = (!category || category === group.category) && groupMembershipBucket(group) === bucket
        && (bucket !== 'explore' || group.ownerUserId !== this.store.openUserId() && group.visibility !== 'invitation'
          && (!group.moderationStatus || group.moderationStatus === 'accepted'));
      if (!matches) this.list?.removeVisibleItems(item => item.id === group.id);
      else if (!this.list?.patchVisibleItem(item => item.id === group.id, () => card)) {
        this.list?.reinsertVisibleItem(card, { loadedRange: 'before-or-within' });
      }
    });
  }
  protected select(event: AppMenuItemSelectEvent): void { void this.store.action(event.id, event.context as CommunityGroupSummary); }
  protected model(): PopupModel {
    const bucket = this.query.filters.bucket; const category = this.query.filters.category;
    const sort = groupSort(bucket, this.query.sort);
    const toolbarControls: PopupControl[] = [];
    if (!this.explore) toolbarControls.push({
      id: 'bucket', kind: 'menu', align: 'start', menuKind: 'select',
      trigger: { label: bucket === 'invitations' ? 'Invitations' : `groups.bucket.${bucket}`, ...GROUP_BUCKET_STYLE[bucket], layout: 'pill',
        counter: bucket === 'explore' ? 0 : this.store.counters()[bucket] },
      items: (['hosting', 'participation', 'pending', 'invitations'] as const).map(id => ({ id,
        label: id === 'invitations' ? 'Invitations' : `groups.bucket.${id}`, ...GROUP_BUCKET_STYLE[id],
        kind: 'radio', showCheck: true, active: bucket === id, checked: bucket === id, surface: 'tinted',
        counter: this.store.counters()[id], counterTone: 'alert' }))
    });
    if (this.explore) toolbarControls.push({
      id: 'category', kind: 'menu', align: 'start', menuKind: 'select',
      trigger: { label: category ? `groups.category.${category}` : 'groups.category.all',
        icon: category ? GROUP_CATEGORY_ICON[category] : 'category', palette: category ? GROUP_CATEGORY_PALETTE[category] : 'teal', layout: 'pill',
        counter: bucket === 'explore' ? 0 : this.store.categoryCount(bucket, category) },
      items: [{ id: 'all', label: 'groups.category.all', icon: 'category', palette: 'teal', surface: 'tinted',
        kind: 'radio', showCheck: true, active: !category, checked: !category,
        counter: bucket === 'explore' ? 0 : this.store.categoryCount(bucket), counterTone: 'alert' },
        ...GROUP_CATEGORIES.map(id => ({ id, label: `groups.category.${id}`, icon: GROUP_CATEGORY_ICON[id],
          kind: 'radio' as const, showCheck: true, palette: GROUP_CATEGORY_PALETTE[id], active: category === id, checked: category === id, surface: 'tinted' as const,
          counter: bucket === 'explore' ? 0 : this.store.categoryCount(bucket, id), counterTone: 'alert' as const }))]
    });
    if (!this.explore) toolbarControls.push({
      id: 'actions', kind: 'menu', align: 'end', panelAlign: 'end',
      trigger: { icon: 'add', closeIcon: 'close', ariaLabel: 'groups.actions', hideLabel: true, layout: 'icon', palette: 'green' },
      items: [
        { id: 'explore', label: 'groups.explore', icon: 'explore', palette: 'violet', surface: 'tinted' },
        { id: 'create', label: 'groups.create', icon: 'add_circle', palette: 'green', surface: 'tinted' }
      ]
    });
    return { title: this.explore ? 'groups.explore' : 'groups.title', size: 'wide', height: 'full', bodyLayout: 'fill', showToolbar: true,
      toolbarMobileAlign: 'start', onClose: () => this.explore ? this.store.closeExplore() : this.store.close(),
      headerControls: [{ id: 'sort', kind: 'menu', menuKind: 'select',
        trigger: { label: sort === 'distance' ? 'distance' : 'recent', icon: sort === 'distance' ? 'near_me' : 'schedule', palette: sort === 'distance' ? 'green' : 'violet', layout: 'pill' },
        items: (['distance', 'updated'] as const).map(id => ({id, label: id === 'distance' ? 'distance' : 'recent',
          icon: id === 'distance' ? 'near_me' : 'schedule', palette: id === 'distance' ? 'green' : 'violet', surface: 'tinted',
          kind: 'radio', showCheck: true, active: sort === id, checked: sort === id})) }],
      toolbarControls,
      onMenuSelect: event => {
        const value = event.itemSelect.id;
        if (event.control.id === 'actions') {
          if (value === 'explore') this.store.openExplore();
          else if (value === 'create') { this.store.closeEditor(); this.store.error.set(''); this.store.editor.set({ group: null, readOnly: false }); }
        } else if (event.control.id === 'sort') this.query = { ...this.query, sort: value as GroupSort };
        else if (event.control.id === 'bucket') this.query = { filters: { ...this.query.filters, bucket: value as GroupBucket } };
        else if (event.control.id === 'category') this.query = { ...this.query, filters: { ...this.query.filters, category: value === 'all' ? null : value as GroupCategory } };
      }
    };
  }
}
