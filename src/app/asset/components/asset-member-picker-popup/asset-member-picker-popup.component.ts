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
import {
  SmartListComponent,
  type ListQuery,
  type PageResult,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoaders,
  type SmartListStateChange
} from '../../../shared/ui';
import { ActivityInviteCandidatesService, AppContext } from '../../../shared/core';

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
    SmartListComponent
  ],
  templateUrl: './asset-member-picker-popup.component.html',
  styleUrls: ['./asset-member-picker-popup.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssetMemberPickerPopupComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly appCtx = inject(AppContext);
  private readonly activityInviteCandidatesService = inject(ActivityInviteCandidatesService);

  protected isOpen = false;
  protected title = 'Invite members';
  protected ownerId = '';
  protected inviteSort: AppTypes.ActivityInviteSort = 'recent';
  protected showInviteSortPicker = false;
  protected selectedUserIds: string[] = [];
  protected inviteSmartListQuery: Partial<ListQuery<ActivityInviteFilters>> = {};

  private currentCandidates: AppTypes.ActivityMemberEntry[] = [];
  private readonly candidatesByUserId = new Map<string, AppTypes.ActivityMemberEntry>();
  private candidateQueryKey = '';

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
    loadingDelayMs: 0,
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
      const context = this.appCtx.activityInvitePopup();
      if (!context?.ownerId?.trim()) {
        this.resetState();
        return;
      }
      this.isOpen = true;
      this.ownerId = context.ownerId.trim();
      this.title = context.title?.trim() || 'Invite members';
      this.inviteSort = 'recent';
      this.showInviteSortPicker = false;
      this.selectedUserIds = [];
      this.currentCandidates = [];
      this.candidatesByUserId.clear();
      this.candidateQueryKey = '';
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
    this.appCtx.closeActivityInvitePopup();
    this.resetState();
  }

  protected toggleInviteSortPicker(event?: Event): void {
    event?.stopPropagation();
    this.showInviteSortPicker = !this.showInviteSortPicker;
    this.cdr.markForCheck();
  }

  protected selectInviteSort(sort: AppTypes.ActivityInviteSort, event?: Event): void {
    event?.stopPropagation();
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
    this.selectedUserIds = [];
    this.syncInviteSmartListQuery();
    this.inviteSmartList?.reload();
    this.cdr.markForCheck();
  }

  protected canConfirmSelection(): boolean {
    return this.selectedUserIds.length > 0;
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
    await this.activityInviteCandidatesService.applyInvites(this.ownerId, selected);
    this.closeInvitePopup();
  }

  protected toggleInviteCandidate(userId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedUserIds.includes(userId)) {
      this.selectedUserIds = this.selectedUserIds.filter(id => id !== userId);
      this.cdr.markForCheck();
      return;
    }
    this.selectedUserIds = [...this.selectedUserIds, userId];
    this.cdr.markForCheck();
  }

  protected isInviteCandidateSelected(userId: string): boolean {
    return this.selectedUserIds.includes(userId);
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
    this.inviteSort = 'recent';
    this.showInviteSortPicker = false;
    this.selectedUserIds = [];
    this.inviteSmartListQuery = {};
    this.currentCandidates = [];
    this.candidatesByUserId.clear();
    this.candidateQueryKey = '';
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
    const queryKey = `${ownerId}:${query.filters?.sort ?? 'recent'}:${query.filters?.fallbackTitle ?? ''}`;
    if (queryKey !== this.candidateQueryKey) {
      this.currentCandidates = await this.activityInviteCandidatesService.queryCandidatesByOwner(
        ownerId,
        query.filters?.sort === 'relevant' ? 'relevant' : 'recent',
        query.filters?.fallbackTitle
      );
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
}
