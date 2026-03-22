export class SmartListPaginationHelper<T> {
  private leaveTimer: ReturnType<typeof setTimeout> | null = null;
  private leavingItemValue: T | null = null;
  private animatingValue = false;

  constructor(
    private readonly markDirty: () => void,
    private readonly leaveDurationMs = 420
  ) {}

  public get leavingItem(): T | null {
    return this.leavingItemValue;
  }

  public get animating(): boolean {
    return this.animatingValue;
  }

  public beginTransition(item: T): void {
    this.clearTimer();
    this.leavingItemValue = item;
    this.animatingValue = true;
    this.leaveTimer = setTimeout(() => {
      this.leaveTimer = null;
      this.finishTransition();
    }, this.leaveDurationMs + 24);
    this.markDirty();
  }

  public finishTransition(): void {
    this.clearTimer();
    if (!this.animatingValue && this.leavingItemValue === null) {
      return;
    }
    this.animatingValue = false;
    this.leavingItemValue = null;
    this.markDirty();
  }

  public reset(): void {
    this.finishTransition();
  }

  public destroy(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (!this.leaveTimer) {
      return;
    }
    clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
  }
}
