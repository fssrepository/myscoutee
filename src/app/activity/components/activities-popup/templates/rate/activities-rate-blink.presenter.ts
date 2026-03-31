import type * as AppTypes from '../../../../../shared/core/base/models';

export function isActivitiesRateBlinking(
  row: AppTypes.ActivityListRow,
  blinkUntilByRowId: Record<string, number>
): boolean {
  const until = blinkUntilByRowId[row.id] ?? 0;
  return until > Date.now();
}

export function triggerActivitiesRateBlink(
  rowId: string,
  blinkUntilByRowId: Record<string, number>,
  blinkTimeoutByRowId: Record<string, ReturnType<typeof setTimeout> | null>,
  markForCheck: () => void,
  onStart?: () => void
): void {
  const durationMs = 420;
  const existingTimer = blinkTimeoutByRowId[rowId];
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  delete blinkUntilByRowId[rowId];
  markForCheck();

  const startBlink = () => {
    blinkUntilByRowId[rowId] = Date.now() + durationMs;
    onStart?.();
    markForCheck();
    blinkTimeoutByRowId[rowId] = setTimeout(() => {
      if ((blinkUntilByRowId[rowId] ?? 0) <= Date.now()) {
        delete blinkUntilByRowId[rowId];
      }
      const timer = blinkTimeoutByRowId[rowId];
      if (timer) {
        clearTimeout(timer);
      }
      delete blinkTimeoutByRowId[rowId];
      markForCheck();
    }, durationMs + 32);
  };

  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(() => startBlink());
    return;
  }
  setTimeout(() => startBlink(), 0);
}
