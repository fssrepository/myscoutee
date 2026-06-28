import type {
  SmartListCursorState,
  SmartListPaginationStep
} from './smart-list.types';

export interface FiniteStepperCallbacks<T> {
  items: () => readonly T[];
  total: () => number;
  hasMore: () => boolean;
  loading: () => boolean;
  markDirty: () => void;
}

export interface FiniteStepperSetOptions {
  notify?: boolean;
}

export class FiniteStepper<T> {
  private cursorIndexValue = 0;
  private emptyCursorValue = false;
  private leavingItemValue: T | null = null;
  private animatingValue = false;

  constructor(private readonly callbacks: FiniteStepperCallbacks<T>) {}

  public get index(): number {
    return this.cursorIndexValue;
  }

  public get leavingItem(): T | null {
    return this.leavingItemValue;
  }

  public get animating(): boolean {
    return this.animatingValue;
  }

  public state(indexOverride = this.cursorIndexValue): SmartListCursorState<T> {
    const items = this.callbacks.items();
    const total = this.cursorTotal();
    if (total === 0) {
      return {
        index: 0,
        total: 0,
        progress: 0,
        canPrev: false,
        canNext: false,
        item: null
      };
    }

    const lastItemIndex = Math.max(0, total - 1);
    const maxCursorIndex = this.canUseEmptyCursor() ? total : lastItemIndex;
    const index = Math.max(0, Math.min(Math.trunc(indexOverride), maxCursorIndex));
    return {
      index,
      total,
      progress: index >= total ? 1 : lastItemIndex > 0 ? clampNumber(index / lastItemIndex, 0, 1) : 0,
      canPrev: index > 0,
      canNext: index < lastItemIndex,
      item: index < items.length ? (items[index] ?? null) : null
    };
  }

  public cursorTotal(): number {
    const total = Number(this.callbacks.total());
    const normalizedTotal = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
    return Math.max(normalizedTotal, this.callbacks.items().length);
  }

  public canMove(delta: number): boolean {
    const cursor = this.state();
    if (!Number.isFinite(delta) || delta === 0) {
      return false;
    }
    const targetIndex = cursor.index + Math.trunc(delta);
    if (targetIndex < 0) {
      return false;
    }
    return targetIndex < cursor.total;
  }

  public deltaFor(direction: -1 | 1, step: SmartListPaginationStep, pageSize: number): number {
    if (step !== 'page') {
      return direction;
    }
    const cursor = this.state();
    if (cursor.total <= 1) {
      return 0;
    }
    const normalizedPageSize = Math.max(1, Math.trunc(pageSize));
    if (direction < 0) {
      return Math.max(0, cursor.index - normalizedPageSize) - cursor.index;
    }
    const maxPageStart = Math.max(0, cursor.total - normalizedPageSize);
    return Math.min(cursor.index + normalizedPageSize, maxPageStart) - cursor.index;
  }

  public setIndex(index: number, options: FiniteStepperSetOptions = {}): boolean {
    const normalizedIndex = Math.max(0, Math.trunc(index));
    this.cursorIndexValue = normalizedIndex;
    this.syncBounds();
    this.notify(options);
    return this.state().index === normalizedIndex;
  }

  public syncBounds(): void {
    const total = this.cursorTotal();
    if (total === 0) {
      this.cursorIndexValue = 0;
      return;
    }
    const maxCursorIndex = this.canUseEmptyCursor() ? total : total - 1;
    this.cursorIndexValue = Math.max(0, Math.min(this.cursorIndexValue, maxCursorIndex));
  }

  public setEmptyCursor(value: boolean, options: FiniteStepperSetOptions = {}): void {
    this.emptyCursorValue = value;
    this.syncBounds();
    this.notify(options);
  }

  public canUseEmptyCursor(): boolean {
    return this.emptyCursorValue
      && this.cursorIndexValue >= this.cursorTotal()
      && this.cursorTotal() > 0
      && !this.callbacks.hasMore()
      && !this.callbacks.loading();
  }

  public canMoveToEmptyCursor(): boolean {
    const cursor = this.state();
    return cursor.item !== null
      && cursor.total > 0
      && cursor.index === cursor.total - 1
      && !this.callbacks.hasMore()
      && !this.callbacks.loading();
  }

  public beginTransition(item: T): void {
    this.leavingItemValue = item;
    this.animatingValue = true;
    this.callbacks.markDirty();
  }

  public finishTransition(options: FiniteStepperSetOptions = {}): void {
    if (!this.animatingValue && this.leavingItemValue === null) {
      return;
    }
    this.animatingValue = false;
    this.leavingItemValue = null;
    this.notify(options);
  }

  public reset(options: FiniteStepperSetOptions = {}): void {
    this.cursorIndexValue = 0;
    this.emptyCursorValue = false;
    this.animatingValue = false;
    this.leavingItemValue = null;
    this.notify(options);
  }

  public destroy(): void {
    this.animatingValue = false;
    this.leavingItemValue = null;
  }

  private notify(options: FiniteStepperSetOptions): void {
    if (options.notify === false) {
      return;
    }
    this.callbacks.markDirty();
  }
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
