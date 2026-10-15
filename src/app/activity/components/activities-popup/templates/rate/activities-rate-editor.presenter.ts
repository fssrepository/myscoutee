import type { ImageCardData, AppMenuRateConfig } from '@fssrepository/myscoutee-components';

interface ActivitiesRateEditorPresenterDeps {
  getRatingLabel: () => string;
  getFocusedRow: () => ImageCardData | null;
  isFullscreenModeActive: () => boolean;
  isEditorClosing: () => boolean;
  isEditorOpen: () => boolean;
  getRatingScale: () => readonly number[];
  getOwnRatingValue: (row: ImageCardData) => number;
  isPairReceivedRateRow: (row: ImageCardData) => boolean;
}

export class ActivitiesRateEditorPresenter {
  constructor(private readonly deps: ActivitiesRateEditorPresenterDeps) {}

  selectedValue(): number {
    const row = this.deps.getFocusedRow();
    return row ? this.deps.getOwnRatingValue(row) : 0;
  }

  barConfig(): AppMenuRateConfig {
    return {
      scale: this.deps.getRatingScale(),
      readonly: this.isSelectedReadOnly(),
      label: this.selectedBarLabel(),
      actionLabel: 'save',
      guideFields: { slider: 'rating-input', action: 'rating-save' },
      dock: {
        enabled: !this.deps.isFullscreenModeActive(),
        state: this.deps.isEditorClosing()
          ? 'closing'
          : this.deps.isEditorOpen()
            ? 'open'
            : 'hidden'
      }
    };
  }

  private selectedBarLabel(): string | null {
    if (this.deps.isFullscreenModeActive()) {
      return null;
    }
    return this.deps.getRatingLabel();
  }

  private isSelectedReadOnly(): boolean {
    const row = this.deps.getFocusedRow();
    return !!row && this.deps.isPairReceivedRateRow(row);
  }
}
