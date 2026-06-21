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

export class HelpCenterRevisionDocumentViewerConverter {
  static convertRevision(options: HelpCenterRevisionDocumentViewerConfigOptions): DocumentViewerConfig {
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
      headerPalette: this.headerPalette(options.headerPalette ?? revision?.headerColor, options.headerPaletteFallback),
      showBrand: options.showBrand,
      loading: options.loading,
      loadingLabel: options.loadingLabel,
      emptyState: options.emptyState,
      sections: this.convertRevisionSections(revision, options),
      selectedSectionIds: this.selectedIdList(options.selectedSectionIds),
      actions: options.actions,
      statusMessage: options.statusMessage,
      statusTone: options.statusTone
    };
  }

  static convertSections(sections: readonly HelpCenterSectionDto[]): DocumentViewerSection[] {
    return sections.map(section => ({
      id: section.id,
      icon: section.icon,
      title: section.title,
      blurb: section.blurb,
      contentHtml: section.contentHtml,
      points: section.points,
      details: section.details
    }));
  }

  static convertPrivacySections(
    sections: readonly HelpCenterSectionDto[],
    selectedSectionIds: readonly string[] | ReadonlySet<string> | null | undefined
  ): DocumentViewerSection[] {
    const selectedIds = this.selectedIdSet(selectedSectionIds);
    return this.convertSections(sections).map((section, index) => {
      const source = sections[index];
      const optional = source?.optional === true;
      return {
        ...section,
        tone: optional ? 'optional' as const : 'mandatory' as const,
        selected: selectedIds.has(section.id),
        toggleable: optional
      };
    });
  }

  static headerPalette(
    value: string | null | undefined,
    fallback: DocumentViewerHeaderPalette = 'amber'
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
        return fallback;
    }
  }

  static helpHeaderPalette(value: string | null | undefined): DocumentViewerHeaderPalette {
    const normalized = this.headerPalette(value, 'teal');
    return normalized === 'amber' ? 'teal' : normalized;
  }

  static selectedIdList(value: readonly string[] | ReadonlySet<string> | null | undefined): string[] {
    return Array.from(this.selectedIdSet(value));
  }

  private static convertRevisionSections(
    revision: HelpCenterRevisionDto | null,
    options: HelpCenterRevisionDocumentViewerConfigOptions
  ): DocumentViewerSection[] {
    const sections = revision?.sections ?? [];
    return options.sectionMode === 'privacy'
      ? this.convertPrivacySections(sections, options.selectedSectionIds)
      : this.convertSections(sections);
  }

  private static selectedIdSet(value: readonly string[] | ReadonlySet<string> | null | undefined): Set<string> {
    const values = Array.from(value ?? []);
    return new Set(
      values
        .map((sectionId: string) => `${sectionId ?? ''}`.trim())
        .filter(Boolean)
    );
  }
}
