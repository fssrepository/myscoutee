import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  TemplateRef,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { from } from 'rxjs';

import type * as AppTypes from '../../../shared/core/base/models';
import { AppUtils } from '../../../shared/app-utils';
import {
  BasketComponent,
  LazyBgImageDirective,
  SmartListComponent,
  type BasketChip,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoaders,
  type SmartListStateChange
} from '../../../shared/ui';
import { ActivityInviteCandidatesService, ActivityMembersService, AppContext, AppPopupContext } from '../../../shared/core';
import { OwnedAssetsPopupFacadeService } from '../../owned-assets-popup-facade.service';

interface ActivityInviteFilters {
  ownerId?: string;
  sort?: AppTypes.ActivityInviteSort;
  fallbackTitle?: string;
}

@Component({
  selector: 'app-asset-member-picker-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    BasketComponent,
    SmartListComponent,
    LazyBgImageDirective
  ],
  templateUrl: './asset-member-picker-popup.component.html',
  styleUrls: ['./asset-member-picker-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetMemberPickerPopupComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly activityInviteCandidatesService = inject(ActivityInviteCandidatesService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);

  protected isOpen = false;
  protected title = 'Invite members';
  protected ownerId = '';
  protected ownerType: AppTypes.ActivityMemberOwnerType = 'event';
  protected inviteSort: AppTypes.ActivityInviteSort = 'recent';
  protected showInviteSortPicker = false;
  protected selectedUserIds: string[] = [];
  protected inviteSmartListQuery: Partial<ListQuery<ActivityInviteFilters>> = {};
  protected confirmErrorMessage = '';
  protected readonly confirmRingPerimeter = 100;
  protected isConfirmPending = false;

  private currentCandidates: AppTypes.ActivityMemberEntry[] = [];
  private persistedSelectedUserIds = new Set<string>();
  private readonly candidatesByUserId = new Map<string, AppTypes.ActivityMemberEntry>();
  private candidateQueryKey = '';
  private localCandidates: AppTypes.ActivityMemberEntry[] = [];
  private isLocalCandidateSource = false;
  private inviteApplyHandler: ((selectedCandidates: readonly AppTypes.ActivityMemberEntry[]) => void | Promise<void>) | null = null;
  private closeOwnerPopupOnClose = false;

  @ViewChild('inviteSmartList')
  private inviteSmartList?: SmartListComponent<AppTypes.ActivityMemberEntry, ActivityInviteFilters>;

  protected inviteItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityMemberEntry, ActivityInviteFilters>>;

  @ViewChild('inviteItemTemplate', { read: TemplateRef })
  private set inviteItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppTypes.ActivityMemberEntry, ActivityInviteFilters>> | undefined
  ) {
    this.inviteItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  protected readonly inviteSmartListConfig: SmartListConfig<AppTypes.ActivityMemberEntry, ActivityInviteFilters> = {
    pageSize: 16,
    loadingDelayMs: 1500,
    loadingWindowMs: 3000,
    defaultView: 'list',
    headerProgress: {
      enabled: true
    },
    showStickyHeader: false,
    showGroupMarker: () => false,
    emptyLabel: 'No invite candidates right now.',
    emptyDescription: 'Meet more people first or try again later.',
    listLayout: 'card-grid',
    desktopColumns: 4,
    snapMode: 'none',
    trackBy: (_index, entry) => entry.id
  };

  protected readonly inviteSmartListLoaders: SmartListLoaders<AppTypes.ActivityMemberEntry, ActivityInviteFilters> = {
    list: query => from(this.loadInviteCandidatesPage(query))
  };

  constructor() {
    effect(() => {
      const context = this.popupCtx.activityInvitePopup();
      if (!context?.ownerId?.trim()) {
        this.resetState();
        return;
      }
      this.isOpen = true;
      this.ownerId = context.ownerId.trim();
      this.ownerType = context.ownerType ?? 'event';
      this.title = context.title?.trim() || 'Invite members';
      this.inviteSort = 'recent';
      this.showInviteSortPicker = false;
      this.selectedUserIds = [];
      this.persistedSelectedUserIds = new Set<string>();
      this.confirmErrorMessage = '';
      this.isConfirmPending = false;
      this.currentCandidates = [];
      this.candidatesByUserId.clear();
      this.candidateQueryKey = '';
      this.localCandidates = Array.isArray(context.initialCandidates)
        ? context.initialCandidates.map(candidate => ({ ...candidate }))
        : [];
      this.isLocalCandidateSource = this.localCandidates.length > 0;
      this.inviteApplyHandler = context.onApply ?? null;
      this.closeOwnerPopupOnClose = context.closeOwnerPopupOnClose === true;
      this.syncInviteSmartListQuery();
      this.cdr.markForCheck();
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.isOpen || keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    if (this.showInviteSortPicker) {
      this.showInviteSortPicker = false;
      this.cdr.markForCheck();
      return;
    }
    this.closeInvitePopup();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen || !this.showInviteSortPicker) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.closest('.friends-picker-sort')) {
      this.showInviteSortPicker = false;
      this.cdr.markForCheck();
    }
  }

  protected onInviteSmartListStateChange(
    change: SmartListStateChange<AppTypes.ActivityMemberEntry, ActivityInviteFilters>
  ): void {
    for (const entry of change.items) {
      this.candidatesByUserId.set(entry.userId, { ...entry });
    }
    this.cdr.markForCheck();
  }

  protected closeInvitePopup(event?: Event): void {
    event?.stopPropagation();
    if (this.isConfirmPending) {
      return;
    }
    const shouldCloseOwnerPopup = this.closeOwnerPopupOnClose;
    this.popupCtx.closeActivityInvitePopup();
    this.resetState();
    if (shouldCloseOwnerPopup) {
      this.ownedAssets.closePopup();
    }
  }

  protected toggleInviteSortPicker(event?: Event): void {
    event?.stopPropagation();
    if (this.isConfirmPending) {
      return;
    }
    this.showInviteSortPicker = !this.showInviteSortPicker;
    this.cdr.markForCheck();
  }

  protected selectInviteSort(sort: AppTypes.ActivityInviteSort, event?: Event): void {
    event?.stopPropagation();
    if (this.isConfirmPending) {
      return;
    }
    if (this.inviteSort === sort) {
      this.showInviteSortPicker = false;
      this.cdr.markForCheck();
      return;
    }
    this.inviteSort = sort;
    this.showInviteSortPicker = false;
    this.currentCandidates = [];
    this.candidatesByUserId.clear();
    this.candidateQueryKey = '';
    this.syncInviteSmartListQuery();
    this.inviteSmartList?.reload();
    this.cdr.markForCheck();
  }

  protected canConfirmSelection(): boolean {
    return this.selectedUserIds.length > 0 && !this.isConfirmPending;
  }

  protected async confirmSelection(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.canConfirmSelection()) {
      return;
    }
    const selected = this.selectedInviteChips();
    if (selected.length === 0) {
      return;
    }
    this.isConfirmPending = true;
    this.confirmErrorMessage = '';
    this.cdr.markForCheck();
    try {
      if (this.inviteApplyHandler) {
        await Promise.resolve(this.inviteApplyHandler(selected));
      } else {
        await this.activityInviteCandidatesService.applyInvites(this.ownerId, selected, this.ownerType);
      }
      this.isConfirmPending = false;
      this.closeInvitePopup();
    } catch {
      this.isConfirmPending = false;
      this.confirmErrorMessage = 'Unable to invite selected members.';
      this.cdr.markForCheck();
    }
  }

  protected toggleInviteCandidate(userId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.isConfirmPending || this.isInviteCandidatePersisted(userId)) {
      return;
    }
    if (this.selectedUserIds.includes(userId)) {
      this.selectedUserIds = this.selectedUserIds.filter(id => id !== userId);
      this.cdr.markForCheck();
      return;
    }
    this.selectedUserIds = [...this.selectedUserIds, userId];
    this.cdr.markForCheck();
  }

  protected isInviteCandidateSelected(userId: string): boolean {
    return this.isInviteCandidatePersisted(userId) || this.selectedUserIds.includes(userId);
  }

  protected isInviteCandidatePersisted(userId: string): boolean {
    return this.persistedSelectedUserIds.has(userId);
  }

  protected selectedInviteCount(): number {
    return this.persistedSelectedUserIds.size + this.selectedUserIds.length;
  }

  protected selectedInviteCountLabel(): string {
    const count = this.selectedInviteCount();
    return count === 1 ? '1 selected' : `${count} selected`;
  }

  protected selectedInviteBasketChips(): BasketChip[] {
    return this.selectedInviteChips().map(chip => ({
      id: chip.userId,
      label: chip.name,
      avatarLabel: chip.initials,
      avatarClass: `user-color-${chip.gender}`
    }));
  }

  protected selectedInviteChips(): AppTypes.ActivityMemberEntry[] {
    return this.selectedUserIds
      .map(userId => this.candidatesByUserId.get(userId) ?? null)
      .filter((entry): entry is AppTypes.ActivityMemberEntry => Boolean(entry));
  }

  protected inviteMetLabel(entry: AppTypes.ActivityMemberEntry): string {
    const parsed = new Date(entry.metAtIso);
    const dateLabel = Number.isNaN(parsed.getTime())
      ? ''
      : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return dateLabel ? `${entry.metWhere} · ${dateLabel}` : entry.metWhere;
  }

  private resetState(): void {
    this.isOpen = false;
    this.title = 'Invite members';
    this.ownerId = '';
    this.ownerType = 'event';
    this.inviteSort = 'recent';
    this.showInviteSortPicker = false;
    this.selectedUserIds = [];
    this.inviteSmartListQuery = {};
    this.confirmErrorMessage = '';
    this.isConfirmPending = false;
    this.currentCandidates = [];
    this.persistedSelectedUserIds = new Set<string>();
    this.candidatesByUserId.clear();
    this.candidateQueryKey = '';
    this.localCandidates = [];
    this.isLocalCandidateSource = false;
    this.inviteApplyHandler = null;
    this.closeOwnerPopupOnClose = false;
    this.cdr.markForCheck();
  }

  private syncInviteSmartListQuery(): void {
    this.inviteSmartListQuery = {
      filters: {
        ownerId: this.ownerId,
        sort: this.inviteSort,
        fallbackTitle: this.title
      }
    };
  }

  private sortLocalCandidates(sort: AppTypes.ActivityInviteSort): AppTypes.ActivityMemberEntry[] {
    const candidates = this.localCandidates.map(candidate => ({ ...candidate }));
    return candidates.sort((left, right) => {
      if (sort === 'relevant') {
        if (right.relevance !== left.relevance) {
          return right.relevance - left.relevance;
        }
        return AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso);
      }
      return AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso);
    });
  }

  private async loadInviteCandidatesPage(
    query: ListQuery<ActivityInviteFilters>
  ): Promise<PageResult<AppTypes.ActivityMemberEntry>> {
    const ownerId = query.filters?.ownerId?.trim() ?? '';
    if (!ownerId) {
      return {
        items: [],
        total: 0
      };
    }
    const inviteSort = query.filters?.sort === 'relevant' ? 'relevant' : 'recent';
    const queryKey = `${ownerId}:${this.ownerType}:${inviteSort}:${query.filters?.fallbackTitle ?? ''}:${this.isLocalCandidateSource ? 'local' : 'shared'}`;
    if (queryKey !== this.candidateQueryKey) {
      const activeUserId = this.appCtx.activeUserId().trim();
      if (this.isLocalCandidateSource) {
        this.persistedSelectedUserIds = new Set<string>();
        this.currentCandidates = this.sortLocalCandidates(inviteSort);
      } else {
        const ownerRef: AppTypes.ActivityMemberOwnerRef = {
          ownerType: this.ownerType,
          ownerId
        };
        const [candidates, currentMembers] = await Promise.all([
          this.activityInviteCandidatesService.queryCandidatesByOwner(
            ownerId,
            inviteSort,
            query.filters?.fallbackTitle,
            this.ownerType
          ),
          this.activityMembersService.queryMembersByOwner(ownerRef)
        ]);
        const persistedMembers = currentMembers.filter(member => member.userId !== activeUserId);
        this.persistedSelectedUserIds = new Set(persistedMembers.map(member => member.userId));
        this.selectedUserIds = this.selectedUserIds.filter(userId => !this.persistedSelectedUserIds.has(userId));
        this.currentCandidates = this.mergeInviteCandidates(persistedMembers, candidates, inviteSort);
      }
      this.candidateQueryKey = queryKey;
      this.candidatesByUserId.clear();
      for (const entry of this.currentCandidates) {
        this.candidatesByUserId.set(entry.userId, { ...entry });
      }
    }

    const pageSize = Math.max(1, Number(query.pageSize) || 16);
    const startIndex = Math.max(0, Number(query.page) || 0) * pageSize;
    return {
      items: this.currentCandidates.slice(startIndex, startIndex + pageSize),
      total: this.currentCandidates.length
    };
  }

  private mergeInviteCandidates(
    persistedMembers: readonly AppTypes.ActivityMemberEntry[],
    candidates: readonly AppTypes.ActivityMemberEntry[],
    sort: AppTypes.ActivityInviteSort
  ): AppTypes.ActivityMemberEntry[] {
    const mergedByUserId = new Map<string, AppTypes.ActivityMemberEntry>();
    for (const member of persistedMembers) {
      mergedByUserId.set(member.userId, { ...member });
    }
    for (const candidate of candidates) {
      const current = mergedByUserId.get(candidate.userId);
      mergedByUserId.set(candidate.userId, current ? { ...current, ...candidate, userId: candidate.userId } : { ...candidate });
    }
    return [...mergedByUserId.values()].sort((left, right) => {
      const selectedDelta = Number(this.persistedSelectedUserIds.has(right.userId)) - Number(this.persistedSelectedUserIds.has(left.userId));
      if (selectedDelta !== 0) {
        return selectedDelta;
      }
      if (sort === 'relevant' && right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }
      return AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso);
    });
  }
}
