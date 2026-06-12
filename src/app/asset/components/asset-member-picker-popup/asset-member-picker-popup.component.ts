import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';

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
  AppMenuComponent,
  BasketComponent,
  LazyBgImageDirective,
  ProgressIndicatorComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger,
  type BasketChip,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoaders,
  type SmartListStateChange
} from '../../../shared/ui';
import {
  ActivityInviteCandidatesService,
  ActivityMembersService,
  AppContext,
  AppPopupContext
} from '../../../shared/core';
import { NavigatorService } from '../../../navigator';
import { OwnedAssetsPopupFacadeService } from '../../owned-assets-popup-facade.service';

interface ActivityInviteFilters {
  ownerId?: string;
  sort?: ActivityContracts.ActivityInviteSort;
  fallbackTitle?: string;
}

type AssetMemberPickerMenuContext = {
  menu: 'invite-sort';
  sort: ActivityContracts.ActivityInviteSort;
};

@Component({
  selector: 'app-asset-member-picker-popup',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    AppMenuComponent,
    BasketComponent,
    SmartListComponent,
    LazyBgImageDirective,
    ProgressIndicatorComponent
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
  private readonly navigatorService = inject(NavigatorService);

  protected isOpen = false;
  protected title = 'Invite members';
  protected ownerId = '';
  protected ownerType: ActivityContracts.ActivityMemberOwnerType = 'event';
  protected inviteSort: ActivityContracts.ActivityInviteSort = 'recent';
  protected selectedUserIds: string[] = [];
  protected inviteSmartListQuery: Partial<ListQuery<ActivityInviteFilters>> = {};
  protected confirmErrorMessage = '';
  protected isConfirmPending = false;

  private currentCandidates: ActivityContracts.ActivityMemberEntry[] = [];
  private persistedSelectedUserIds = new Set<string>();
  private readonly candidatesByUserId = new Map<string, ActivityContracts.ActivityMemberEntry>();
  private candidateQueryKey = '';
  private localCandidates: ActivityContracts.ActivityMemberEntry[] = [];
  private isLocalCandidateSource = false;
  private inviteSelectionHydrated = false;
  private inviteApplyHandler: ((selectedCandidates: readonly ActivityContracts.ActivityMemberEntry[]) => void | Promise<void>) | null = null;
  private closeOwnerPopupOnClose = false;

  @ViewChild('inviteSmartList')
  private inviteSmartList?: SmartListComponent<ActivityContracts.ActivityMemberEntry, ActivityInviteFilters>;

  protected inviteItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<ActivityContracts.ActivityMemberEntry, ActivityInviteFilters>>;

  @ViewChild('inviteItemTemplate', { read: TemplateRef })
  private set inviteItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<ActivityContracts.ActivityMemberEntry, ActivityInviteFilters>> | undefined
  ) {
    this.inviteItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  protected readonly inviteSmartListConfig: SmartListConfig<ActivityContracts.ActivityMemberEntry, ActivityInviteFilters> = {
    pageSize: 16,
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

  protected readonly inviteSmartListLoaders: SmartListLoaders<ActivityContracts.ActivityMemberEntry, ActivityInviteFilters> = {
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
      this.inviteSelectionHydrated = false;
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
    this.closeInvitePopup();
  }

  protected onInviteSmartListStateChange(
    change: SmartListStateChange<ActivityContracts.ActivityMemberEntry, ActivityInviteFilters>
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

  protected inviteSortMenuTrigger(): AppMenuTrigger {
    return {
      label: this.inviteSort === 'recent' ? 'Recent' : 'Relevant',
      icon: this.inviteSort === 'recent' ? 'schedule' : 'auto_awesome',
      palette: this.inviteSort === 'recent' ? 'blue' : 'violet',
      disabled: () => this.isConfirmPending,
      shape: 'pill',
      ariaLabel: 'Open invite sort'
    };
  }

  protected inviteSortMenuItems(): readonly AppMenuItem<string, AssetMemberPickerMenuContext>[] {
    return [
      {
        id: 'invite-sort-recent',
        label: 'Recent',
        icon: 'schedule',
        kind: 'radio',
        active: this.inviteSort === 'recent',
        palette: 'blue',
        surface: 'tinted',
        context: { menu: 'invite-sort', sort: 'recent' }
      },
      {
        id: 'invite-sort-relevant',
        label: 'Relevant',
        icon: 'auto_awesome',
        kind: 'radio',
        active: this.inviteSort === 'relevant',
        palette: 'violet',
        surface: 'tinted',
        context: { menu: 'invite-sort', sort: 'relevant' }
      }
    ];
  }

  protected onInviteSortMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as AssetMemberPickerMenuContext | undefined;
    if (!context || context.menu !== 'invite-sort') {
      return;
    }
    this.selectInviteSort(context.sort);
  }

  private selectInviteSort(sort: ActivityContracts.ActivityInviteSort): void {
    if (this.isConfirmPending) {
      return;
    }
    if (this.inviteSort === sort) {
      this.cdr.markForCheck();
      return;
    }
    this.inviteSort = sort;
    this.currentCandidates = [];
    this.candidatesByUserId.clear();
    this.candidateQueryKey = '';
    this.syncInviteSmartListQuery();
    this.inviteSmartList?.reload();
    this.cdr.markForCheck();
  }

  protected canConfirmSelection(): boolean {
    return this.hasSelectionChanges() && !this.isConfirmPending;
  }

  protected async confirmSelection(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.canConfirmSelection()) {
      return;
    }
    const selected = this.selectedInviteChips();
    this.isConfirmPending = true;
    this.confirmErrorMessage = '';
    this.cdr.markForCheck();
    try {
      await this.applySelection(selected);
      this.isConfirmPending = false;
      this.cdr.markForCheck();
      this.closeInvitePopup();
    } catch {
      this.isConfirmPending = false;
      this.confirmErrorMessage = 'Unable to invite selected members.';
      this.cdr.markForCheck();
    }
  }

  protected toggleInviteCandidate(userId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.isConfirmPending) {
      return;
    }
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    if (this.selectedUserIds.includes(normalizedUserId)) {
      this.selectedUserIds = this.selectedUserIds.filter(id => id !== normalizedUserId);
      this.cdr.markForCheck();
      return;
    }
    this.selectedUserIds = [...this.selectedUserIds, normalizedUserId];
    this.cdr.markForCheck();
  }

  protected isInviteCandidateSelected(userId: string): boolean {
    return this.selectedUserIds.includes(userId.trim());
  }

  protected isInviteCandidatePersisted(userId: string): boolean {
    return this.persistedSelectedUserIds.has(userId);
  }

  protected selectedInviteCount(): number {
    return this.selectedUserIds.length;
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

  protected selectedInviteChips(): ActivityContracts.ActivityMemberEntry[] {
    return this.selectedUserIds
      .map(userId => this.candidatesByUserId.get(userId) ?? this.currentCandidates.find(entry => entry.userId === userId) ?? null)
      .filter((entry): entry is ActivityContracts.ActivityMemberEntry => Boolean(entry));
  }

  protected inviteMetLabel(entry: ActivityContracts.ActivityMemberEntry): string {
    const parsed = new Date(entry.metAtIso);
    const dateLabel = Number.isNaN(parsed.getTime())
      ? ''
      : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return dateLabel ? `${entry.metWhere} · ${dateLabel}` : entry.metWhere;
  }

  protected viewCandidateProfile(candidate: ActivityContracts.ActivityMemberEntry, event: Event): void {
    event.stopPropagation();
    const userId = `${candidate.userId ?? ''}`.trim();
    if (!userId) {
      return;
    }
    this.navigatorService.openProfileView({
      userId,
      label: candidate.name
    });
  }

  private resetState(): void {
    this.isOpen = false;
    this.title = 'Invite members';
    this.ownerId = '';
    this.ownerType = 'event';
    this.inviteSort = 'recent';
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
    this.inviteSelectionHydrated = false;
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

  private sortLocalCandidates(sort: ActivityContracts.ActivityInviteSort): ActivityContracts.ActivityMemberEntry[] {
    const candidates = this.localCandidates.map(candidate => ({ ...candidate }));
    if (sort === 'relevant') {
      return candidates;
    }
    return candidates.sort((left, right) => {
      return AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso);
    });
  }

  private async loadInviteCandidatesPage(
    query: ListQuery<ActivityInviteFilters>
  ): Promise<PageResult<ActivityContracts.ActivityMemberEntry>> {
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
        const ownerRef: ActivityContracts.ActivityMemberOwnerRef = {
          ownerType: this.ownerType,
          ownerId
        };
        const cachedMembers = this.activityMembersService.peekMembersByOwner(ownerRef);
        const hasCachedMemberState = cachedMembers.length > 0 || !!this.activityMembersService.peekSummaryByOwner(ownerRef);
        let currentMembers = hasCachedMemberState
          ? cachedMembers
          : await this.activityMembersService.queryMembersByOwner(ownerRef);

        const existingUserIds = [
          ...new Set([
            ...currentMembers.map(member => member.userId),
            ...this.persistedSelectedUserIds
          ])
        ];
        const candidates = await this.activityInviteCandidatesService.queryCandidatesByOwner(
          ownerId,
          inviteSort,
          query.filters?.fallbackTitle,
          this.ownerType,
          existingUserIds
        );
        const persistedMembers = currentMembers.filter(member =>
          member.userId !== activeUserId
          && member.status === 'pending'
          && member.requestKind === 'invite'
        );
        this.persistedSelectedUserIds = new Set(persistedMembers.map(member => member.userId));
        if (!this.inviteSelectionHydrated) {
          this.selectedUserIds = [...this.persistedSelectedUserIds];
          this.inviteSelectionHydrated = true;
        } else {
          this.selectedUserIds = this.selectedUserIds.filter(userId => this.persistedSelectedUserIds.has(userId) || userId.length > 0);
        }
        this.currentCandidates = this.mergeInviteCandidates(persistedMembers, candidates, inviteSort);
      }
      this.candidateQueryKey = queryKey;
      this.candidatesByUserId.clear();
      for (const entry of this.currentCandidates) {
        this.candidatesByUserId.set(entry.userId, { ...entry });
      }
      this.cdr.markForCheck();
    }

    const pageSize = Math.max(1, Number(query.pageSize) || 16);
    const startIndex = Math.max(0, Number(query.page) || 0) * pageSize;
    return {
      items: this.currentCandidates.slice(startIndex, startIndex + pageSize),
      total: this.currentCandidates.length
    };
  }

  private mergeInviteCandidates(
    persistedMembers: readonly ActivityContracts.ActivityMemberEntry[],
    candidates: readonly ActivityContracts.ActivityMemberEntry[],
    sort: ActivityContracts.ActivityInviteSort
  ): ActivityContracts.ActivityMemberEntry[] {
    const mergedByUserId = new Map<string, ActivityContracts.ActivityMemberEntry>();
    if (this.ownerType !== 'asset') {
      for (const member of persistedMembers) {
        mergedByUserId.set(member.userId, { ...member });
      }
    }
    for (const candidate of candidates) {
      const current = mergedByUserId.get(candidate.userId);
      mergedByUserId.set(candidate.userId, current ? { ...current, ...candidate, userId: candidate.userId } : { ...candidate });
    }
    const relevantOrderByUserId = new Map(candidates.map((candidate, index) => [candidate.userId, index]));
    return [...mergedByUserId.values()].sort((left, right) => {
      const selectedDelta = Number(this.selectedUserIds.includes(right.userId)) - Number(this.selectedUserIds.includes(left.userId));
      if (selectedDelta !== 0) {
        return selectedDelta;
      }
      if (sort === 'relevant') {
        const leftOrder = relevantOrderByUserId.get(left.userId) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = relevantOrderByUserId.get(right.userId) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
      }
      return AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso);
    });
  }

  private hasSelectionChanges(): boolean {
    if (this.selectedUserIds.length !== this.persistedSelectedUserIds.size) {
      return true;
    }
    return this.selectedUserIds.some(userId => !this.persistedSelectedUserIds.has(userId));
  }

  private async applySelection(selected: readonly ActivityContracts.ActivityMemberEntry[]): Promise<void> {
    if (this.inviteApplyHandler) {
      await Promise.resolve(this.inviteApplyHandler(selected));
      return;
    }
    await this.activityInviteCandidatesService.applyInvites(this.ownerId, selected, this.ownerType);
  }

}
