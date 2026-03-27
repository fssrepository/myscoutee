import { AppUtils } from '../../../../../shared/app-utils';

export function animateActivitiesRateEditorScrollTo(
  scrollElement: HTMLElement,
  targetTop: number,
  slideDurationMs: number,
  onAnimationFrameChange: (frameId: number | null) => void,
  onComplete?: () => void
): void {
  const startTop = scrollElement.scrollTop;
  const delta = targetTop - startTop;
  if (Math.abs(delta) <= 0.5) {
    scrollElement.scrollTop = targetTop;
    onComplete?.();
    return;
  }
  if (typeof globalThis.requestAnimationFrame !== 'function' || typeof globalThis.performance === 'undefined') {
    scrollElement.scrollTop = targetTop;
    onComplete?.();
    return;
  }
  const startTime = globalThis.performance.now();
  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / slideDurationMs);
    scrollElement.scrollTop = startTop + (delta * activitiesRateEditorLiftEasedProgress(progress));
    if (progress < 1) {
      onAnimationFrameChange(globalThis.requestAnimationFrame(step));
      return;
    }
    onAnimationFrameChange(null);
    scrollElement.scrollTop = targetTop;
    onComplete?.();
  };
  step(startTime);
}

export function syncActivitiesRatesListPositionToRow(
  scrollElement: HTMLElement,
  rowId: string,
  isMobileView: boolean,
  markForCheck: () => void
): void {
  const targetRow = scrollElement.querySelector<HTMLElement>(`[data-activity-rate-row-id="${rowId}"]`);
  if (!targetRow) {
    return;
  }
  const stickyHeaderHeight = scrollElement.querySelector<HTMLElement>('.smart-list__sticky')?.offsetHeight ?? 0;
  const targetTop = Math.max(0, targetRow.offsetTop - stickyHeaderHeight - (isMobileView ? 4 : 6));
  if (Math.abs(scrollElement.scrollTop - targetTop) <= 1) {
    return;
  }
  const previousSnapType = scrollElement.style.scrollSnapType;
  scrollElement.style.scrollSnapType = 'none';
  scrollElement.scrollTop = targetTop;
  const releaseSnap = () => {
    scrollElement.style.scrollSnapType = previousSnapType;
    markForCheck();
  };
  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(() => releaseSnap());
    return;
  }
  setTimeout(releaseSnap, 0);
}

function activitiesRateEditorLiftEasedProgress(progress: number): number {
  return sampleCubicBezierYForX(AppUtils.clampNumber(progress, 0, 1), 0.22, 1, 0.36, 1);
}

function sampleCubicBezierYForX(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }

  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleCurveY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleCurveDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  let t = x;
  for (let index = 0; index < 4; index += 1) {
    const currentX = sampleCurveX(t) - x;
    const derivative = sampleCurveDerivativeX(t);
    if (Math.abs(currentX) < 0.0001 || Math.abs(derivative) < 0.0001) {
      break;
    }
    t -= currentX / derivative;
  }

  let lowerBound = 0;
  let upperBound = 1;
  while (upperBound - lowerBound > 0.0001) {
    const currentX = sampleCurveX(t);
    if (Math.abs(currentX - x) < 0.0001) {
      break;
    }
    if (currentX > x) {
      upperBound = t;
    } else {
      lowerBound = t;
    }
    t = (lowerBound + upperBound) / 2;
  }

  return sampleCurveY(AppUtils.clampNumber(t, 0, 1));
}
