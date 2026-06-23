import { AppUtils } from '../../app-utils';
import { APP_STATIC_DATA } from '../../app-static-data';
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
    const selectedIds = AppUtils.uniqueTrimmedStrings(input.selectedSectionIds);
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

export class HelpCenterRevisionDocumentViewerConfigConverter {
  static convert(options: HelpCenterRevisionDocumentViewerConfigOptions): DocumentViewerConfig {
    const revision = options.revision;
    const sections = revision?.sections ?? [];
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
      headerPalette: AppUtils.enumValue(
        options.headerPalette ?? revision?.headerColor,
        APP_STATIC_DATA.documentViewerHeaderPalettes,
        options.headerPaletteFallback ?? 'amber'
      ),
      showBrand: options.showBrand,
      loading: options.loading,
      loadingLabel: options.loadingLabel,
      emptyState: options.emptyState,
      sections: options.sectionMode === 'privacy'
        ? HelpCenterPrivacyDocumentViewerSectionConverter.convert({
          sections,
          selectedSectionIds: options.selectedSectionIds
        })
        : HelpCenterDocumentViewerSectionConverter.convertList(sections),
      selectedSectionIds: AppUtils.uniqueTrimmedStrings(options.selectedSectionIds),
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
