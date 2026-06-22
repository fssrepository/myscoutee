import type { HelpCenterRevisionDto, HelpCenterSectionDto } from '../../core/contracts';
import type {
  DocumentViewerAction,
  DocumentViewerConfig,
  DocumentViewerEmptyState,
  DocumentViewerHeaderPalette,
  DocumentViewerSection,
  DocumentViewerShell,
  DocumentViewerStatusTone
} from '../components/document-viewer';
import type { UiConverter, UiListConverter } from './converter.types';

export type HelpCenterRevisionDocumentViewerSectionMode = 'default' | 'privacy';

export interface HelpCenterRevisionDocumentViewerConfigOptions {
  revision: HelpCenterRevisionDto | null;
  open?: boolean;
  shell?: DocumentViewerShell;
  onClose?: (() => void) | null;
  closeOnBackdrop?: boolean;
  closeAriaLabel?: string | null;
  ariaLabel?: string | null;
  titleFallback: string;
  descriptionFallback?: string | null;
  versionLabel?: string | null;
  headerPalette?: string | null;
  headerPaletteFallback?: DocumentViewerHeaderPalette;
  showBrand?: boolean;
  loading?: boolean;
  loadingLabel?: string | null;
  emptyState?: DocumentViewerEmptyState | null;
  sectionMode?: HelpCenterRevisionDocumentViewerSectionMode;
  selectedSectionIds?: readonly string[] | ReadonlySet<string> | null;
  actions?: readonly DocumentViewerAction[];
  statusMessage?: string | null;
  statusTone?: DocumentViewerStatusTone;
}

export interface HelpCenterDocumentViewerHeaderPaletteConverterOptions {
  fallback?: DocumentViewerHeaderPalette;
}

export class HelpCenterDocumentViewerHeaderPaletteConverter {
  static convert(
    value: string | null | undefined,
    options: HelpCenterDocumentViewerHeaderPaletteConverterOptions = {}
  ): DocumentViewerHeaderPalette {
    const normalized = `${value ?? ''}`.trim();
    switch (normalized) {
      case 'amber':
      case 'blue':
      case 'green':
      case 'rose':
      case 'violet':
      case 'slate':
      case 'teal':
        return normalized;
      default:
        return options.fallback ?? 'amber';
    }
  }
}

export const helpCenterDocumentViewerHeaderPaletteConverter =
  HelpCenterDocumentViewerHeaderPaletteConverter satisfies UiConverter<
    string | null | undefined,
    DocumentViewerHeaderPalette,
    HelpCenterDocumentViewerHeaderPaletteConverterOptions | undefined
  >;

export class HelpCenterHelpDocumentViewerHeaderPaletteConverter {
  static convert(value: string | null | undefined): DocumentViewerHeaderPalette {
    const normalized = HelpCenterDocumentViewerHeaderPaletteConverter.convert(value, { fallback: 'teal' });
    return normalized === 'amber' ? 'teal' : normalized;
  }
}

export const helpCenterHelpDocumentViewerHeaderPaletteConverter =
  HelpCenterHelpDocumentViewerHeaderPaletteConverter satisfies UiConverter<
    string | null | undefined,
    DocumentViewerHeaderPalette
  >;

export class HelpCenterDocumentViewerSectionConverter {
  static convert(section: HelpCenterSectionDto): DocumentViewerSection {
    return {
      id: section.id,
      icon: section.icon,
      title: section.title,
      blurb: section.blurb,
      contentHtml: section.contentHtml,
      points: section.points,
      details: section.details
    };
  }

  static convertList(sections: readonly HelpCenterSectionDto[]): DocumentViewerSection[] {
    return sections.map(section => this.convert(section));
  }
}

export const helpCenterDocumentViewerSectionConverter =
  HelpCenterDocumentViewerSectionConverter satisfies UiListConverter<
    HelpCenterSectionDto,
    DocumentViewerSection
  >;

export interface HelpCenterPrivacyDocumentViewerSectionConverterInput {
  sections: readonly HelpCenterSectionDto[];
  selectedSectionIds?: readonly string[] | ReadonlySet<string> | null;
}

export class HelpCenterPrivacyDocumentViewerSectionConverter {
  static convert(input: HelpCenterPrivacyDocumentViewerSectionConverterInput): DocumentViewerSection[] {
    const selectedIds = HelpCenterSelectedDocumentViewerSectionIdsConverter.convert(input.selectedSectionIds);
    return HelpCenterDocumentViewerSectionConverter.convertList(input.sections).map((section, index) => {
      const source = input.sections[index];
      const optional = source?.optional === true;
      return {
        ...section,
        tone: optional ? 'optional' as const : 'mandatory' as const,
        selected: selectedIds.includes(section.id),
        toggleable: optional
      };
    });
  }
}

export const helpCenterPrivacyDocumentViewerSectionConverter =
  HelpCenterPrivacyDocumentViewerSectionConverter satisfies UiConverter<
    HelpCenterPrivacyDocumentViewerSectionConverterInput,
    DocumentViewerSection[]
  >;

export class HelpCenterSelectedDocumentViewerSectionIdsConverter {
  static convert(value: readonly string[] | ReadonlySet<string> | null | undefined): string[] {
    return Array.from(new Set(
      Array.from(value ?? [])
        .map((sectionId: string) => `${sectionId ?? ''}`.trim())
        .filter(Boolean)
    ));
  }
}

export const helpCenterSelectedDocumentViewerSectionIdsConverter =
  HelpCenterSelectedDocumentViewerSectionIdsConverter satisfies UiConverter<
    readonly string[] | ReadonlySet<string> | null | undefined,
    string[]
  >;

export interface HelpCenterRevisionDocumentViewerSectionsConverterInput {
  revision: HelpCenterRevisionDto | null;
  sectionMode?: HelpCenterRevisionDocumentViewerSectionMode;
  selectedSectionIds?: readonly string[] | ReadonlySet<string> | null;
}

export class HelpCenterRevisionDocumentViewerSectionsConverter {
  static convert(input: HelpCenterRevisionDocumentViewerSectionsConverterInput): DocumentViewerSection[] {
    const sections = input.revision?.sections ?? [];
    return input.sectionMode === 'privacy'
      ? HelpCenterPrivacyDocumentViewerSectionConverter.convert({
        sections,
        selectedSectionIds: input.selectedSectionIds
      })
      : HelpCenterDocumentViewerSectionConverter.convertList(sections);
  }
}

export const helpCenterRevisionDocumentViewerSectionsConverter =
  HelpCenterRevisionDocumentViewerSectionsConverter satisfies UiConverter<
    HelpCenterRevisionDocumentViewerSectionsConverterInput,
    DocumentViewerSection[]
  >;

export class HelpCenterRevisionDocumentViewerConfigConverter {
  static convert(options: HelpCenterRevisionDocumentViewerConfigOptions): DocumentViewerConfig {
    const revision = options.revision;
    return {
      shell: options.shell,
      open: options.open,
      onClose: options.onClose,
      closeOnBackdrop: options.closeOnBackdrop,
      closeAriaLabel: options.closeAriaLabel,
      ariaLabel: options.ariaLabel,
      title: revision?.summary?.trim() || options.titleFallback,
      description: revision?.description?.trim() || options.descriptionFallback || '',
      versionLabel: options.versionLabel,
      headerPalette: HelpCenterDocumentViewerHeaderPaletteConverter.convert(
        options.headerPalette ?? revision?.headerColor,
        { fallback: options.headerPaletteFallback }
      ),
      showBrand: options.showBrand,
      loading: options.loading,
      loadingLabel: options.loadingLabel,
      emptyState: options.emptyState,
      sections: HelpCenterRevisionDocumentViewerSectionsConverter.convert({
        revision,
        sectionMode: options.sectionMode,
        selectedSectionIds: options.selectedSectionIds
      }),
      selectedSectionIds: HelpCenterSelectedDocumentViewerSectionIdsConverter.convert(options.selectedSectionIds),
      actions: options.actions,
      statusMessage: options.statusMessage,
      statusTone: options.statusTone
    };
  }
}

export const helpCenterRevisionDocumentViewerConfigConverter =
  HelpCenterRevisionDocumentViewerConfigConverter satisfies UiConverter<
    HelpCenterRevisionDocumentViewerConfigOptions,
    DocumentViewerConfig
  >;
