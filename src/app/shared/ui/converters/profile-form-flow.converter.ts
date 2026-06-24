import { APP_STATIC_DATA } from '../../app-static-data';
import { AppUtils } from '../../app-utils';
import type { ProfileExtDto, UserDto } from '../../core/contracts/user.interface';
import { CURRENT_PROFILE_FORM_VERSION, type DetailPrivacy, type ProfileStatus } from '../../core/common/constants';
import type { ExperienceEntry, ProfileDetailFormGroup } from '../../core/contracts/profile.interface';
import type {
  AppMenuItem,
  AppMenuPalette,
  AppMenuTrigger
} from '../components/menu/menu.types';
import { buildTabbedMenuModel } from '../components/menu/menu-option-groups';
import type {
  FormFlowCompletionItemConfig,
  FormFlowControlModel,
  FormFlowDateMetaValue,
  FormFlowDraft,
  FormFlowMenuControlConfig,
  FormFlowModel,
  FormFlowStepModel
} from '../components/form-flow/form-flow.types';
import { formFlowCompletionPercent } from '../components/form-flow/form-flow.utils';
import type { UiConverter } from './converter.types';

export interface ProfileFormFlowPrivacyOptions {
  values?: Record<string, DetailPrivacy | undefined>;
  experience?: Partial<Record<'workspace' | 'school', DetailPrivacy | undefined>>;
}

export interface ProfileFormFlowConverterOptions {
  title?: string | null;
  subtitle?: string | null;
  userId?: string | null;
  layout?: FormFlowModel['layout'];
  profileSize?: 'small' | 'big';
  imageEditor?: 'flow' | 'external';
  privacy?: ProfileFormFlowPrivacyOptions | null;
  showHeader?: boolean;
  showSave?: boolean;
  saveDisabled?: boolean;
}

export type ProfileFormFlowMenuContext =
  | { menu: 'field'; field: string; value: string }
  | { menu: 'experienceSelector'; value: Extract<ExperienceEntry['type'], 'Workspace' | 'School'> }
  | { menu: 'privacy'; key: string; value: DetailPrivacy }
  | { menu: 'experiencePrivacy'; type: 'workspace' | 'school'; value: DetailPrivacy };

type HoroscopeBadgeMeta = {
  label: string;
  icon: string;
  palette: NonNullable<FormFlowDateMetaValue['palette']>;
};

export class ProfileFormFlowDataConverter {
  static convert(user: UserDto): FormFlowDraft<ProfileExtDto>;
  static convert(draft: FormFlowDraft<ProfileExtDto>): FormFlowDraft<ProfileExtDto>;
  static convert(value: UserDto | FormFlowDraft<ProfileExtDto>): FormFlowDraft<ProfileExtDto> {
    return this.isDraft(value)
      ? this.normalizeDraft(value)
      : this.createDraft(value);
  }

  private static isDraft(value: UserDto | FormFlowDraft<ProfileExtDto>): value is FormFlowDraft<ProfileExtDto> {
    return 'data' in value && 'currentStepId' in value;
  }

  private static createDraft(user: UserDto): FormFlowDraft<ProfileExtDto> {
    return this.normalizeDraft({
      version: 1,
      userId: user.id.trim(),
      currentStepId: 'basics',
      updatedAtIso: new Date().toISOString(),
      completedStepIds: [],
      skippedStepIds: [],
      data: this.initialData(user)
    });
  }

  private static initialData(user: UserDto): ProfileExtDto {
    const profile = this.normalizeProfile(user);
    profile.profileDetails = this.normalizeProfileDetails(profile);
    return {
      profile,
      experienceEntries: []
    };
  }

  private static normalizeDraft(draft: FormFlowDraft<ProfileExtDto>): FormFlowDraft<ProfileExtDto> {
    const data = this.normalizeData(draft.data);
    return {
      version: 1,
      userId: `${draft.userId ?? data.profile.id ?? ''}`.trim(),
      currentStepId: this.normalizeStepId(draft.currentStepId),
      updatedAtIso: new Date().toISOString(),
      completedStepIds: this.normalizeStepIds(draft.completedStepIds),
      skippedStepIds: this.normalizeStepIds(draft.skippedStepIds),
      data
    };
  }

  private static normalizeData(data: ProfileExtDto): ProfileExtDto {
    const profile = this.normalizeProfile(data.profile);
    const experienceEntries = this.normalizeExperienceEntries(data.experienceEntries ?? []);
    const normalizedProfile: UserDto = {
      ...profile,
      profileDetails: this.normalizeProfileDetails(profile),
      profileFormVersion: CURRENT_PROFILE_FORM_VERSION
    };
    normalizedProfile.completion = ProfileFormFlowConverter.completionPercent({
      profile: normalizedProfile,
      experienceEntries
    });
    return {
      profile: normalizedProfile,
      experienceEntries
    };
  }

  private static normalizeProfile(user: UserDto): UserDto {
    const birthday = AppUtils.isIsoDate(user.birthday) ? user.birthday.trim() : '';
    const name = `${user.name ?? ''}`.trim();
    return {
      ...user,
      name,
      initials: AppUtils.initialsFromText(name),
      birthday,
      age: AppUtils.ageFromIsoDate(birthday, user.age),
      city: `${user.city ?? ''}`.trim(),
      height: this.normalizeHeightValue(user.height),
      physique: `${user.physique ?? ''}`.trim(),
      languages: this.normalizeStringList(user.languages),
      horoscope: birthday ? AppUtils.horoscopeByDate(AppUtils.fromIsoDate(birthday) as Date) : `${user.horoscope ?? ''}`.trim(),
      headline: `${user.headline ?? ''}`.trim(),
      about: `${user.about ?? ''}`.trim().slice(0, 160),
      images: this.normalizeStringList(user.images).slice(0, 8),
      profileStatus: this.normalizeProfileStatus(user.profileStatus),
      profileDetails: this.normalizeProfileDetails(user),
      activities: {
        game: user.activities?.game ?? 0,
        chat: user.activities?.chat ?? 0,
        invitations: user.activities?.invitations ?? 0,
        events: user.activities?.events ?? 0,
        hosting: user.activities?.hosting ?? 0,
        cars: user.activities?.cars ?? 0,
        accommodation: user.activities?.accommodation ?? 0,
        supplies: user.activities?.supplies ?? 0,
        tickets: user.activities?.tickets ?? 0,
        contacts: user.activities?.contacts ?? 0,
        feedback: user.activities?.feedback ?? 0,
        event: user.activities?.event ? { ...user.activities.event } : undefined,
        asset: user.activities?.asset ? { ...user.activities.asset } : undefined,
        eventFeedback: user.activities?.eventFeedback ? { ...user.activities.eventFeedback } : undefined,
        adminJobs: user.activities?.adminJobs,
        adminMetrics: user.activities?.adminMetrics
      },
      impressions: user.impressions
        ? {
            host: user.impressions.host ? { ...user.impressions.host } : undefined,
            member: user.impressions.member ? { ...user.impressions.member } : undefined
          }
        : undefined
    };
  }

  private static normalizeProfileDetails(user: UserDto): ProfileDetailFormGroup[] {
    return APP_STATIC_DATA.profileDetailGroupTemplates.map(group => ({
      title: group.title,
      rows: group.rows.map(row => ({
        labelKey: row.labelKey,
        value: this.profileDetailValue(user, row.labelKey) || this.profileDetailSeedValue(user, row.labelKey),
        privacy: this.profileDetailPrivacy(user, row.labelKey, row.privacy),
        options: this.profileDetailOptions(row.labelKey)
      }))
    }));
  }

  static profileDetailValue(user: UserDto | null | undefined, labelKey: string): string {
    const normalizedLabel = this.normalizeToken(labelKey);
    for (const group of user?.profileDetails ?? []) {
      for (const row of group.rows ?? []) {
        if (this.normalizeToken(row.labelKey) === normalizedLabel) {
          return `${row.value ?? ''}`.trim();
        }
      }
    }
    return '';
  }

  private static profileDetailPrivacy(user: UserDto, labelKey: string, fallback: DetailPrivacy): DetailPrivacy {
    const normalizedLabel = this.normalizeToken(labelKey);
    for (const group of user.profileDetails ?? []) {
      for (const row of group.rows ?? []) {
        if (this.normalizeToken(row.labelKey) === normalizedLabel && this.isDetailPrivacy(row.privacy)) {
          return row.privacy;
        }
      }
    }
    return fallback;
  }

  private static profileDetailSeedValue(user: UserDto, labelKey: string): string {
    switch (labelKey) {
      case 'profile.name':
        return `${user.name ?? ''}`.trim();
      case 'profile.city':
        return `${user.city ?? ''}`.trim();
      case 'profile.birthday':
        return this.formatDateForDetail(user.birthday);
      case 'profile.height':
        return this.normalizeHeightValue(user.height);
      case 'profile.physique':
        return `${user.physique ?? ''}`.trim();
      case 'profile.languages':
        return this.normalizeStringList(user.languages).join(', ');
      case 'profile.horoscope':
        return `${user.horoscope ?? ''}`.trim();
      case 'profile.gender':
        return user.gender === 'woman' ? 'Woman' : 'Man';
      default:
        return '';
    }
  }

  private static profileDetailOptions(labelKey: string): string[] {
    if (labelKey === 'profile.details.values') {
      return APP_STATIC_DATA.beliefsValuesOptionGroups.flatMap(group => group.options);
    }
    if (labelKey === 'profile.details.interest') {
      return APP_STATIC_DATA.interestOptionGroups.flatMap(group => group.options);
    }
    return APP_STATIC_DATA.profileDetailValueOptions[labelKey] ?? [];
  }

  private static isDetailPrivacy(value: unknown): value is DetailPrivacy {
    return value === 'Public' || value === 'Friends' || value === 'Hosts' || value === 'Private';
  }

  private static normalizeHeightValue(value: unknown): string {
    const heightCm = this.parseHeightCm(`${value ?? ''}`);
    return heightCm ? `${heightCm}` : `${value ?? ''}`.trim();
  }

  private static formatDateForDetail(value: string): string {
    const parsed = AppUtils.fromIsoDate(value);
    return parsed
      ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
  }

  private static normalizeExperienceEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return (entries ?? [])
      .map(entry => ({
        id: `${entry?.id ?? ''}`.trim(),
        type: this.normalizeExperienceType(entry?.type),
        title: `${entry?.title ?? ''}`.trim(),
        org: `${entry?.org ?? ''}`.trim(),
        city: `${entry?.city ?? ''}`.trim(),
        dateFrom: `${entry?.dateFrom ?? ''}`.trim(),
        dateTo: `${entry?.dateTo ?? ''}`.trim() || 'Present',
        description: `${entry?.description ?? ''}`.trim()
      }))
      .filter(entry => entry.id && entry.title && entry.org);
  }

  private static normalizeExperienceType(value: unknown): ExperienceEntry['type'] {
    return value === 'School'
      || value === 'Online Session'
      || value === 'Additional Project'
      ? value
      : 'Workspace';
  }

  private static normalizeStepId(value: unknown): FormFlowDraft<ProfileExtDto>['currentStepId'] {
    const candidate = `${value ?? ''}`.trim();
    return candidate || 'basics';
  }

  private static normalizeStepIds(values: readonly FormFlowDraft<ProfileExtDto>['currentStepId'][] | undefined): FormFlowDraft<ProfileExtDto>['currentStepId'][] {
    return [...new Set((values ?? []).map(value => `${value ?? ''}`.trim()).filter(Boolean))];
  }

  private static normalizeProfileStatus(value: unknown): ProfileStatus {
    if (value === 'friends only' || value === 'host only' || value === 'inactive') {
      return value;
    }
    return 'public';
  }

  private static normalizeStringList(values: readonly unknown[] | undefined): string[] {
    return [...new Set(
      (values ?? [])
        .map(value => `${value ?? ''}`.trim())
        .filter(value => value.length > 0)
    )];
  }

  private static normalizeHeightCm(value: unknown): number | null {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return Math.max(40, Math.min(250, parsed));
  }

  private static parseHeightCm(value: string | null | undefined): number | null {
    const parsed = Number.parseInt(`${value ?? ''}`.replace(/[^0-9]/g, ''), 10);
    return this.normalizeHeightCm(parsed);
  }

  private static normalizeToken(value: unknown): string {
    return `${value ?? ''}`.trim().toLowerCase();
  }
}

export class ProfileFormFlowConverter {
  private static readonly horoscopeBadgeMetaBySign: Record<string, HoroscopeBadgeMeta> = {
    Aries: { label: 'Kos', icon: '♈', palette: 'aries' },
    Taurus: { label: 'Bika', icon: '♉', palette: 'taurus' },
    Gemini: { label: 'Ikrek', icon: '♊', palette: 'gemini' },
    Cancer: { label: 'Rák', icon: '♋', palette: 'cancer' },
    Leo: { label: 'Oroszlán', icon: '♌', palette: 'leo' },
    Virgo: { label: 'Szűz', icon: '♍', palette: 'virgo' },
    Libra: { label: 'Mérleg', icon: '♎', palette: 'libra' },
    Scorpio: { label: 'Skorpió', icon: '♏', palette: 'scorpio' },
    Sagittarius: { label: 'Nyilas', icon: '♐', palette: 'sagittarius' },
    Capricorn: { label: 'Bak', icon: '♑', palette: 'capricorn' },
    Aquarius: { label: 'Vízöntő', icon: '♒', palette: 'aquarius' },
    Pisces: { label: 'Halak', icon: '♓', palette: 'pisces' }
  };

  static completionPercent(data: ProfileExtDto): number {
    const profile = data.profile;
    const model = this.convert({
      version: 1,
      userId: profile.id.trim(),
      currentStepId: 'basics',
      updatedAtIso: '',
      completedStepIds: [],
      skippedStepIds: [],
      data
    }, {
      showHeader: false,
      showSave: false
    });
    return formFlowCompletionPercent(model, data);
  }

  static convert(
    draft: FormFlowDraft<ProfileExtDto> | null | undefined,
    options: ProfileFormFlowConverterOptions = {}
  ): FormFlowModel {
    const data = draft?.data ?? null;
    const profile = data?.profile ?? null;
    const experienceEntries = data?.experienceEntries ?? [];
    const imageEditor = options.imageEditor ?? 'flow';
    const profileSize = options.profileSize ?? 'big';
    const steps: FormFlowStepModel[] = [{
      id: 'basics',
      title: 'Alapadatok',
      subtitle: 'Alap profiladatok.',
      icon: 'badge',
      controls: this.profileBasicsControls(profile, experienceEntries, options, profileSize)
    }];
    if (imageEditor !== 'external') {
      steps.push(this.photosStep(options));
    }
    if (profileSize !== 'small') {
      steps.push(this.lifestyleStep(profile, options));
    }
    return {
      title: options.title?.trim() || 'profile.setup',
      subtitle: options.subtitle?.trim() || '',
      layout: options.layout ?? 'carousel',
      header: options.showHeader === false ? false : true,
      loadingLabel: 'Loading profile setup',
      save: options.showSave === false ? null : {
        label: 'Profil mentése',
        ariaLabel: 'Profil mentése',
        icon: 'done',
        disabled: options.saveDisabled === true
      },
      summary: {
        enabled: true,
        title: 'Áttekintés',
        subtitle: 'Ellenőrizd a profilt mentés előtt.',
        icon: 'fact_check',
        emptyLabel: 'Nincs beállítva',
        includeEmpty: true
      },
      completion: {
        controls: 'none',
        items: this.profileCompletionItems(profile)
      },
      steps
    };
  }

  private static photosStep(options: ProfileFormFlowConverterOptions): FormFlowStepModel {
    return {
      id: 'photos',
      title: 'Fotók',
      subtitle: 'Adj hozzá legalább 3 fotót.',
      icon: 'photo_library',
      controls: [{
        id: 'images',
        kind: 'image-carousel',
        label: 'Profilfotók',
        bind: 'profile.images',
        required: true,
        min: 3,
        config: {
          slotCount: 8,
          previewMode: true,
          ariaLabel: 'Profilfotók',
          uploadOwnerId: options.userId?.trim() || '',
          uploadEntityId: options.userId?.trim() || 'profile-onboarding'
        },
        summary: {
          value: (value: unknown) => `${this.imageCount(value)}/8 (kötelező: 3)`
        }
      }]
    };
  }

  private static lifestyleStep(
    profile: UserDto | null,
    options: ProfileFormFlowConverterOptions
  ): FormFlowStepModel {
    return {
      id: 'lifestyle',
      title: 'Életmód',
      subtitle: 'Opcionális részletek.',
      icon: 'interests',
      controls: [
        this.detailMenuControl(profile, 'drinking', 'Alkohol', 'profile.details.drinking', 'groups', 'blue', options.privacy),
        this.detailMenuControl(profile, 'smoking', 'Dohányzás', 'profile.details.smoking', 'smoking_rooms', 'violet', options.privacy),
        this.detailMenuControl(profile, 'workout', 'Edzés', 'profile.details.workout', 'fitness_center', 'green', options.privacy),
        this.detailMenuControl(profile, 'pets', 'Háziállatok', 'profile.details.pets', 'pets', 'green', options.privacy),
        this.detailMenuControl(profile, 'familyPlans', 'Családtervek', 'profile.details.familyPlans', 'family_restroom', 'blue', options.privacy),
        this.detailMenuControl(profile, 'children', 'Gyerekek', 'profile.details.children', 'child_care', 'orange', options.privacy),
        this.detailMenuControl(profile, 'loveStyle', 'Kapcsolati stílus', 'profile.details.loveStyle', 'explore', 'violet', options.privacy),
        this.detailMenuControl(profile, 'communicationStyle', 'Kommunikációs stílus', 'profile.details.communicationStyle', 'forum', 'orange', options.privacy),
        this.detailMenuControl(profile, 'sexualOrientation', 'Szexuális orientáció', 'profile.details.sexualOrientation', 'all_inclusive', 'teal', options.privacy),
        this.detailMenuControl(profile, 'religion', 'Vallás', 'profile.details.religion', 'self_improvement', 'orange', options.privacy),
        {
          id: 'values',
          kind: 'menu',
          label: 'Értékek',
          bind: this.detailValueBind(profile, 'profile.details.values'),
          valueFormat: 'csv',
          config: this.groupedCheckboxMenuConfig(
            'Értékek',
            APP_STATIC_DATA.beliefsValuesOptionGroups,
            'auto_awesome',
            'purple',
            5,
            'select.values'
          ),
          accessory: this.privacyAccessory('profile.details.values', options.privacy)
        },
        {
          id: 'interests',
          kind: 'menu',
          label: 'Érdeklődés',
          bind: this.detailValueBind(profile, 'profile.details.interest'),
          valueFormat: 'csv',
          config: this.groupedCheckboxMenuConfig(
            'Érdeklődés',
            APP_STATIC_DATA.interestOptionGroups,
            'sell',
            'teal',
            5,
            'select.interests'
          ),
          accessory: this.privacyAccessory('profile.details.interest', options.privacy)
        }
      ]
    };
  }

  private static profileBasicsControls(
    profile: UserDto | null,
    experienceEntries: readonly ExperienceEntry[],
    options: ProfileFormFlowConverterOptions,
    profileSize: 'small' | 'big'
  ): readonly FormFlowControlModel[] {
    const baseControls: FormFlowControlModel[] = [
      {
        id: 'about',
        kind: 'textarea',
        label: 'Rólam',
        bind: 'profile.about',
        rows: 3,
        maxLength: 160
      },
      {
        id: 'full-name',
        kind: 'text',
        label: 'Név',
        bind: 'profile.name',
        required: true,
        placeholder: 'Név'
      }
    ];
    if (profileSize === 'small') {
      return [
        ...baseControls,
        {
          id: 'headline',
          kind: 'text',
          label: 'Headline',
          bind: 'profile.headline',
          placeholder: 'Admin workspace'
        }
      ];
    }
    return [
      ...baseControls,
      {
        id: 'birthday',
        kind: 'date',
        layout: 'half',
        label: 'Születésnap',
        bind: 'profile.birthday',
        required: true,
        placeholder: 'dd/mm/yyyy',
        config: {
          meta: {
            label: 'Horoszkóp',
            emptyLabel: 'Nincs beállítva',
            value: value => this.horoscopeBadge(value)
          }
        }
      },
      {
        id: 'city',
        kind: 'text',
        label: 'Város',
        bind: 'profile.city',
        required: true,
        placeholder: 'Város'
      },
      {
        id: 'height',
        kind: 'text',
        label: 'Magasság (cm)',
        bind: 'profile.height',
        required: true,
        placeholder: '180'
      },
      {
        id: 'physique',
        kind: 'menu',
        label: 'Testalkat',
        bind: 'profile.physique',
        required: true,
        config: this.physiqueMenuConfig()
      },
      {
        id: 'gender',
        kind: 'menu',
        label: 'Nem',
        bind: this.detailValueBind(profile, 'profile.gender'),
        required: true,
        config: this.detailSelectMenuConfig('Nem', 'profile.gender', 'person', 'violet'),
        accessory: this.privacyAccessory('profile.gender', options.privacy)
      },
      {
        id: 'languages',
        kind: 'menu',
        label: 'Nyelvek',
        bind: 'profile.languages',
        required: true,
        config: this.checkboxMenuConfig(
          'Nyelvek',
          this.languageOptions(profile?.languages ?? []),
          'language',
          'blue',
          'Nyelvek választása',
          2
        )
      },
      {
        id: 'visibility',
        kind: 'menu',
        label: 'Láthatóság',
        bind: 'profile.profileStatus',
        config: this.profileStatusMenuConfig()
      },
      {
        id: 'workspace',
        kind: 'menu',
        layout: 'half',
        label: 'Munkahely',
        bind: 'experienceEntries',
        config: this.experienceSelectorMenuConfig('Workspace', experienceEntries),
        accessory: this.experiencePrivacyAccessory('workspace', options.privacy),
        summary: {
          value: value => this.experienceSummaryValue(value, 'Workspace')
        }
      },
      {
        id: 'school',
        kind: 'menu',
        layout: 'half',
        label: 'Iskola',
        bind: 'experienceEntries',
        config: this.experienceSelectorMenuConfig('School', experienceEntries),
        accessory: this.experiencePrivacyAccessory('school', options.privacy),
        summary: {
          value: value => this.experienceSummaryValue(value, 'School')
        }
      }
    ];
  }

  private static detailMenuControl(
    profile: UserDto | null,
    field: string,
    label: string,
    key: string,
    icon: string,
    palette: AppMenuPalette,
    privacy?: ProfileFormFlowPrivacyOptions | null
  ) {
    return {
      id: field,
      kind: 'menu' as const,
      label,
      bind: this.detailValueBind(profile, key),
      config: this.detailSelectMenuConfig(label, key, icon, palette),
      accessory: this.privacyAccessory(key, privacy)
    };
  }

  private static profileCompletionItems(profile: UserDto | null): readonly FormFlowCompletionItemConfig[] {
    const detailItem = (id: string, labelKey: string): FormFlowCompletionItemConfig => ({
      id,
      bind: this.detailValueBind(profile, labelKey)
    });
    return [
      { id: 'name', bind: 'profile.name' },
      { id: 'birthday', bind: 'profile.birthday', metric: 'isoDate', weight: 2 },
      { id: 'city', bind: 'profile.city' },
      { id: 'height', bind: 'profile.height', metric: 'positiveNumber' },
      { id: 'physique', bind: 'profile.physique' },
      { id: 'profile-status', bind: 'profile.profileStatus' },
      { id: 'languages', bind: 'profile.languages', metric: 'count', thresholds: [1, 2, 3] },
      { id: 'about', bind: 'profile.about', metric: 'length', thresholds: [20, 80, 140] },
      { ...detailItem('values', 'profile.details.values'), valueFormat: 'csv', metric: 'count', thresholds: [1, 3] },
      { ...detailItem('interests', 'profile.details.interest'), valueFormat: 'csv', metric: 'count', thresholds: [1, 3] },
      detailItem('drinking', 'profile.details.drinking'),
      detailItem('smoking', 'profile.details.smoking'),
      detailItem('workout', 'profile.details.workout'),
      detailItem('pets', 'profile.details.pets'),
      detailItem('family-plans', 'profile.details.familyPlans'),
      detailItem('children', 'profile.details.children'),
      detailItem('love-style', 'profile.details.loveStyle'),
      detailItem('communication-style', 'profile.details.communicationStyle'),
      detailItem('sexual-orientation', 'profile.details.sexualOrientation'),
      detailItem('religion', 'profile.details.religion'),
      detailItem('gender', 'profile.gender'),
      {
        id: 'images',
        bind: 'profile.images',
        metric: 'count',
        thresholds: [1, 2, 3, 4, 5, 6, 7, 8]
      }
    ];
  }

  private static detailValueBind(profile: UserDto | null | undefined, labelKey: string): FormFlowControlModel['bind'] {
    const normalizedLabel = AppUtils.normalizeText(labelKey);
    for (const [groupIndex, group] of (profile?.profileDetails ?? []).entries()) {
      for (const [rowIndex, row] of (group.rows ?? []).entries()) {
        if (AppUtils.normalizeText(row.labelKey) === normalizedLabel) {
          return ['profile', 'profileDetails', groupIndex, 'rows', rowIndex, 'value'];
        }
      }
    }
    return ['profile', 'profileDetails', 0, 'rows', 0, 'value'];
  }

  private static profileDetailValue(profile: UserDto | null | undefined, labelKey: string): string {
    return ProfileFormFlowDataConverter.profileDetailValue(profile, labelKey);
  }

  private static privacyAccessory(
    key: string,
    privacy?: ProfileFormFlowPrivacyOptions | null
  ): { menu?: FormFlowMenuControlConfig | null } | null {
    if (!privacy?.values) {
      return null;
    }
    const current = privacy.values[key] ?? this.defaultPrivacy(key);
    return {
      menu: {
        kind: 'select',
        layout: 'list',
        panelMode: 'anchored',
        title: 'Láthatóság',
        closeOnSelect: true,
        trigger: {
          icon: this.privacyIcon(current),
          closeIcon: 'close',
          hideLabel: true,
          layout: 'icon',
          palette: this.privacyPalette(current),
          ariaLabel: 'Láthatóság módosítása'
        },
        items: APP_STATIC_DATA.detailPrivacyOptions.map(option => ({
          id: `${this.idToken(key)}-privacy-${this.idToken(option)}`,
          label: option,
          icon: this.privacyIcon(option),
          kind: 'radio',
          active: option === current,
          palette: this.privacyPalette(option),
          surface: 'tinted',
          context: { menu: 'privacy', key, value: option } satisfies ProfileFormFlowMenuContext
        }))
      }
    };
  }

  private static experiencePrivacyAccessory(
    type: 'workspace' | 'school',
    privacy?: ProfileFormFlowPrivacyOptions | null
  ): { menu?: FormFlowMenuControlConfig | null } | null {
    if (!privacy?.experience) {
      return null;
    }
    const current = privacy.experience[type] ?? 'Public';
    return {
      menu: {
        kind: 'select',
        layout: 'list',
        panelMode: 'anchored',
        title: 'Láthatóság',
        closeOnSelect: true,
        trigger: {
          icon: this.privacyIcon(current),
          closeIcon: 'close',
          hideLabel: true,
          layout: 'icon',
          palette: this.privacyPalette(current),
          ariaLabel: 'Láthatóság módosítása'
        },
        items: APP_STATIC_DATA.detailPrivacyOptions.map(option => ({
          id: `experience-${type}-privacy-${this.idToken(option)}`,
          label: option,
          icon: this.privacyIcon(option),
          kind: 'radio',
          active: option === current,
          palette: this.privacyPalette(option),
          surface: 'tinted',
          context: { menu: 'experiencePrivacy', type, value: option } satisfies ProfileFormFlowMenuContext
        }))
      }
    };
  }

  private static defaultPrivacy(key: string): DetailPrivacy {
    for (const group of APP_STATIC_DATA.profileDetailGroupTemplates) {
      const row = group.rows.find(candidate => candidate.labelKey === key);
      if (row) {
        return row.privacy;
      }
    }
    return 'Public';
  }

  private static privacyIcon(value: DetailPrivacy): string {
    switch (value) {
      case 'Public':
        return 'public';
      case 'Friends':
        return 'groups';
      case 'Hosts':
        return 'stadium';
      default:
        return 'visibility_off';
    }
  }

  private static privacyPalette(value: DetailPrivacy): AppMenuPalette {
    switch (value) {
      case 'Public':
        return 'green';
      case 'Friends':
        return 'blue';
      case 'Hosts':
        return 'brown';
      default:
        return 'muted';
    }
  }

  private static horoscopeBadge(value: unknown): FormFlowDateMetaValue | string {
    const birthday = `${(value as Partial<ProfileExtDto> | null | undefined)?.profile?.birthday ?? ''}`.trim();
    const parsed = AppUtils.fromIsoDate(birthday);
    if (!parsed) {
      return 'Nincs beállítva';
    }
    const horoscope = AppUtils.horoscopeByDate(parsed);
    return this.horoscopeBadgeMetaBySign[horoscope] ?? this.horoscopeBadgeMetaBySign['Pisces'];
  }

  private static detailSelectMenuConfig(
    title: string,
    key: string,
    icon: string,
    fallbackPalette: AppMenuPalette
  ): FormFlowMenuControlConfig {
    const options = this.detailOptions(key);
    return this.selectMenuConfig(
      title,
      options,
      icon,
      fallbackPalette,
      option => this.detailOptionIcon(key, option),
      option => this.paletteFromTone(this.detailToneFromOptions(option, options)),
      `${title} kiválasztása`
    );
  }

  private static physiqueMenuConfig(): FormFlowMenuControlConfig {
    return this.selectMenuConfig(
      'Testalkat',
      APP_STATIC_DATA.physiqueOptions,
      'fitness_center',
      'green',
      option => this.physiqueIcon(option),
      option => this.paletteFromTone(this.physiqueToneClass(option)),
      'Testalkat kiválasztása'
    );
  }

  private static profileStatusMenuConfig(): FormFlowMenuControlConfig {
    return {
      kind: 'select',
      title: 'Láthatóság',
      trigger: this.trigger('Láthatóság', 'public', this.profileStatusPalette('public'), 'Láthatóság'),
      items: APP_STATIC_DATA.profileStatusOptions.map(option => ({
        id: `profile-status-${option.value}`,
        label: option.value,
        icon: option.icon,
        kind: 'radio',
        value: option.value,
        palette: this.profileStatusPalette(option.value),
        surface: 'tinted',
        context: { menu: 'field', field: 'profileStatus', value: option.value }
      }))
    };
  }

  private static selectMenuConfig(
    title: string,
    options: readonly string[],
    icon: string,
    palette: AppMenuPalette,
    iconForOption: (option: string) => string = () => icon,
    paletteForOption: (option: string) => AppMenuPalette = () => palette,
    emptyLabel = `${title} kiválasztása`
  ): FormFlowMenuControlConfig {
    return {
      kind: 'select',
      title,
      trigger: this.trigger(title, icon, palette, emptyLabel),
      items: options.map(option => this.radioItem(title, option, iconForOption(option), paletteForOption(option)))
    };
  }

  private static checkboxMenuConfig(
    title: string,
    options: readonly string[],
    icon: string,
    palette: AppMenuPalette,
    emptyLabel: string,
    maxLabels: number
  ): FormFlowMenuControlConfig {
    return {
      kind: 'select',
      layout: 'tabs',
      title,
      filterable: true,
      closeOnSelect: false,
      trigger: this.trigger(title, icon, palette),
      model: {
        layout: 'tabs',
        summary: {
          emptyLabel,
          maxLabels,
          counter: 'overflow'
        },
        groups: [{
          id: `${this.idToken(title)}-options`,
          label: title,
          icon,
          palette,
          items: options.map(option => this.checkboxItem(title, option, icon, palette))
        }]
      }
    };
  }

  private static groupedCheckboxMenuConfig(
    title: string,
    groups: readonly { title: string; shortTitle?: string; icon?: string; toneClass?: string; options: readonly string[] }[],
    icon: string,
    palette: AppMenuPalette,
    maxSelected: number,
    emptyLabel: string
  ): FormFlowMenuControlConfig {
    return {
      kind: 'select',
      layout: 'tabs',
      title,
      filterable: true,
      closeOnSelect: false,
      trigger: this.trigger(title, icon, palette),
      model: buildTabbedMenuModel<string, ProfileFormFlowMenuContext>({
        idPrefix: this.idToken(title),
        groups,
        maxSelected,
        summary: {
          emptyLabel,
          maxLabels: 2,
          counter: 'overflow'
        },
        context: option => ({ menu: 'field', field: title, value: option })
      })
    };
  }

  private static experienceSelectorMenuConfig(
    type: 'Workspace' | 'School',
    entries: readonly ExperienceEntry[]
  ): FormFlowMenuControlConfig {
    const filteredEntries = this.experienceEntriesByType(entries, type);
    const palette = type === 'Workspace' ? 'pink' : 'blue';
    const icon = type === 'Workspace' ? 'apartment' : 'school';
    const title = type === 'Workspace' ? 'Munkahely' : 'Iskola';
    const emptyLabel = type === 'Workspace' ? 'Munkahely választása' : 'Iskola választása';
    return {
      kind: 'select',
      layout: 'tabs',
      title,
      trigger: {
        label: filteredEntries.length > 0
          ? filteredEntries.map(entry => this.experienceEntryLabel(entry, type)).slice(0, 2).join(', ')
          : emptyLabel,
        icon,
        palette,
        layout: 'field',
        action: 'custom',
        trailingIcon: 'chevron_right',
        ariaLabel: emptyLabel,
        context: { menu: 'experienceSelector', value: type } satisfies ProfileFormFlowMenuContext
      },
      model: {
        layout: 'tabs',
        valueKey: 'id',
        summary: {
          emptyLabel,
          maxLabels: 2,
          counter: 'overflow'
        },
        groups: [{
          id: `experience-${this.idToken(type)}`,
          label: title,
          icon,
          palette,
          items: filteredEntries.map(entry => ({
            id: `experience-${this.idToken(type)}-${entry.id}`,
            label: this.experienceEntryLabel(entry, type),
            icon,
            kind: 'checkbox',
            value: entry.id,
            active: true,
            checked: true,
            removable: false,
            closeOnSelect: false,
            palette,
            surface: 'tinted',
            context: { menu: 'experienceSelector', value: type } satisfies ProfileFormFlowMenuContext
          }))
        }]
      }
    };
  }

  private static trigger(title: string, icon: string, palette: AppMenuPalette, label?: string | null): AppMenuTrigger {
    return {
      label: label?.trim() || undefined,
      icon,
      palette,
      layout: 'field',
      ariaLabel: `${title} kiválasztása`
    };
  }

  private static radioItem(
    field: string,
    value: string,
    icon: string,
    palette: AppMenuPalette
  ): AppMenuItem<string, ProfileFormFlowMenuContext> {
    return {
      id: `${this.idToken(field)}-${this.idToken(value)}`,
      label: value,
      icon,
      kind: 'radio',
      value,
      palette,
      surface: 'tinted',
      context: { menu: 'field', field, value }
    };
  }

  private static checkboxItem(
    field: string,
    value: string,
    icon: string,
    palette: AppMenuPalette
  ): AppMenuItem<string, ProfileFormFlowMenuContext> {
    return {
      id: `${this.idToken(field)}-${this.idToken(value)}`,
      label: value,
      icon,
      kind: 'checkbox',
      value,
      palette,
      surface: 'tinted',
      closeOnSelect: false,
      context: { menu: 'field', field, value }
    };
  }

  private static experienceEntries(value: unknown): ExperienceEntry[] {
    const entries = (value as Partial<ProfileExtDto> | null | undefined)?.experienceEntries;
    return Array.isArray(entries) ? entries : [];
  }

  private static experienceEntriesByType(
    entries: readonly ExperienceEntry[],
    type: 'Workspace' | 'School'
  ): ExperienceEntry[] {
    return (entries ?? [])
      .filter(entry => entry.type === type)
      .sort((a, b) => AppUtils.toSortableDate(b.dateFrom) - AppUtils.toSortableDate(a.dateFrom));
  }

  private static experienceSummaryValue(value: unknown, type: 'Workspace' | 'School'): string {
    return this.experienceEntriesByType(this.experienceEntries(value), type)
      .map(entry => this.experienceEntryLabel(entry, type))
      .filter(Boolean)
      .join(', ');
  }

  private static experienceEntryLabel(entry: ExperienceEntry, fallback: 'Workspace' | 'School'): string {
    return entry.title.trim()
      || entry.org.trim()
      || entry.city.trim()
      || fallback;
  }

  private static imageCount(value: unknown): number {
    const images = (value as Partial<ProfileExtDto> | null | undefined)?.profile?.images;
    return Array.isArray(images)
      ? images.filter(image => `${image ?? ''}`.trim().length > 0).length
      : 0;
  }

  private static languageOptions(selected: readonly string[]): string[] {
    return [...new Set([...APP_STATIC_DATA.languageSuggestions, ...selected].map(option => option.trim()).filter(Boolean))];
  }

  private static detailOptions(key: string): readonly string[] {
    return APP_STATIC_DATA.profileDetailValueOptions[key] ?? [];
  }

  private static normalizeProfileStatus(value: unknown): ProfileStatus {
    if (value === 'friends only' || value === 'host only' || value === 'inactive' || value === 'blocked' || value === 'deleted') {
      return value;
    }
    return 'public';
  }

  private static profileStatusPalette(status: ProfileStatus): AppMenuPalette {
    switch (status) {
      case 'public':
        return 'green';
      case 'friends only':
        return 'blue';
      case 'host only':
        return 'brown';
      case 'inactive':
        return 'muted';
      case 'blocked':
      case 'deleted':
        return 'red';
      default:
        return 'neutral';
    }
  }

  private static physiqueIcon(value: string): string {
    const normalized = AppUtils.normalizeText(value);
    if (normalized.includes('slim')) {
      return 'directions_run';
    }
    if (normalized.includes('lean')) {
      return 'self_improvement';
    }
    if (normalized.includes('athletic')) {
      return 'fitness_center';
    }
    if (normalized.includes('fit')) {
      return 'sports_gymnastics';
    }
    if (normalized.includes('curvy')) {
      return 'accessibility';
    }
    if (normalized.includes('muscular')) {
      return 'sports_mma';
    }
    return 'accessibility_new';
  }

  private static physiqueToneClass(value: string): string {
    const normalized = AppUtils.normalizeText(value);
    if (normalized.includes('slim')) {
      return 'physique-slim';
    }
    if (normalized.includes('lean')) {
      return 'physique-lean';
    }
    if (normalized.includes('fit')) {
      return 'physique-fit';
    }
    if (normalized.includes('athletic')) {
      return 'physique-athletic';
    }
    if (normalized.includes('curvy')) {
      return 'physique-curvy';
    }
    if (normalized.includes('muscular')) {
      return 'physique-muscular';
    }
    return 'physique-average';
  }

  private static detailToneFromOptions(value: string, options: readonly string[]): string {
    const index = options.findIndex(item => AppUtils.normalizeText(item) === AppUtils.normalizeText(value));
    return `detail-tone-${((index >= 0 ? index : 0) % 8) + 1}`;
  }

  private static detailOptionIcon(labelKey: string, option: string): string {
    const normalizedLabel = AppUtils.normalizeText(labelKey);
    const normalizedOption = AppUtils.normalizeText(option);

    if (normalizedLabel.includes('drinking')) {
      if (normalizedOption.includes('never')) {
        return 'no_drinks';
      }
      if (normalizedOption.includes('socially')) {
        return 'groups';
      }
      if (normalizedOption.includes('occasionally')) {
        return 'event';
      }
      return 'nightlife';
    }
    if (normalizedLabel.includes('smoking')) {
      if (normalizedOption.includes('never')) {
        return 'smoke_free';
      }
      if (normalizedOption.includes('trying')) {
        return 'healing';
      }
      if (normalizedOption.includes('socially')) {
        return 'group';
      }
      return 'smoking_rooms';
    }
    if (normalizedLabel.includes('workout')) {
      if (normalizedOption.includes('daily')) {
        return 'whatshot';
      }
      if (normalizedOption.includes('4x')) {
        return 'fitness_center';
      }
      if (normalizedOption.includes('2-3x')) {
        return 'directions_run';
      }
      return 'self_improvement';
    }
    if (normalizedLabel.includes('pets')) {
      if (normalizedOption.includes('dog')) {
        return 'pets';
      }
      if (normalizedOption.includes('cat')) {
        return 'pets';
      }
      if (normalizedOption.includes('all')) {
        return 'cruelty_free';
      }
      return 'block';
    }
    if (normalizedLabel.includes('family')) {
      if (normalizedOption.includes('want')) {
        return 'child_care';
      }
      if (normalizedOption.includes('open')) {
        return 'family_restroom';
      }
      if (normalizedOption.includes('not sure')) {
        return 'help_outline';
      }
      return 'do_not_disturb_alt';
    }
    if (normalizedLabel.includes('children')) {
      if (normalizedOption === 'yes') {
        return 'child_friendly';
      }
      if (normalizedOption === 'no') {
        return 'do_not_disturb_alt';
      }
      return 'privacy_tip';
    }
    if (normalizedLabel.includes('love')) {
      if (normalizedOption.includes('long-term')) {
        return 'favorite';
      }
      if (normalizedOption.includes('slow-burn')) {
        return 'hourglass_bottom';
      }
      if (normalizedOption.includes('open')) {
        return 'hub';
      }
      return 'explore';
    }
    if (normalizedLabel.includes('communication')) {
      if (normalizedOption.includes('direct')) {
        return 'campaign';
      }
      if (normalizedOption.includes('calm')) {
        return 'record_voice_over';
      }
      if (normalizedOption.includes('playful')) {
        return 'mood';
      }
      return 'forum';
    }
    if (normalizedLabel.includes('orientation')) {
      if (normalizedOption.includes('straight')) {
        return 'person';
      }
      if (normalizedOption.includes('bisexual')) {
        return 'diversity_3';
      }
      if (normalizedOption.includes('gay') || normalizedOption.includes('lesbian')) {
        return 'favorite';
      }
      if (normalizedOption.includes('pansexual')) {
        return 'all_inclusive';
      }
      if (normalizedOption.includes('asexual')) {
        return 'do_not_disturb_on';
      }
      return 'privacy_tip';
    }
    if (normalizedLabel.includes('gender')) {
      if (normalizedOption.includes('woman')) {
        return 'female';
      }
      if (normalizedOption.includes('man')) {
        return 'male';
      }
      if (normalizedOption.includes('non-binary')) {
        return 'transgender';
      }
      return 'privacy_tip';
    }
    if (normalizedLabel.includes('religion')) {
      if (normalizedOption.includes('spiritual')) {
        return 'self_improvement';
      }
      if (normalizedOption.includes('christian')) {
        return 'church';
      }
      if (normalizedOption.includes('muslim')) {
        return 'mosque';
      }
      if (normalizedOption.includes('jewish')) {
        return 'synagogue';
      }
      if (normalizedOption.includes('buddhist') || normalizedOption.includes('hindu')) {
        return 'temple_buddhist';
      }
      if (normalizedOption.includes('atheist')) {
        return 'public_off';
      }
      return 'privacy_tip';
    }
    return 'radio_button_checked';
  }

  private static paletteFromTone(toneClass: string): AppMenuPalette {
    switch (toneClass) {
      case 'physique-lean':
      case 'physique-fit':
      case 'detail-tone-2':
      case 'detail-tone-5':
      case 'section-active':
        return 'green';
      case 'physique-athletic':
      case 'detail-tone-1':
      case 'section-languages':
      case 'section-social':
        return 'blue';
      case 'detail-tone-8':
        return 'brown';
      case 'physique-slim':
      case 'detail-tone-7':
        return 'sky';
      case 'physique-curvy':
      case 'detail-tone-6':
        return 'pink';
      case 'physique-muscular':
        return 'red';
      case 'detail-tone-3':
      case 'section-family':
      case 'section-food':
        return 'orange';
      case 'section-ambition':
        return 'amber';
      case 'section-lifestyle':
      case 'section-mind':
        return 'teal';
      case 'section-beliefs':
        return 'purple';
      case 'detail-tone-4':
      case 'section-arts':
        return 'violet';
      case 'section-identity':
        return 'cyan';
      case 'physique-average':
      default:
        return 'muted';
    }
  }

  private static idToken(value: string): string {
    return AppUtils.normalizeText(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item';
  }
}

export const profileFormFlowConverter =
  ProfileFormFlowConverter satisfies UiConverter<
    FormFlowDraft<ProfileExtDto> | null | undefined,
    FormFlowModel,
    ProfileFormFlowConverterOptions
  >;
