export class SmartListPaginationHelper<T> {
  private leavingItemValue: T | null = null;
  private animatingValue = false;

  constructor(private readonly markDirty: () => void) {}

  public get leavingItem(): T | null {
    return this.leavingItemValue;
  }

  public get animating(): boolean {
    return this.animatingValue;
  }

  public beginTransition(item: T): void {
    this.leavingItemValue = item;
    this.animatingValue = true;
    this.markDirty();
  }

  public finishTransition(): void {
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
    this.animatingValue = false;
    this.leavingItemValue = null;
  }
}
