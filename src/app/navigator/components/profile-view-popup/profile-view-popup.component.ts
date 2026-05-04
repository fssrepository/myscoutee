import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { AppUtils } from '../../../shared/app-utils';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import {
  UserExperiencesService,
  UsersService,
  type ExperienceEntry,
  type ProfileDetailFormGroup,
  type ProfileDetailFormRow,
  type UserDto
} from '../../../shared/core';
import { NavigatorService, type NavigatorProfileViewTarget } from '../../navigator.service';

interface ProfileViewRow {
  label: string;
  value: string;
  icon?: string;
}

@Component({
  selector: 'app-profile-view-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule
  ],
  templateUrl: './profile-view-popup.component.html',
  styleUrl: './profile-view-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileViewPopupComponent {
  private readonly navigatorService = inject(NavigatorService);
  private readonly usersService = inject(UsersService);
  private readonly userExperiencesService = inject(UserExperiencesService);
  private readonly cdr = inject(ChangeDetectorRef);
  private loadToken = 0;

  protected readonly target = this.navigatorService.profileViewTarget;
  protected readonly user = signal<UserDto | null>(null);
  protected readonly loadingUser = signal(false);
  protected readonly experiences = signal<ExperienceEntry[]>([]);
  protected readonly loadingExperiences = signal(false);
  protected readonly activePhotoIndex = signal(0);
  protected readonly photos = computed(() => this.profilePhotos(this.user()));
  protected readonly activePhoto = computed(() => {
    const photos = this.photos();
    if (photos.length === 0) {
      return '';
    }
    const index = Math.max(0, Math.min(this.activePhotoIndex(), photos.length - 1));
    return photos[index] ?? photos[0] ?? '';
  });
  protected readonly basicsRows = computed(() => this.buildBasicsRows(this.user()));
  protected readonly aboutRows = computed(() => this.buildAboutRows(this.user()));
  protected readonly detailGroups = computed(() => this.buildDetailGroups(this.user()));

  constructor() {
    effect(() => {
      this.syncTarget(this.target());
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscape(event: Event): void {
    if (!this.target()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.closePopup();
  }

  protected closePopup(event?: Event): void {
    event?.stopPropagation();
    this.navigatorService.closeProfileView();
  }

  protected displayTitle(user: UserDto): string {
    const name = `${user.name ?? ''}`.trim() || this.target()?.label || 'Profile';
    return user.age > 0 ? `${name}, ${user.age}` : name;
  }

  protected headerTitle(user: UserDto | null): string {
    if (!user) {
      return 'Profile';
    }
    return this.displayTitle(user);
  }

  protected headerSubtitle(user: UserDto | null): string {
    if (!user) {
      return 'Loading profile';
    }
    return `${user.city ?? ''}`.trim() || 'City not set yet';
  }

  protected initials(user: UserDto | null): string {
    const source = `${user?.initials ?? ''}`.trim() || `${user?.name ?? this.target()?.label ?? 'Profile'}`.trim();
    return AppUtils.initialsFromText(source || 'Profile');
  }

  protected avatarClass(user: UserDto | null): string[] {
    return [`user-color-${user?.gender === 'woman' ? 'woman' : 'man'}`];
  }

  protected selectPhoto(index: number, event: Event): void {
    event.stopPropagation();
    const photos = this.photos();
    if (photos.length <= 1) {
      return;
    }
    this.activePhotoIndex.set(Math.max(0, Math.min(index, photos.length - 1)));
  }

  protected trackPhoto(index: number, photo: string): string {
    return `${index}:${photo}`;
  }

  protected trackRow(_index: number, row: ProfileViewRow | ProfileDetailFormRow): string {
    return `${row.label}:${'value' in row ? row.value : ''}`;
  }

  protected trackGroup(_index: number, group: ProfileDetailFormGroup): string {
    return group.title;
  }

  protected trackExperience(_index: number, item: ExperienceEntry): string {
    return item.id;
  }

  protected detailValueParts(row: ProfileDetailFormRow): string[] {
    return this.badgeParts(row.label, row.value);
  }

  protected badgeParts(label: string, value: string): string[] {
    if (!this.isBadgeListLabel(label)) {
      return [];
    }
    return this.splitListValue(value);
  }

  protected displayDetailValue(row: ProfileDetailFormRow): string {
    const value = `${row.value ?? ''}`.trim();
    return value || 'Not set';
  }

  protected detailGroupClass(title: string): string {
    const normalized = AppUtils.normalizeText(title).replace(/\s+/g, '-');
    return normalized ? `profile-view-section-${normalized}` : 'profile-view-section-default';
  }

  protected formattedExperienceDates(item: ExperienceEntry): string {
    const from = `${item.dateFrom ?? ''}`.trim();
    const to = `${item.dateTo ?? ''}`.trim();
    if (from && to) {
      return `${from} - ${to}`;
    }
    return from || to || 'Dates not set';
  }

  protected experienceTypeIcon(type: ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'apartment';
      case 'School':
        return 'school';
      case 'Online Session':
        return 'videocam';
      default:
        return 'rocket_launch';
    }
  }

  protected experienceTypeClass(type: ExperienceEntry['type']): string {
    switch (type) {
      case 'Workspace':
        return 'profile-view-experience-workspace';
      case 'School':
        return 'profile-view-experience-school';
      case 'Online Session':
        return 'profile-view-experience-online';
      default:
        return 'profile-view-experience-project';
    }
  }

  protected isExperienceEmpty(): boolean {
    return !this.loadingExperiences() && this.experiences().length === 0;
  }

  private syncTarget(target: NavigatorProfileViewTarget | null): void {
    const token = ++this.loadToken;
    this.experiences.set([]);
    this.loadingExperiences.set(false);
    this.activePhotoIndex.set(0);
    if (!target?.userId?.trim()) {
      this.user.set(null);
      this.loadingUser.set(false);
      return;
    }

    const embeddedUser = target.user ?? this.usersService.peekCachedUserById(target.userId);
    this.user.set(embeddedUser);
    this.loadingUser.set(!embeddedUser);
    this.cdr.markForCheck();

    if (!embeddedUser) {
      void this.loadMissingUser(target.userId, token);
    }
    void this.loadExperiences(target.userId, token);
  }

  private async loadMissingUser(userId: string, token: number): Promise<void> {
    const loadedUser = await this.usersService.loadUserById(userId, 1500);
    if (token !== this.loadToken || !this.target()?.userId?.trim()) {
      return;
    }
    this.user.set(loadedUser);
    this.loadingUser.set(false);
    this.cdr.markForCheck();
  }

  private async loadExperiences(userId: string, token: number): Promise<void> {
    this.loadingExperiences.set(true);
    this.cdr.markForCheck();
    try {
      const entries = await this.userExperiencesService.loadUserExperiences(userId);
      if (token !== this.loadToken) {
        return;
      }
      this.experiences.set(entries);
    } catch {
      if (token !== this.loadToken) {
        return;
      }
      this.experiences.set([]);
    } finally {
      if (token === this.loadToken) {
        this.loadingExperiences.set(false);
        this.cdr.markForCheck();
      }
    }
  }

  private profilePhotos(user: UserDto | null): string[] {
    return [...new Set(
      (Array.isArray(user?.images) ? user.images : [])
        .map(image => `${image ?? ''}`.trim())
        .filter(Boolean)
    )];
  }

  private buildBasicsRows(user: UserDto | null): ProfileViewRow[] {
    if (!user) {
      return [];
    }
    return [
      { label: 'Name', value: this.valueOrNotSet(user.name), icon: 'badge' },
      { label: 'Birthday', value: this.formatDate(user.birthday), icon: 'cake' },
      { label: 'City', value: this.valueOrNotSet(user.city), icon: 'location_on' },
      { label: 'Height', value: this.heightLabel(user.height), icon: 'height' },
      { label: 'Physique', value: this.valueOrNotSet(user.physique), icon: 'accessibility_new' },
      { label: 'Languages', value: this.listLabel(user.languages), icon: 'translate' },
      { label: 'Horoscope', value: this.valueOrNotSet(user.horoscope), icon: 'auto_awesome' }
    ];
  }

  private buildAboutRows(user: UserDto | null): ProfileViewRow[] {
    if (!user) {
      return [];
    }
    return [
      { label: 'Headline', value: this.valueOrNotSet(user.headline), icon: 'short_text' },
      { label: 'About', value: this.valueOrNotSet(user.about), icon: 'notes' },
      { label: 'Status', value: this.valueOrNotSet(user.statusText), icon: 'campaign' }
    ];
  }

  private buildDetailGroups(user: UserDto | null): ProfileDetailFormGroup[] {
    if (!user) {
      return [];
    }
    const groups = this.profileDetailGroupsForUser(user);
    const duplicatedBasics = new Set(['name', 'city', 'birthday', 'height', 'physique', 'languages', 'horoscope']);
    return groups
      .map(group => ({
        ...group,
        rows: (group.rows ?? [])
          .filter(row => !duplicatedBasics.has(AppUtils.normalizeText(row.label)))
          .filter(row => `${row.value ?? ''}`.trim().length > 0)
      }))
      .filter(group => group.rows.length > 0);
  }

  private profileDetailGroupsForUser(user: UserDto): ProfileDetailFormGroup[] {
    const persisted = this.hydratePersistedProfileDetails(user);
    if (persisted.length > 0) {
      return persisted;
    }
    if (!this.hasProfileSeedBase(user)) {
      return [];
    }
    return APP_STATIC_DATA.profileDetailGroupTemplates.map(group => ({
      title: group.title,
      rows: group.rows.map(row => ({
        label: row.label,
        value: this.profileDetailSeedValue(user, row.label, ''),
        privacy: row.privacy,
        options: this.profileDetailOptionsForLabel(row.label)
      }))
    }));
  }

  private hydratePersistedProfileDetails(user: UserDto): ProfileDetailFormGroup[] {
    if (!Array.isArray(user.profileDetails) || user.profileDetails.length === 0) {
      return [];
    }
    const rowByLabel = new Map<string, ProfileDetailFormRow>();
    for (const group of user.profileDetails) {
      for (const row of group.rows ?? []) {
        const normalizedLabel = AppUtils.normalizeText(`${row.label ?? ''}`.trim());
        if (!normalizedLabel) {
          continue;
        }
        rowByLabel.set(normalizedLabel, {
          label: row.label,
          value: row.value,
          privacy: row.privacy,
          options: [...(row.options ?? [])]
        });
      }
    }
    return APP_STATIC_DATA.profileDetailGroupTemplates.map(group => ({
      title: group.title,
      rows: group.rows.map(row => {
        const persisted = rowByLabel.get(AppUtils.normalizeText(row.label));
        return {
          label: row.label,
          value: persisted?.value ?? this.profileDetailSeedValue(user, row.label, ''),
          privacy: persisted?.privacy ?? row.privacy,
          options: this.profileDetailOptionsForLabel(row.label, persisted?.options ?? [])
        };
      })
    }));
  }

  private profileDetailOptionsForLabel(label: string, persistedOptions: readonly string[] = []): string[] {
    const defaults = AppUtils.normalizeText(label) === 'values'
      ? this.beliefsValuesAllOptions()
      : AppUtils.normalizeText(label) === 'interest'
        ? this.interestAllOptions()
        : APP_STATIC_DATA.profileDetailValueOptions[label] ?? [];
    const merged = [...defaults];
    for (const option of persistedOptions) {
      const normalized = `${option ?? ''}`.trim();
      if (normalized && !merged.includes(normalized)) {
        merged.push(normalized);
      }
    }
    return merged;
  }

  private profileDetailSeedValue(user: UserDto, label: string, fallback: string): string {
    switch (label) {
      case 'Name':
        return user.name;
      case 'City':
        return user.city;
      case 'Birthday':
        return this.formatDate(user.birthday) === 'Not set' ? fallback : this.formatDate(user.birthday);
      case 'Height':
        return user.height;
      case 'Physique':
        return user.physique;
      case 'Languages':
        return user.languages.join(', ');
      case 'Horoscope':
        return user.horoscope;
      case 'Gender':
        return user.gender === 'woman' ? 'Woman' : 'Man';
      case 'Interest':
        return this.seededOptionsForUser(user, this.interestAllOptions(), 3, label).join(', ');
      case 'Values':
        return this.seededOptionsForUser(user, this.beliefsValuesAllOptions(), 3, label).join(', ');
      default: {
        const options = APP_STATIC_DATA.profileDetailValueOptions[label] ?? [];
        if (options.length === 0) {
          return fallback;
        }
        return this.seededOptionForUser(user, options, label);
      }
    }
  }

  private seededOptionForUser(user: UserDto, options: string[], context: string): string {
    if (options.length === 0) {
      return '';
    }
    const seed = AppUtils.hashText(`profile-detail:${user.id}:${context}`);
    return options[seed % options.length] ?? options[0];
  }

  private seededOptionsForUser(user: UserDto, options: string[], count: number, context: string): string[] {
    if (options.length === 0 || count <= 0) {
      return [];
    }
    const start = AppUtils.hashText(`profile-detail-list:${user.id}:${context}`) % options.length;
    const selected: string[] = [];
    let index = start;
    while (selected.length < Math.min(count, options.length)) {
      const option = options[index % options.length];
      if (!selected.includes(option)) {
        selected.push(option);
      }
      index += 3;
    }
    return selected;
  }

  private beliefsValuesAllOptions(): string[] {
    return APP_STATIC_DATA.beliefsValuesOptionGroups.flatMap(group => group.options);
  }

  private interestAllOptions(): string[] {
    return APP_STATIC_DATA.interestOptionGroups.flatMap(group => group.options);
  }

  private hasProfileSeedBase(user: UserDto): boolean {
    return [
      user.name,
      user.birthday,
      user.city,
      user.height,
      user.physique,
      user.horoscope,
      user.headline,
      user.about,
      ...(user.languages ?? []),
      ...(user.images ?? [])
    ].some(value => `${value ?? ''}`.trim().length > 0);
  }

  private isBadgeListLabel(label: string): boolean {
    const normalized = AppUtils.normalizeText(label);
    return normalized === 'languages' || normalized === 'interest' || normalized === 'values';
  }

  private splitListValue(value: string): string[] {
    return `${value ?? ''}`
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private listLabel(values: readonly string[] | null | undefined): string {
    const normalizedValues = (Array.isArray(values) ? values : []).map(value => `${value ?? ''}`.trim()).filter(Boolean);
    return normalizedValues.length > 0 ? normalizedValues.join(', ') : 'Not set';
  }

  private heightLabel(value: string): string {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return 'Not set';
    }
    return /\bcm\b/i.test(normalized) ? normalized : `${normalized} cm`;
  }

  private valueOrNotSet(value: string | null | undefined): string {
    const normalized = `${value ?? ''}`.trim();
    return normalized || 'Not set';
  }

  private formatDate(value: string | null | undefined): string {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return 'Not set';
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return normalized;
    }
    return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

}
