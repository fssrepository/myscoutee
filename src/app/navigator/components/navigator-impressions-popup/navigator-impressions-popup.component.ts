import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AppDemoGenerators } from '../../../shared/app-demo-generators';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import {
  AppContext,
  type UserDto,
  type UserImpressionsSectionDto
} from '../../../shared/core';
import {
  resolveHostTierColorClass,
  resolveHostTierIcon,
  resolveMemberImpressionTitle,
  resolveTraitColorClass,
  resolveTraitIcon
} from '../../navigator-presenters';
import { NavigatorService } from '../../navigator.service';

interface NavigatorImpressionsPulseFlags {
  hostTop: boolean;
  memberTop: boolean;
  hostChips: boolean;
  memberChips: boolean;
}

interface NavigatorImpressionsViewModel {
  user: UserDto;
  pulseFlags: NavigatorImpressionsPulseFlags;
  memberImpressionTitle: string;
  hostAverageRating: string;
  hostTotalEvents: number;
  hostPeopleMet: number;
  hostRepeatSummary: string;
  hostAttendanceNoShowSummary: string;
  hostVibeBadgeItems: string[];
  hostPersonalityBadgeItems: string[];
  hostCategoryBadgeItems: string[];
  memberTotalEvents: number;
  memberPeopleMet: number;
  memberReturneesSummary: string;
  memberNoShowCount: number;
  memberVibeBadgeItems: string[];
  memberPersonalityBadgeItems: string[];
  memberCategoryBadgeItems: string[];
}

@Component({
  selector: 'app-navigator-impressions-popup',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './navigator-impressions-popup.component.html',
  styleUrl: './navigator-impressions-popup.component.scss'
})
export class NavigatorImpressionsPopupComponent implements OnDestroy {
  private static readonly PULSE_DURATION_MS = 460;
  private static readonly DEFAULT_PULSE_FLAGS: NavigatorImpressionsPulseFlags = {
    hostTop: false,
    memberTop: false,
    hostChips: false,
    memberChips: false
  };

  private readonly appCtx = inject(AppContext);
  private readonly navigatorService = inject(NavigatorService);
  private readonly vibeCategories = APP_STATIC_DATA.vibeCategories;
  private readonly vibeIcons = APP_STATIC_DATA.vibeIcons;
  private readonly categoryIcons = APP_STATIC_DATA.categoryIcons;
  private readonly memberTraitIcons = APP_STATIC_DATA.memberTraitIcons;
  private readonly pulseFlagsRef = signal<NavigatorImpressionsPulseFlags>({
    ...NavigatorImpressionsPopupComponent.DEFAULT_PULSE_FLAGS
  });
  private lastPopupOpen = false;
  private lastTrackedUserId = '';
  private lastTrackedImpressions: UserDto['impressions'] | null = null;
  private readonly pulseTimers: Partial<
    Record<keyof NavigatorImpressionsPulseFlags, ReturnType<typeof setTimeout>>
  > = {};

  protected readonly popupOpen = this.navigatorService.impressionsPopupOpen;
  protected readonly viewModel = computed<NavigatorImpressionsViewModel | null>(() => {
    const user = this.appCtx.activeUserProfile();
    if (!user) {
      return null;
    }
    return {
      user,
      pulseFlags: this.pulseFlagsRef(),
      memberImpressionTitle: resolveMemberImpressionTitle(user.traitLabel ?? ''),
      hostAverageRating: this.resolveHostAverageRating(user),
      hostTotalEvents: this.resolveHostTotalEvents(user),
      hostPeopleMet: this.resolveHostPeopleMet(user),
      hostRepeatSummary: this.resolveHostRepeatSummary(user),
      hostAttendanceNoShowSummary: this.resolveHostAttendanceNoShowSummary(user),
      hostVibeBadgeItems: this.resolveHostVibeBadgeItems(user),
      hostPersonalityBadgeItems: this.resolveHostPersonalityBadgeItems(user),
      hostCategoryBadgeItems: this.resolveHostCategoryBadgeItems(user),
      memberTotalEvents: this.resolveMemberTotalEvents(user),
      memberPeopleMet: this.resolveMemberPeopleMet(user),
      memberReturneesSummary: this.resolveMemberReturneesSummary(user),
      memberNoShowCount: this.resolveMemberNoShowCount(user),
      memberVibeBadgeItems: this.resolveMemberVibeBadgeItems(user),
      memberPersonalityBadgeItems: this.resolveMemberPersonalityBadgeItems(user),
      memberCategoryBadgeItems: this.resolveMemberCategoryBadgeItems(user)
    };
  });

  constructor() {
    effect(() => {
      const isOpen = this.popupOpen();
      const user = this.appCtx.activeUserProfile();
      const userId = user?.id.trim() ?? '';
      const currentImpressions = userId
        ? (this.appCtx.getUserImpressions(userId) ?? user?.impressions ?? null)
        : null;

      if (!isOpen || !userId) {
        if (this.lastPopupOpen && this.lastTrackedUserId) {
          this.finalizePopupSession(this.lastTrackedUserId);
        }
        this.lastPopupOpen = false;
        this.lastTrackedUserId = userId;
        this.lastTrackedImpressions = this.cloneImpressions(currentImpressions);
        this.resetPulseFlags();
        return;
      }

      if (!this.lastPopupOpen || this.lastTrackedUserId !== userId) {
        if (this.lastPopupOpen && this.lastTrackedUserId && this.lastTrackedUserId !== userId) {
          this.finalizePopupSession(this.lastTrackedUserId);
        }
        this.lastPopupOpen = true;
        this.lastTrackedUserId = userId;
        this.lastTrackedImpressions = this.cloneImpressions(currentImpressions);
        this.resetPulseFlags();
        return;
      }

      const previous = this.lastTrackedImpressions;
      const nextHost = currentImpressions?.host;
      const nextMember = currentImpressions?.member;
      if (this.hasImpressionsTopMetricsChanged(previous?.host, nextHost)) {
        this.triggerPulse('hostTop');
      }
      if (this.hasImpressionsTopMetricsChanged(previous?.member, nextMember)) {
        this.triggerPulse('memberTop');
      }
      if (this.hasImpressionsChipListsChanged(previous?.host, nextHost)) {
        this.triggerPulse('hostChips');
      }
      if (this.hasImpressionsChipListsChanged(previous?.member, nextMember)) {
        this.triggerPulse('memberChips');
      }

      this.lastPopupOpen = true;
      this.lastTrackedUserId = userId;
      this.lastTrackedImpressions = this.cloneImpressions(currentImpressions);
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onWindowEscape(event: Event): void {
    if (!this.popupOpen()) {
      return;
    }
    (event as KeyboardEvent).stopPropagation();
    this.closePopup();
  }

  protected closePopup(): void {
    this.navigatorService.closeImpressionsPopup();
  }

  ngOnDestroy(): void {
    this.clearPulseTimers();
  }

  protected getHostTierColorClass(tier: string): string {
    return resolveHostTierColorClass(tier);
  }

  protected getHostTierIcon(tier: string): string {
    return resolveHostTierIcon(tier);
  }

  protected getTraitColorClass(trait: string): string {
    return resolveTraitColorClass(trait);
  }

  protected getTraitIcon(trait: string): string {
    return resolveTraitIcon(trait);
  }

  private activeUserImpressionsSection(user: UserDto, kind: 'host' | 'member'): UserImpressionsSectionDto | null {
    const impressions = this.appCtx.getUserImpressions(user.id) ?? user.impressions ?? null;
    if (!impressions) {
      return null;
    }
    return impressions[kind] ?? null;
  }

  private finalizePopupSession(userId: string): void {
    this.appCtx.clearUserImpressionChangeFlags(userId);
    const current = this.appCtx.getUserImpressions(userId);
    if (current) {
      this.appCtx.setUserImpressions(userId, {
        ...current,
        host: current.host
          ? {
              ...current.host,
              unreadCount: 0
            }
          : undefined,
        member: current.member
          ? {
              ...current.member,
              unreadCount: 0
            }
          : undefined
      });
    }
  }

  private resetPulseFlags(): void {
    this.clearPulseTimers();
    this.pulseFlagsRef.set({
      ...NavigatorImpressionsPopupComponent.DEFAULT_PULSE_FLAGS
    });
  }

  private clearPulseTimers(): void {
    for (const timer of Object.values(this.pulseTimers)) {
      if (timer) {
        clearTimeout(timer);
      }
    }
    for (const key of Object.keys(this.pulseTimers) as Array<keyof NavigatorImpressionsPulseFlags>) {
      delete this.pulseTimers[key];
    }
  }

  private triggerPulse(key: keyof NavigatorImpressionsPulseFlags): void {
    this.pulseFlagsRef.update(state => ({
      ...state,
      [key]: true
    }));
    const existingTimer = this.pulseTimers[key];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    this.pulseTimers[key] = setTimeout(() => {
      this.pulseFlagsRef.update(state => ({
        ...state,
        [key]: false
      }));
      delete this.pulseTimers[key];
    }, NavigatorImpressionsPopupComponent.PULSE_DURATION_MS);
  }

  private cloneImpressions(impressions: UserDto['impressions'] | null | undefined): UserDto['impressions'] | null {
    if (!impressions) {
      return null;
    }
    return {
      host: impressions.host
        ? {
            ...impressions.host,
            vibeBadges: [...(impressions.host.vibeBadges ?? [])],
            personalityBadges: [...(impressions.host.personalityBadges ?? [])],
            categoryBadges: [...(impressions.host.categoryBadges ?? [])]
          }
        : undefined,
      member: impressions.member
        ? {
            ...impressions.member,
            vibeBadges: [...(impressions.member.vibeBadges ?? [])],
            personalityBadges: [...(impressions.member.personalityBadges ?? [])],
            categoryBadges: [...(impressions.member.categoryBadges ?? [])]
          }
        : undefined
    };
  }

  private impressionSectionMetric(value: number | undefined): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private impressionSectionRating(value: number | undefined): number | null {
    if (!Number.isFinite(value)) {
      return null;
    }
    return AppUtils.clampNumber(Number(value), 0, 5);
  }

  private impressionSectionBadgeList(items: readonly string[] | undefined): string[] | null {
    if (!Array.isArray(items)) {
      return null;
    }
    const normalized = items
      .map(item => item.trim())
      .filter(item => item.length > 0);
    return normalized.length > 0 ? normalized : null;
  }

  private sortImpressionsBadgeItems(items: readonly string[]): string[] {
    const parsed = items.map(item => this.parseImpressionsBadgeItem(item));
    parsed.sort((left, right) => {
      if (left.percent !== null && right.percent !== null && left.percent !== right.percent) {
        return right.percent - left.percent;
      }
      if (left.percent !== null && right.percent === null) {
        return -1;
      }
      if (left.percent === null && right.percent !== null) {
        return 1;
      }
      return left.label.localeCompare(right.label);
    });
    return parsed.map(entry => entry.original);
  }

  private parseImpressionsBadgeItem(item: string): { original: string; label: string; percent: number | null } {
    const original = item.trim();
    const percentMatch = original.match(/^(.*?)(\d{1,3})%$/);
    if (!percentMatch) {
      return {
        original,
        label: original.toLowerCase(),
        percent: null
      };
    }
    return {
      original,
      label: percentMatch[1].trim().toLowerCase(),
      percent: Math.max(0, Math.min(100, Number.parseInt(percentMatch[2], 10) || 0))
    };
  }

  private resolveHostAverageRating(user: UserDto): string {
    const loaded = this.impressionSectionRating(this.activeUserImpressionsSection(user, 'host')?.averageRating);
    if (loaded !== null) {
      return loaded.toFixed(1);
    }
    return (AppDemoGenerators.seededMetric(user, 1, 38, 50) / 10).toFixed(1);
  }

  private resolveHostTotalEvents(user: UserDto): number {
    const loaded = this.impressionSectionMetric(this.activeUserImpressionsSection(user, 'host')?.totalEvents);
    if (loaded !== null) {
      return loaded;
    }
    return AppDemoGenerators.seededMetric(user, 9, 12, 80);
  }

  private resolveHostAttendanceNoShowSummary(user: UserDto): string {
    const loaded = this.impressionSectionMetric(this.activeUserImpressionsSection(user, 'host')?.noShowCount);
    if (loaded !== null) {
      return `${loaded}`;
    }
    const hostAttendanceTotal = this.resolveHostTotalEvents(user) * AppDemoGenerators.seededMetric(user, 18, 8, 14);
    const hostAttendanceAttended = Math.floor(hostAttendanceTotal * (AppDemoGenerators.seededMetric(user, 2, 74, 96) / 100));
    return `${Math.max(0, hostAttendanceTotal - hostAttendanceAttended)}`;
  }

  private resolveHostRepeatSummary(user: UserDto): string {
    const loaded = this.impressionSectionMetric(this.activeUserImpressionsSection(user, 'host')?.repeatCount);
    if (loaded !== null) {
      return `${loaded}`;
    }
    const total = AppDemoGenerators.seededMetric(user, 19, 60, 220);
    const repeat = Math.floor(total * (AppDemoGenerators.seededMetric(user, 4, 36, 84) / 100));
    return `${repeat}`;
  }

  private resolveHostPeopleMet(user: UserDto): number {
    const loaded = this.impressionSectionMetric(this.activeUserImpressionsSection(user, 'host')?.peopleMet);
    if (loaded !== null) {
      return loaded;
    }
    return AppDemoGenerators.seededMetric(user, 32, 90, 520);
  }

  private resolveHostVibeBadgeItems(user: UserDto): string[] {
    const loaded = this.impressionSectionBadgeList(this.activeUserImpressionsSection(user, 'host')?.vibeBadges);
    if (loaded) {
      return this.sortImpressionsBadgeItems(loaded);
    }
    const vibe = this.vibeCategories[AppDemoGenerators.seededMetric(user, 5, 0, this.vibeCategories.length - 1)];
    return this.sortImpressionsBadgeItems(AppUtils.withContextIconItems(
      `${vibe} ${AppDemoGenerators.seededMetric(user, 20, 18, 86)}%`,
      this.vibeIcons
    ));
  }

  private resolveHostPersonalityBadgeItems(user: UserDto): string[] {
    const loaded = this.impressionSectionBadgeList(this.activeUserImpressionsSection(user, 'host')?.personalityBadges);
    if (loaded) {
      return this.sortImpressionsBadgeItems(loaded);
    }
    return this.sortImpressionsBadgeItems(['🧠 Communication 60%', '🧩 Coordination 40%']);
  }

  private resolveHostCategoryBadgeItems(user: UserDto): string[] {
    const loaded = this.impressionSectionBadgeList(this.activeUserImpressionsSection(user, 'host')?.categoryBadges);
    if (loaded) {
      return this.sortImpressionsBadgeItems(loaded);
    }
    return this.sortImpressionsBadgeItems(AppUtils.withContextIconItems(
      `Sports ${AppDemoGenerators.seededMetric(user, 21, 8, 48)}%, Road Trip ${AppDemoGenerators.seededMetric(user, 22, 6, 36)}%`,
      this.categoryIcons
    ));
  }

  private resolveMemberTotalEvents(user: UserDto): number {
    const loaded = this.impressionSectionMetric(this.activeUserImpressionsSection(user, 'member')?.totalEvents);
    if (loaded !== null) {
      return loaded;
    }
    return this.resolveHostTotalEvents(user);
  }

  private resolveMemberNoShowCount(user: UserDto): number {
    const loaded = this.impressionSectionMetric(this.activeUserImpressionsSection(user, 'member')?.noShowCount);
    if (loaded !== null) {
      return loaded;
    }
    const attended = AppDemoGenerators.seededMetric(user, 23, 4, 96);
    return Math.max(0, 100 - attended);
  }

  private resolveMemberPeopleMet(user: UserDto): number {
    const loaded = this.impressionSectionMetric(this.activeUserImpressionsSection(user, 'member')?.peopleMet);
    if (loaded !== null) {
      return loaded;
    }
    return AppDemoGenerators.seededMetric(user, 24, 80, 460);
  }

  private resolveMemberReturneesSummary(user: UserDto): string {
    const loaded = this.impressionSectionMetric(this.activeUserImpressionsSection(user, 'member')?.repeatCount);
    if (loaded !== null) {
      return `${loaded}`;
    }
    const total = this.resolveMemberPeopleMet(user);
    const repeat = Math.floor(total * (AppDemoGenerators.seededMetric(user, 33, 18, 72) / 100));
    return `${repeat}`;
  }

  private resolveMemberVibeBadgeItems(user: UserDto): string[] {
    const loaded = this.impressionSectionBadgeList(this.activeUserImpressionsSection(user, 'member')?.vibeBadges);
    if (loaded) {
      return this.sortImpressionsBadgeItems(loaded);
    }
    const first = this.vibeCategories[AppDemoGenerators.seededMetric(user, 25, 0, this.vibeCategories.length - 1)];
    const second = this.vibeCategories[AppDemoGenerators.seededMetric(user, 26, 0, this.vibeCategories.length - 1)];
    return this.sortImpressionsBadgeItems(AppUtils.withContextIconItems(
      `${first} ${AppDemoGenerators.seededMetric(user, 27, 18, 74)}%, ${second} ${AppDemoGenerators.seededMetric(user, 28, 12, 62)}%`,
      this.vibeIcons
    ));
  }

  private resolveMemberPersonalityBadgeItems(user: UserDto): string[] {
    const loaded = this.impressionSectionBadgeList(this.activeUserImpressionsSection(user, 'member')?.personalityBadges);
    if (loaded) {
      return this.sortImpressionsBadgeItems(loaded);
    }
    return this.sortImpressionsBadgeItems([
      'psychiatry Adventurer 60%',
      `${this.memberTraitIcons['Deep Thinker'] ?? ''} Deep Thinker 30%`.trim(),
      `${this.memberTraitIcons['Empath'] ?? ''} Empath 10%`.trim()
    ]);
  }

  private resolveMemberCategoryBadgeItems(user: UserDto): string[] {
    const loaded = this.impressionSectionBadgeList(this.activeUserImpressionsSection(user, 'member')?.categoryBadges);
    if (loaded) {
      return this.sortImpressionsBadgeItems(loaded);
    }
    return this.sortImpressionsBadgeItems(AppUtils.withContextIconItems(
      `Outdoors ${AppDemoGenerators.seededMetric(user, 29, 40, 95)}%, Games ${AppDemoGenerators.seededMetric(user, 30, 35, 95)}%, Culture ${AppDemoGenerators.seededMetric(user, 31, 25, 90)}%`,
      this.categoryIcons
    ));
  }

  private hasImpressionsTopMetricsChanged(
    previous: UserImpressionsSectionDto | undefined,
    next: UserImpressionsSectionDto | undefined
  ): boolean {
    if (!next) {
      return false;
    }
    if (!previous) {
      return true;
    }
    return (
      (this.impressionSectionRating(previous.averageRating) ?? -1) !== (this.impressionSectionRating(next.averageRating) ?? -1)
      || (this.impressionSectionMetric(previous.peopleMet) ?? -1) !== (this.impressionSectionMetric(next.peopleMet) ?? -1)
      || (this.impressionSectionMetric(previous.totalEvents) ?? -1) !== (this.impressionSectionMetric(next.totalEvents) ?? -1)
      || (this.impressionSectionMetric(previous.repeatCount) ?? -1) !== (this.impressionSectionMetric(next.repeatCount) ?? -1)
      || (this.impressionSectionMetric(previous.noShowCount) ?? -1) !== (this.impressionSectionMetric(next.noShowCount) ?? -1)
    );
  }

  private hasImpressionsChipListsChanged(
    previous: UserImpressionsSectionDto | undefined,
    next: UserImpressionsSectionDto | undefined
  ): boolean {
    if (!next) {
      return false;
    }
    if (!previous) {
      return true;
    }
    return (
      JSON.stringify(this.sortImpressionsBadgeItems(previous.vibeBadges ?? []))
      !== JSON.stringify(this.sortImpressionsBadgeItems(next.vibeBadges ?? []))
      || JSON.stringify(this.sortImpressionsBadgeItems(previous.personalityBadges ?? []))
      !== JSON.stringify(this.sortImpressionsBadgeItems(next.personalityBadges ?? []))
      || JSON.stringify(this.sortImpressionsBadgeItems(previous.categoryBadges ?? []))
      !== JSON.stringify(this.sortImpressionsBadgeItems(next.categoryBadges ?? []))
    );
  }
}
