import { APP_STATIC_DATA } from '../../app-static-data';
import { AppUtils } from '../../app-utils';
import type {
  ProfileOnboardingDraft,
  ProfileOnboardingForm
} from '../../core';
import type { UserDto } from '../../core/contracts/user.interface';
import type { ProfileStatus } from '../../core/common/constants';
import type { ExperienceEntry } from '../../core/contracts/profile.interface';
import type {
  AppMenuItem,
  AppMenuPalette,
  AppMenuTrigger
} from '../components/menu';
import { buildTabbedMenuModel } from '../components/menu';
import type { FormFlowMenuControlConfig, FormFlowModel } from '../components/form-flow';
import type { UiConverter } from './converter.types';

export interface ProfileOnboardingFormFlowConverterOptions {
  title?: string | null;
  subtitle?: string | null;
  userId?: string | null;
  saveDisabled?: boolean;
}

export type ProfileOnboardingFormFlowMenuContext =
  | { menu: 'field'; field: string; value: string }
  | { menu: 'experienceSelector'; value: Extract<ExperienceEntry['type'], 'Workspace' | 'School'> };

export class ProfileOnboardingDraftConverter {
  static readonly currentProfileFormVersion = 2;

  static convert(user: UserDto): ProfileOnboardingDraft;
  static convert(draft: ProfileOnboardingDraft): ProfileOnboardingDraft;
  static convert(value: UserDto | ProfileOnboardingDraft): ProfileOnboardingDraft {
    return this.isDraft(value)
      ? this.normalizeDraft(value)
      : this.createDraft(value);
  }

  static requiredMissingKeys(user: UserDto): string[] {
    const missing: string[] = [];
    if (!this.hasText(user.name)) {
      missing.push('name');
    }
    if (!this.isIsoDate(user.birthday)) {
      missing.push('birthday');
    }
    if (!this.hasText(user.city)) {
      missing.push('city');
    }
    if ((this.parseHeightCm(user.height) ?? 0) <= 0) {
      missing.push('height');
    }
    if (!this.hasText(user.physique)) {
      missing.push('physique');
    }
    if ((user.languages ?? []).filter(language => this.hasText(language)).length === 0) {
      missing.push('languages');
    }
    if ((user.images ?? []).filter(image => this.hasText(image)).length < 3) {
      missing.push('images');
    }
    return missing;
  }

  static isProfileEffectivelyEmpty(user: UserDto): boolean {
    const signals = [
      this.hasText(user.name),
      this.isIsoDate(user.birthday),
      this.hasText(user.city),
      (this.parseHeightCm(user.height) ?? 0) > 0,
      this.hasText(user.physique),
      (user.languages ?? []).some(language => this.hasText(language)),
      this.hasText(user.about),
      (user.images ?? []).some(image => this.hasText(image))
    ];
    return signals.filter(Boolean).length <= 2;
  }

  private static isDraft(value: UserDto | ProfileOnboardingDraft): value is ProfileOnboardingDraft {
    return 'form' in value && 'currentStepId' in value;
  }

  private static createDraft(user: UserDto): ProfileOnboardingDraft {
    return this.normalizeDraft({
      version: 1,
      userId: user.id.trim(),
      currentStepId: 'basics',
      updatedAtIso: new Date().toISOString(),
      completedStepIds: [],
      skippedStepIds: [],
      form: this.initialForm(user)
    });
  }

  private static initialForm(user: UserDto): ProfileOnboardingForm {
    const emptyProfile = this.isProfileEffectivelyEmpty(user);
    return {
      fullName: `${user.name ?? ''}`.trim(),
      birthday: this.isIsoDate(user.birthday) ? user.birthday.trim() : '',
      city: `${user.city ?? ''}`.trim(),
      heightCm: this.parseHeightCm(user.height),
      physique: `${user.physique ?? ''}`.trim(),
      languages: this.normalizeStringList(user.languages),
      images: this.normalizeStringList(user.images).slice(0, 8),
      about: `${user.about ?? ''}`.trim().slice(0, 160),
      profileStatus: this.normalizeProfileStatus(user.profileStatus),
      genderDetail: emptyProfile
        ? ''
        : this.profileDetailValue(user, 'profile.gender'),
      drinking: this.profileDetailValue(user, 'profile.details.drinking'),
      smoking: this.profileDetailValue(user, 'profile.details.smoking'),
      workout: this.profileDetailValue(user, 'profile.details.workout'),
      pets: this.profileDetailValue(user, 'profile.details.pets'),
      familyPlans: this.profileDetailValue(user, 'profile.details.familyPlans'),
      children: this.profileDetailValue(user, 'profile.details.children'),
      loveStyle: this.profileDetailValue(user, 'profile.details.loveStyle'),
      communicationStyle: this.profileDetailValue(user, 'profile.details.communicationStyle'),
      sexualOrientation: this.profileDetailValue(user, 'profile.details.sexualOrientation'),
      religion: this.profileDetailValue(user, 'profile.details.religion'),
      values: this.parseCommaValues(this.profileDetailValue(user, 'profile.details.values')),
      interests: this.parseCommaValues(this.profileDetailValue(user, 'profile.details.interest')),
      experienceEntries: []
    };
  }

  private static normalizeDraft(draft: ProfileOnboardingDraft): ProfileOnboardingDraft {
    return {
      version: 1,
      userId: `${draft.userId ?? ''}`.trim(),
      currentStepId: this.normalizeStepId(draft.currentStepId),
      updatedAtIso: new Date().toISOString(),
      completedStepIds: this.normalizeStepIds(draft.completedStepIds),
      skippedStepIds: this.normalizeStepIds(draft.skippedStepIds),
      form: {
        fullName: `${draft.form?.fullName ?? ''}`.trim(),
        birthday: this.isIsoDate(draft.form?.birthday ?? '') ? `${draft.form?.birthday}`.trim() : '',
        city: `${draft.form?.city ?? ''}`.trim(),
        heightCm: this.normalizeHeightCm(draft.form?.heightCm),
        physique: `${draft.form?.physique ?? ''}`.trim(),
        languages: this.normalizeStringList(draft.form?.languages),
        images: this.normalizeStringList(draft.form?.images).slice(0, 8),
        about: `${draft.form?.about ?? ''}`.trim().slice(0, 160),
        profileStatus: this.normalizeProfileStatus(draft.form?.profileStatus),
        genderDetail: `${draft.form?.genderDetail ?? ''}`.trim(),
        drinking: `${draft.form?.drinking ?? ''}`.trim(),
        smoking: `${draft.form?.smoking ?? ''}`.trim(),
        workout: `${draft.form?.workout ?? ''}`.trim(),
        pets: `${draft.form?.pets ?? ''}`.trim(),
        familyPlans: `${draft.form?.familyPlans ?? ''}`.trim(),
        children: `${draft.form?.children ?? ''}`.trim(),
        loveStyle: `${draft.form?.loveStyle ?? ''}`.trim(),
        communicationStyle: `${draft.form?.communicationStyle ?? ''}`.trim(),
        sexualOrientation: `${draft.form?.sexualOrientation ?? ''}`.trim(),
        religion: `${draft.form?.religion ?? ''}`.trim(),
        values: this.normalizeStringList(draft.form?.values).slice(0, 5),
        interests: this.normalizeStringList(draft.form?.interests).slice(0, 5),
        experienceEntries: this.normalizeExperienceEntries(draft.form?.experienceEntries ?? [])
      }
    };
  }

  private static profileDetailValue(user: UserDto, labelKey: string): string {
    const normalizedLabel = this.normalizeToken(labelKey);
    for (const group of user.profileDetails ?? []) {
      for (const row of group.rows ?? []) {
        if (this.normalizeToken(row.labelKey) === normalizedLabel) {
          return `${row.value ?? ''}`.trim();
        }
      }
    }
    return '';
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

  private static normalizeStepId(value: unknown): ProfileOnboardingDraft['currentStepId'] {
    const candidate = `${value ?? ''}`.trim();
    return candidate === 'photos' || candidate === 'lifestyle' || candidate === 'review'
      ? candidate
      : 'basics';
  }

  private static normalizeStepIds(values: readonly ProfileOnboardingDraft['currentStepId'][] | undefined): ProfileOnboardingDraft['currentStepId'][] {
    const allowed = new Set<ProfileOnboardingDraft['currentStepId']>(['basics', 'photos', 'lifestyle', 'review']);
    return [...new Set((values ?? []).filter(stepId => allowed.has(stepId)))];
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

  private static parseCommaValues(value: string): string[] {
    return this.normalizeStringList(value.split(','));
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

  private static isIsoDate(value: string | null | undefined): boolean {
    const normalized = `${value ?? ''}`.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return false;
    }
    const parsed = Date.parse(`${normalized}T00:00:00Z`);
    return Number.isFinite(parsed);
  }

  private static hasText(value: unknown): boolean {
    return `${value ?? ''}`.trim().length > 0;
  }

  private static normalizeToken(value: unknown): string {
    return `${value ?? ''}`.trim().toLowerCase();
  }
}

export class ProfileOnboardingFormFlowConverter {
  static convert(
    draft: ProfileOnboardingDraft | null | undefined,
    options: ProfileOnboardingFormFlowConverterOptions = {}
  ): FormFlowModel {
    const form = draft?.form ?? null;
    return {
      title: options.title?.trim() || 'Profile setup',
      subtitle: options.subtitle?.trim() || '',
      layout: 'carousel',
      loadingLabel: 'Loading profile setup',
      save: {
        label: 'Profil mentése',
        ariaLabel: 'Profil mentése',
        icon: 'done',
        disabled: options.saveDisabled === true
      },
      summary: {
        enabled: false
      },
      steps: [
        {
          id: 'basics',
          title: 'Alapadatok',
          subtitle: 'Alap profiladatok.',
          icon: 'badge',
          controls: [
            {
              id: 'about',
              kind: 'textarea',
              label: 'Rólam',
              bind: 'about',
              rows: 3,
              maxLength: 160
            },
            {
              id: 'full-name',
              kind: 'text',
              label: 'Név',
              bind: 'fullName',
              required: true,
              placeholder: 'Név'
            },
            {
              id: 'birthday',
              kind: 'date',
              label: 'Születésnap',
              bind: 'birthday',
              required: true,
              placeholder: 'dd/mm/yyyy'
            },
            {
              id: 'city',
              kind: 'text',
              label: 'Város',
              bind: 'city',
              required: true,
              placeholder: 'Város'
            },
            {
              id: 'height',
              kind: 'number',
              label: 'Magasság (cm)',
              bind: 'heightCm',
              required: true,
              min: 40,
              max: 250,
              step: 1
            },
            {
              id: 'physique',
              kind: 'menu',
              label: 'Testalkat',
              bind: 'physique',
              required: true,
              config: this.physiqueMenuConfig(form?.physique)
            },
            {
              id: 'gender',
              kind: 'menu',
              label: 'Nem',
              bind: 'genderDetail',
              config: this.selectMenuConfig(
                'Nem',
                this.detailOptions('profile.gender'),
                'person',
                'violet',
                undefined,
                undefined,
                'Nem kiválasztása',
                form?.genderDetail
              )
            },
            {
              id: 'languages',
              kind: 'menu',
              label: 'Nyelvek',
              bind: 'languages',
              required: true,
              config: this.checkboxMenuConfig(
                'Nyelvek',
                this.languageOptions(form?.languages ?? []),
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
              bind: 'profileStatus',
              config: this.profileStatusMenuConfig(form?.profileStatus)
            },
            {
              id: 'workspace',
              kind: 'menu',
              layout: 'half',
              label: 'Munkahely',
              bind: 'experienceEntries',
              config: this.experienceSelectorMenuConfig('Workspace', form?.experienceEntries ?? [])
            },
            {
              id: 'school',
              kind: 'menu',
              layout: 'half',
              label: 'Iskola',
              bind: 'experienceEntries',
              config: this.experienceSelectorMenuConfig('School', form?.experienceEntries ?? [])
            }
          ]
        },
        {
          id: 'photos',
          title: 'Fotók',
          subtitle: 'Adj hozzá legalább 3 fotót.',
          icon: 'photo_library',
          controls: [
            {
              id: 'images',
              kind: 'image-carousel',
              label: 'Profilfotók',
              bind: 'images',
              required: true,
              min: 3,
              config: {
                slotCount: 8,
                previewMode: true,
                ariaLabel: 'Profilfotók',
                uploadOwnerId: options.userId?.trim() || '',
                uploadEntityId: options.userId?.trim() || 'profile-onboarding'
              }
            }
          ]
        },
        {
          id: 'lifestyle',
          title: 'Lifestyle',
          subtitle: 'Optional details.',
          icon: 'interests',
          controls: [
            this.detailMenuControl('drinking', 'Alkohol', 'profile.details.drinking', 'groups', 'blue', form?.drinking),
            this.detailMenuControl('smoking', 'Dohányzás', 'profile.details.smoking', 'smoking_rooms', 'violet', form?.smoking),
            this.detailMenuControl('workout', 'Edzés', 'profile.details.workout', 'fitness_center', 'green', form?.workout),
            this.detailMenuControl('pets', 'Háziállatok', 'profile.details.pets', 'pets', 'green', form?.pets),
            this.detailMenuControl('familyPlans', 'Családtervek', 'profile.details.familyPlans', 'family_restroom', 'blue', form?.familyPlans),
            this.detailMenuControl('children', 'Gyerekek', 'profile.details.children', 'child_care', 'orange', form?.children),
            this.detailMenuControl('loveStyle', 'Kapcsolati stílus', 'profile.details.loveStyle', 'explore', 'violet', form?.loveStyle),
            this.detailMenuControl('communicationStyle', 'Kommunikációs stílus', 'profile.details.communicationStyle', 'forum', 'orange', form?.communicationStyle),
            this.detailMenuControl('sexualOrientation', 'Szexuális orientáció', 'profile.details.sexualOrientation', 'all_inclusive', 'teal', form?.sexualOrientation),
            this.detailMenuControl('religion', 'Vallás', 'profile.details.religion', 'self_improvement', 'orange', form?.religion),
            {
              id: 'values',
              kind: 'menu',
              label: 'Értékek',
              bind: 'values',
              config: this.groupedCheckboxMenuConfig(
                'Értékek',
                APP_STATIC_DATA.beliefsValuesOptionGroups,
                'auto_awesome',
                'purple',
                5,
                'select.values',
                form?.values ?? []
              )
            },
            {
              id: 'interests',
              kind: 'menu',
              label: 'Érdeklődés',
              bind: 'interests',
              config: this.groupedCheckboxMenuConfig(
                'Érdeklődés',
                APP_STATIC_DATA.interestOptionGroups,
                'sell',
                'teal',
                5,
                'select.interests',
                form?.interests ?? []
              )
            }
          ]
        },
        {
          id: 'review',
          title: 'Review',
          subtitle: 'Check your profile before saving.',
          icon: 'fact_check',
          controls: [
            this.reviewControl('review-photos', 'Photos', value => `${this.imageCount(value)}/8`),
            this.reviewControl('review-basics', 'Basics', value => {
              const formValue = value as Partial<ProfileOnboardingForm> | null | undefined;
              return [
                formValue?.fullName,
                formValue?.birthday,
                formValue?.city,
                formValue?.heightCm ? `${formValue.heightCm} cm` : '',
                formValue?.physique
              ].map(item => `${item ?? ''}`.trim()).filter(Boolean).join(' - ') || 'Not set';
            }),
            this.reviewControl('review-about', 'About me', value => {
              const formValue = value as Partial<ProfileOnboardingForm> | null | undefined;
              return `${formValue?.about ?? ''}`.trim() || 'Not set';
            }),
            this.reviewControl('review-experience', 'Experience', value => {
              const entries = this.experienceEntries(value);
              if (entries.length === 0) {
                return 'Not set';
              }
              return entries.map(entry => this.experienceEntryLabel(entry, entry.type === 'School' ? 'School' : 'Workspace')).join(', ');
            }),
            this.reviewControl('review-lifestyle', 'Lifestyle', value => {
              const formValue = value as Partial<ProfileOnboardingForm> | null | undefined;
              return [
                ...(formValue?.interests ?? []),
                ...(formValue?.values ?? [])
              ].map(item => `${item ?? ''}`.trim()).filter(Boolean).slice(0, 6).join(', ') || 'Not set';
            })
          ]
        }
      ]
    };
  }

  private static reviewControl(
    id: string,
    label: string,
    value: (formValue: unknown) => unknown
  ) {
    return {
      id,
      kind: 'review' as const,
      label,
      summary: { value }
    };
  }

  private static detailMenuControl(
    field: string,
    label: string,
    key: string,
    icon: string,
    palette: AppMenuPalette,
    selectedValue?: string | null
  ) {
    return {
      id: field,
      kind: 'menu' as const,
      label,
      bind: field,
      config: this.detailSelectMenuConfig(label, key, icon, palette, selectedValue)
    };
  }

  private static detailSelectMenuConfig(
    title: string,
    key: string,
    icon: string,
    fallbackPalette: AppMenuPalette,
    selectedValue?: string | null
  ): FormFlowMenuControlConfig {
    const options = this.detailOptions(key);
    return this.selectMenuConfig(
      title,
      options,
      icon,
      fallbackPalette,
      option => this.detailOptionIcon(key, option),
      option => this.paletteFromTone(this.detailToneFromOptions(option, options)),
      `${title} kiválasztása`,
      selectedValue
    );
  }

  private static physiqueMenuConfig(selectedValue?: string | null): FormFlowMenuControlConfig {
    return this.selectMenuConfig(
      'Testalkat',
      APP_STATIC_DATA.physiqueOptions,
      'fitness_center',
      'green',
      option => this.physiqueIcon(option),
      option => this.paletteFromTone(this.physiqueToneClass(option)),
      'Testalkat kiválasztása',
      selectedValue
    );
  }

  private static profileStatusMenuConfig(selectedStatus?: ProfileStatus | null): FormFlowMenuControlConfig {
    const status = this.normalizeProfileStatus(selectedStatus);
    const selectedOption = APP_STATIC_DATA.profileStatusOptions.find(option => option.value === status) ?? APP_STATIC_DATA.profileStatusOptions[0];
    return {
      kind: 'select',
      title: 'Láthatóság',
      trigger: this.trigger(
        'Láthatóság',
        selectedOption?.icon ?? 'public',
        this.profileStatusPalette(status),
        status
      ),
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
    emptyLabel = `${title} kiválasztása`,
    selectedValue?: string | null
  ): FormFlowMenuControlConfig {
    const selected = this.selectedOption(options, selectedValue);
    const triggerIcon = selected ? iconForOption(selected) : icon;
    const triggerPalette = selected ? paletteForOption(selected) : palette;
    return {
      kind: 'select',
      title,
      trigger: this.trigger(title, triggerIcon, triggerPalette, selected || emptyLabel),
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
    emptyLabel: string,
    selectedValues: readonly string[] = []
  ): FormFlowMenuControlConfig {
    const triggerPalette = this.groupPaletteForSelection(groups, selectedValues) ?? palette;
    return {
      kind: 'select',
      layout: 'tabs',
      title,
      filterable: true,
      closeOnSelect: false,
      trigger: this.trigger(title, icon, triggerPalette),
      model: buildTabbedMenuModel<string, ProfileOnboardingFormFlowMenuContext>({
        idPrefix: this.idToken(title),
        groups,
        selected: selectedValues,
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
        context: { menu: 'experienceSelector', value: type } satisfies ProfileOnboardingFormFlowMenuContext
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
            context: { menu: 'experienceSelector', value: type } satisfies ProfileOnboardingFormFlowMenuContext
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
  ): AppMenuItem<string, ProfileOnboardingFormFlowMenuContext> {
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
  ): AppMenuItem<string, ProfileOnboardingFormFlowMenuContext> {
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
    const entries = (value as Partial<ProfileOnboardingForm> | null | undefined)?.experienceEntries;
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

  private static experienceEntryLabel(entry: ExperienceEntry, fallback: 'Workspace' | 'School'): string {
    return entry.title.trim()
      || entry.org.trim()
      || entry.city.trim()
      || fallback;
  }

  private static imageCount(value: unknown): number {
    const images = (value as Partial<ProfileOnboardingForm> | null | undefined)?.images;
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

  private static selectedOption(options: readonly string[], selectedValue: unknown): string {
    const normalizedSelectedValue = AppUtils.normalizeText(`${selectedValue ?? ''}`);
    return options.find(option => AppUtils.normalizeText(option) === normalizedSelectedValue) ?? '';
  }

  private static normalizeProfileStatus(value: unknown): ProfileStatus {
    if (value === 'friends only' || value === 'host only' || value === 'inactive' || value === 'blocked' || value === 'deleted') {
      return value;
    }
    return 'public';
  }

  private static groupPaletteForSelection(
    groups: readonly { toneClass?: string; options: readonly string[] }[],
    selectedValues: readonly string[]
  ): AppMenuPalette | null {
    const selected = new Set(selectedValues.map(value => AppUtils.normalizeText(value)).filter(Boolean));
    if (selected.size === 0) {
      return null;
    }
    const group = groups.find(candidate =>
      candidate.options.some(option => selected.has(AppUtils.normalizeText(option)))
    );
    return group ? this.paletteFromTone(group.toneClass ?? '') : null;
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

export const profileOnboardingFormFlowConverter =
  ProfileOnboardingFormFlowConverter satisfies UiConverter<
    ProfileOnboardingDraft | null | undefined,
    FormFlowModel,
    ProfileOnboardingFormFlowConverterOptions
  >;
