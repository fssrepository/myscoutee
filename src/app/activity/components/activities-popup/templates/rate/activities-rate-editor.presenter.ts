import type { RateMenuItem } from '../../../../../shared/core/base/interfaces/activity-feed.interface';
import type * as AppTypes from '../../../../../shared/core/base/models';
import type { RatingStarBarConfig } from '../../../../../shared/ui';

interface ActivitiesRateEditorPresenterDeps {
  getActivitiesRateFilter: () => string;
  getSelectedRow: () => AppTypes.ActivityListRow | null;
  getFocusedRow: () => AppTypes.ActivityListRow | null;
  isFullscreenModeActive: () => boolean;
  isEditorClosing: () => boolean;
  isEditorOpen: () => boolean;
  getRatingScale: () => readonly number[];
  getOwnRatingValue: (row: AppTypes.ActivityListRow) => number;
  isPairReceivedRateRow: (row: AppTypes.ActivityListRow) => boolean;
}

export class ActivitiesRateEditorPresenter {
  constructor(private readonly deps: ActivitiesRateEditorPresenterDeps) {}

  selectedValue(): number {
    const row = this.deps.getFocusedRow();
    return row ? this.deps.getOwnRatingValue(row) : 0;
  }

  barConfig(): RatingStarBarConfig {
    return {
      scale: this.deps.getRatingScale(),
      readonly: this.isSelectedReadOnly(),
      label: this.selectedBarLabel(),
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

  private selectedModeLabel(): string {
    const row = this.deps.getSelectedRow();
    if (!row || row.type !== 'rates') {
      return this.deps.getActivitiesRateFilter().startsWith('individual') ? 'Single' : 'Pair';
    }
    const item = row.source as RateMenuItem;
    return item.mode === 'pair' ? 'Pair' : 'Single';
  }

  private selectedTitle(): string {
    return this.deps.getSelectedRow()?.title ?? 'Rate';
  }

  private selectedBarLabel(): string | null {
    if (this.deps.isFullscreenModeActive()) {
      return null;
    }
    return `Rate · ${this.selectedModeLabel()} · ${this.selectedTitle()}`;
  }

  private isSelectedReadOnly(): boolean {
    const row = this.deps.getFocusedRow();
    return !!row && this.deps.isPairReceivedRateRow(row);
  }
}
