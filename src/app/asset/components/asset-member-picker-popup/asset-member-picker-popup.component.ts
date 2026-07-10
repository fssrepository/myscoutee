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
import {
  from
} from 'rxjs';

import {
  AppUtils
} from '../../../shared/app-utils';
import {
  ImageCardComponent,
  PopupComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger,
  type ImageCardData,
  type ImageCardMediaAction,
  type ImageCardMediaActionEvent,
  type ListQuery,
  type PageResult,
  type PopupControl,
  type PopupModel,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoaders,
  type SmartListStateChange
} from '../../../shared/ui';
import {
  ActivityInviteCandidatesService,
  ActivityMembersService
} from '../../../shared/core';
import {
  ProfileStore
} from '../../../shared/ui/context/stores/profile.store';
import {
  AssetPopupStore
} from '../../../shared/ui/context/stores/asset-popup.store';
import {
  AssetStore
} from '../../../shared/ui/context/stores/asset.store';

import type * as AppConstants from '../../../shared/core/common/constants';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';
import { ActivityInvitePopupStore } from '../../../shared/ui/context/stores/activity-invite-popup.store';
interface ActivityInviteFilters {
  ownerId?: string;
  sort?: AppConstants.ActivityInviteSort;
  fallbackTitle?: string;
}

type AssetMemberPickerMenuContext =
  | { menu: 'invite-sort'; sort: AppConstants.ActivityInviteSort }
  | { menu: 'invite-basket'; candidate: ActivityContracts.ActivityMemberDTO }
  | { menu: 'confirm' };

@Component({
  selector: 'app-asset-member-picker-popup',
  standalone: true,
  imports: [
    PopupComponent,
    SmartListComponent,
    ImageCardComponent
  ],
  templateUrl: './asset-member-picker-popup.component.html',
  styleUrls: ['./asset-member-picker-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetMemberPickerPopupComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly runtimeStore = inject(AppRuntimeStore);
  private readonly activityInviteStore = inject(ActivityInvitePopupStore);
  private readonly activityInviteCandidatesService = inject(ActivityInviteCandidatesService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly assetPopupStore = inject(AssetPopupStore);
  private readonly assetStore = inject(AssetStore);
  private readonly profileStore = inject(ProfileStore);

  protected isOpen = false;
  protected title = 'Invite members';
  protected ownerId = '';
  protected ownerType: AppConstants.ActivityMemberOwnerType = 'event';
  protected inviteSort: AppConstants.ActivityInviteSort = 'recent';
  protected selectedUserIds: string[] = [];
  protected inviteSmartListQuery: Partial<ListQuery<ActivityInviteFilters>> = {};
  protected confirmErrorMessage = '';
  protected isConfirmPending = false;

  private currentCandidates: ActivityContracts.ActivityMemberDTO[] = [];
  private persistedSelectedUserIds = new Set<string>();
  private readonly candidatesByUserId = new Map<string, ActivityContracts.ActivityMemberDTO>();
  private candidateQueryKey = '';
  private localCandidates: ActivityContracts.ActivityMemberDTO[] = [];
  private isLocalCandidateSource = false;
  private inviteSelectionHydrated = false;
  private inviteApplyHandler: ((selectedCandidates: readonly ActivityContracts.ActivityMemberDTO[]) => void | Promise<void>) | null = null;
  private closeOwnerPopupOnClose = false;

  @ViewChild('inviteSmartList')
  private inviteSmartList?: SmartListComponent<ActivityContracts.ActivityMemberDTO, ActivityInviteFilters>;

  protected inviteItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<ActivityContracts.ActivityMemberDTO, ActivityInviteFilters>>;

  @ViewChild('inviteItemTemplate', { read: TemplateRef })
  protected set inviteItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<ActivityContracts.ActivityMemberDTO, ActivityInviteFilters>> | undefined
  ) {
    this.inviteItemTemplateRef = value;
    this.cdr.markForCheck();
  }

  protected readonly inviteSmartListConfig: SmartListConfig<ActivityContracts.ActivityMemberDTO, ActivityInviteFilters> = {
    pageSize: 16,
    defaultView: 'list',
    headerProgress: {
      enabled: true,
      state: () => this.runtimeStore.isOnline() ? 'active' : 'inactive'
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

  protected readonly inviteSmartListLoaders: SmartListLoaders<ActivityContracts.ActivityMemberDTO, ActivityInviteFilters> = {
    list: query => from(this.loadInviteCandidatesPage(query))
  };

  protected invitePopupModel(): PopupModel<AssetMemberPickerMenuContext> {
    return {
      title: 'Invite members',
      subtitle: this.title !== 'Invite members' ? this.title : null,
      translateSubtitle: false,
      ariaLabel: 'Invite members',
      closeAriaLabel: 'Close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerControls: this.invitePopupHeaderControls(),
      toolbarControls: this.invitePopupToolbarControls(),
      onClose: event => this.closeInvitePopup(event),
      onMenuSelect: event => this.onInviteMenuSelect(event.itemSelect)
    };
  }

  protected invitePopupZIndex(): number {
    return 12480;
  }

  private invitePopupHeaderControls(): PopupControl<AssetMemberPickerMenuContext>[] {
    return [{
      kind: 'menu',
      id: 'invite-actions',
      menuKind: 'inline',
      items: this.inviteConfirmMenuItems(),
      panelAlign: 'end',
      mobileBreakpointPx: 900,
      closeOnSelect: false
    }];
  }

  private invitePopupToolbarControls(): PopupControl<AssetMemberPickerMenuContext>[] {
    return [{
      kind: 'menu',
      id: 'invite-sort',
      align: 'end',
      trigger: this.inviteSortMenuTrigger(),
      items: this.inviteSortMenuItems(),
      mobileBreakpointPx: 900
    }];
  }

  constructor() {
    effect(() => {
      const context = this.activityInviteStore.activityInvitePopup();
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
    change: SmartListStateChange<ActivityContracts.ActivityMemberDTO, ActivityInviteFilters>
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
    this.activityInviteStore.closeActivityInvitePopup();
    this.resetState();
    if (shouldCloseOwnerPopup) {
      this.assetStore.closeAssetPopup();
      this.assetPopupStore.resetTicketState();
      this.assetPopupStore.primaryVisibleRef.set(false);
    }
  }

  protected inviteSortMenuTrigger(): AppMenuTrigger {
    return {
      label: this.inviteSort === 'recent' ? 'Recent' : 'Relevant',
      icon: this.inviteSort === 'recent' ? 'schedule' : 'auto_awesome',
      palette: this.inviteSort === 'recent' ? 'blue' : 'violet',
      disabled: () => this.isConfirmPending,
      layout: 'pill',
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

  protected inviteConfirmMenuItems(): readonly AppMenuItem<string, AssetMemberPickerMenuContext>[] {
    const hasError = !this.isConfirmPending && !!this.confirmErrorMessage;
    const items: AppMenuItem<string, AssetMemberPickerMenuContext>[] = [];
    const count = this.selectedInviteCount();
    if (count > 0) {
      items.push({
        id: 'invite-basket',
        icon: 'groups',
        openIcon: 'groups',
        palette: 'blue',
        kind: 'branch',
        counter: count,
        ariaLabel: 'Open selected members',
        items: this.selectedInviteBasketMenuItems()
      });
    }
    items.push({
      id: 'invite-confirm',
      icon: 'done',
      layout: 'action',
      palette: hasError || !this.hasSelectionChanges() ? 'danger' : 'success',
      disabled: !this.canConfirmSelection(),
      ariaLabel: 'Invite selected members',
      progress: this.isConfirmPending || hasError
        ? {
            state: this.isConfirmPending ? 'loading' : 'error',
            shape: 'circle'
          }
        : null,
      context: { menu: 'confirm' }
    });
    return items;
  }

  protected selectedInviteBasketMenuItems(): readonly AppMenuItem<string, AssetMemberPickerMenuContext>[] {
    return this.selectedInviteChips().map(candidate => ({
      id: `invite-basket-${candidate.userId}`,
      label: candidate.name,
      description: this.inviteMetLabel(candidate),
      icon: 'person',
      kind: 'action',
      palette: 'blue',
      surface: 'tinted',
      removable: true,
      removeIcon: 'close',
      removeAriaLabel: `Remove ${candidate.name}`,
      closeOnSelect: false,
      context: { menu: 'invite-basket', candidate }
    }));
  }

  protected onInviteMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as AssetMemberPickerMenuContext | undefined;
    if (!context) {
      return;
    }
    if (context.menu === 'invite-basket') {
      if (event.action === 'remove') {
        this.toggleInviteCandidate(context.candidate.userId, event.sourceEvent);
      }
      return;
    }
    if (context.menu === 'confirm') {
      void this.confirmSelection(event.sourceEvent);
      return;
    }
    this.selectInviteSort(context.sort);
  }

  private selectInviteSort(sort: AppConstants.ActivityInviteSort): void {
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

  protected selectedInviteChips(): ActivityContracts.ActivityMemberDTO[] {
    return this.selectedUserIds
      .map(userId => this.candidatesByUserId.get(userId) ?? this.currentCandidates.find(entry => entry.userId === userId) ?? null)
      .filter((entry): entry is ActivityContracts.ActivityMemberDTO => Boolean(entry));
  }

  protected inviteMetLabel(entry: ActivityContracts.ActivityMemberDTO): string {
    const parsed = new Date(entry.metAtIso);
    const dateLabel = Number.isNaN(parsed.getTime())
      ? ''
      : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return dateLabel ? `${entry.metWhere} · ${dateLabel}` : entry.metWhere;
  }

  protected inviteCandidateCard(candidate: ActivityContracts.ActivityMemberDTO): ImageCardData {
    return {
      id: candidate.id,
      title: candidate.name,
      subtitle: this.inviteMetLabel(candidate),
      imageUrl: candidate.avatarUrl,
      placeholderIcon: 'highlight_off',
      placeholderLabel: candidate.initials,
      layout: 'overlay',
      toneClass: 'asset-invite-candidate-card'
    };
  }

  protected inviteCandidateMediaActions(candidate: ActivityContracts.ActivityMemberDTO): readonly ImageCardMediaAction[] {
    const selected = this.isInviteCandidateSelected(candidate.userId);
    return [
      {
        id: 'toggle',
        icon: 'add',
        selectedIcon: 'check',
        ariaLabel: selected ? 'Unselect friend' : 'Select friend',
        position: 'top-right',
        tone: selected ? 'success' : 'default',
        selected,
        disabled: this.isConfirmPending,
        className: this.isInviteCandidatePersisted(candidate.userId) ? 'is-persisted' : null
      },
      {
        id: 'view',
        icon: 'visibility',
        ariaLabel: 'View profile',
        position: 'bottom-right',
        tone: 'info',
        disabled: this.isConfirmPending
      }
    ];
  }

  protected onInviteCandidateMediaAction(
    candidate: ActivityContracts.ActivityMemberDTO,
    event: ImageCardMediaActionEvent
  ): void {
    switch (event.action.id) {
      case 'toggle':
        this.toggleInviteCandidate(candidate.userId, event.sourceEvent);
        return;
      case 'view':
        this.viewCandidateProfile(candidate, event.sourceEvent);
        return;
      default:
        return;
    }
  }

  protected viewCandidateProfile(candidate: ActivityContracts.ActivityMemberDTO, event: Event): void {
    event.stopPropagation();
    const userId = `${candidate.userId ?? ''}`.trim();
    if (!userId) {
      return;
    }
    this.profileStore.openProfileView({
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

  private sortLocalCandidates(sort: AppConstants.ActivityInviteSort): ActivityContracts.ActivityMemberDTO[] {
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
  ): Promise<PageResult<ActivityContracts.ActivityMemberDTO>> {
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
      const activeUserId = this.userProfileStore.activeUserId().trim();
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
    persistedMembers: readonly ActivityContracts.ActivityMemberDTO[],
    candidates: readonly ActivityContracts.ActivityMemberDTO[],
    sort: AppConstants.ActivityInviteSort
  ): ActivityContracts.ActivityMemberDTO[] {
    const mergedByUserId = new Map<string, ActivityContracts.ActivityMemberDTO>();
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

  private async applySelection(selected: readonly ActivityContracts.ActivityMemberDTO[]): Promise<void> {
    if (this.inviteApplyHandler) {
      await Promise.resolve(this.inviteApplyHandler(selected));
      return;
    }
    await this.activityInviteCandidatesService.applyInvites(this.ownerId, selected, this.ownerType);
  }

}
