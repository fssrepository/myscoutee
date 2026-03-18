import type { SubEventFormItem } from './core/base/models';
import { AppUtils } from './app-utils';

export class AppSubEventHelpers {
  static subEventDesktopPageStarts(totalStages: number): number[] {
    const visibleColumns = 3;
    if (totalStages <= 0) {
      return [0];
    }
    if (totalStages <= visibleColumns) {
      return [0];
    }
    const starts: number[] = [0];
    const lastStart = totalStages - visibleColumns;
    for (let start = visibleColumns; start < lastStart; start += visibleColumns) {
      starts.push(start);
    }
    if (starts[starts.length - 1] !== lastStart) {
      starts.push(lastStart);
    }
    return starts;
  }

  static subEventDesktopNearestStartIndex(values: number[], currentValue: number): number {
    if (values.length === 0) {
      return 0;
    }
    let nearestIndex = 0;
    let nearestDiff = Number.POSITIVE_INFINITY;
    for (let index = 0; index < values.length; index += 1) {
      const diff = Math.abs(values[index] - currentValue);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestIndex = index;
      }
    }
    return nearestIndex;
  }

  static subEventDesktopPageOffsets(scrollElement: HTMLElement, starts: number[]): number[] {
    const stageOffsets = this.subEventDesktopStageOffsets(scrollElement);
    const maxIndex = Math.max(0, stageOffsets.length - 1);
    if (stageOffsets.length === 0) {
      return starts.map(() => 0);
    }
    return starts.map(start => stageOffsets[AppUtils.clampNumber(start, 0, maxIndex)] ?? 0);
  }

  static subEventDesktopStageOffsets(scrollElement: HTMLElement): number[] {
    const columns = Array.from(
      scrollElement.querySelectorAll<HTMLElement>('.subevent-stage-column:not(.subevent-stage-column-placeholder)')
    );
    if (columns.length === 0) {
      return [];
    }
    const scrollRect = scrollElement.getBoundingClientRect();
    return columns.map((column, index) => {
      const left = column.getBoundingClientRect().left - scrollRect.left + scrollElement.scrollLeft;
      if (Number.isFinite(left)) {
        return Math.max(0, left);
      }
      return Math.max(0, index * (scrollElement.clientWidth || 1));
    });
  }

  static resolveCurrentTournamentStageNumber(items: SubEventFormItem[], nowEpochMs = Date.now()): number {
    if (items.length === 0) {
      return 1;
    }
    for (let index = 0; index < items.length; index += 1) {
      const start = new Date(items[index].startAt).getTime();
      const end = new Date(items[index].endAt).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) {
        continue;
      }
      if (start <= nowEpochMs && nowEpochMs <= end) {
        return index + 1;
      }
    }
    for (let index = 0; index < items.length; index += 1) {
      const start = new Date(items[index].startAt).getTime();
      if (!Number.isNaN(start) && start > nowEpochMs) {
        return index + 1;
      }
    }
    return items.length;
  }
}
