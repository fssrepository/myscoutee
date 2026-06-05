import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { MediaService } from '../../../core';
import { LazyBgImageDirective } from '../../directives';
import { ProgressIndicatorComponent } from '../progress-indicator';

@Component({
  selector: 'app-editable-image-carousel',
  standalone: true,
  imports: [CommonModule, MatIconModule, LazyBgImageDirective, ProgressIndicatorComponent],
  templateUrl: './editable-image-carousel.component.html',
  styleUrl: './editable-image-carousel.component.scss'
})
export class EditableImageCarouselComponent implements OnChanges {
  @ViewChild('carouselViewport')
  private carouselViewportRef?: ElementRef<HTMLDivElement>;

  private readonly media = inject(MediaService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  @Input() imageUrls: readonly string[] | null = [];
  @Input() slotCount = 8;
  @Input() disabled = false;
  @Input() compact = false;
  @Input() ariaLabel = 'Image slots';
  @Input() primarySlotIndex = 0;

  @Output() imageUrlsChange = new EventEmitter<string[]>();

  protected carouselIndex = 0;
  protected uploadingSlotIndex: number | null = null;
  private localImageUrls: string[] = [];
  private carouselScrollLockTargetIndex: number | null = null;
  private carouselScrollLockTimer: ReturnType<typeof setTimeout> | null = null;

  @HostBinding('class.editable-image-carousel-host')
  protected readonly hostClass = true;

  @HostBinding('class.editable-image-carousel-host--compact')
  protected get compactClass(): boolean {
    return this.compact;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageUrls']) {
      this.localImageUrls = this.normalizedInputImageUrls();
    }
    if (changes['slotCount']) {
      this.carouselIndex = this.clampPageIndex(this.carouselIndex);
      this.scheduleViewportSync('auto');
    }
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.carouselIndex = this.clampPageIndex(this.carouselIndex);
    this.scheduleViewportSync('auto');
  }

  protected imageSlots(): Array<string | null> {
    const urls = this.localImageUrls.slice(0, this.normalizedSlotCount());
    return Array.from({ length: this.normalizedSlotCount() }, (_value, index) => urls[index] ?? null);
  }

  protected pages(): number[][] {
    const indexes = Array.from({ length: this.normalizedSlotCount() }, (_value, index) => index);
    const slotsPerPage = this.slotsPerPage();
    const pages: number[][] = [];
    for (let index = 0; index < indexes.length; index += slotsPerPage) {
      pages.push(indexes.slice(index, index + slotsPerPage));
    }
    return pages;
  }

  protected carouselTransform(): string | null {
    return this.usesNativeSnap() ? null : `translateX(-${this.carouselIndex * 100}%)`;
  }

  protected showPreviousPage(event?: Event): void {
    event?.stopPropagation();
    this.showPage(this.carouselIndex - 1, event);
  }

  protected showNextPage(event?: Event): void {
    event?.stopPropagation();
    this.showPage(this.carouselIndex + 1, event);
  }

  protected showPage(index: number, event?: Event): void {
    event?.stopPropagation();
    this.carouselIndex = this.clampPageIndex(index);
    this.scheduleViewportSync('smooth');
  }

  protected onCarouselScroll(): void {
    if (!this.usesNativeSnap()) {
      return;
    }
    const viewport = this.carouselViewportRef?.nativeElement;
    if (!viewport) {
      return;
    }
    if (this.carouselScrollLockTargetIndex !== null) {
      this.scheduleScrollLockRelease();
      return;
    }
    const nextPageIndex = this.currentPageIndex(viewport);
    if (nextPageIndex === this.carouselIndex) {
      return;
    }
    this.carouselIndex = nextPageIndex;
  }

  protected isUploading(slotIndex: number): boolean {
    return this.uploadingSlotIndex === this.clampSlotIndex(slotIndex);
  }

  protected openSlot(input: HTMLInputElement, event?: Event): void {
    event?.stopPropagation();
    if (this.disabled || this.uploadingSlotIndex !== null) {
      return;
    }
    input.click();
  }

  protected async uploadFromInput(event: Event, slotIndex: number): Promise<void> {
    event.stopPropagation();
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0] ?? null;
    const normalizedSlotIndex = this.clampSlotIndex(slotIndex);
    if (!file || this.disabled || this.uploadingSlotIndex !== null) {
      return;
    }
    this.carouselIndex = this.pageForSlot(normalizedSlotIndex);
    this.scheduleViewportSync('auto');
    this.uploadingSlotIndex = normalizedSlotIndex;
    this.refreshView();
    try {
      const result = await this.media.uploadImage('admin', 'shared', file);
      if (!result.uploaded || !result.imageUrl) {
        return;
      }
      const slots = this.imageSlots();
      slots[normalizedSlotIndex] = result.imageUrl;
      this.updateUrls(slots);
      void this.copyToClipboard(result.imageUrl);
    } finally {
      this.uploadingSlotIndex = null;
      if (input) {
        input.value = '';
      }
      this.refreshView();
    }
  }

  protected async copySlot(imageUrl: string, _slotIndex: number, event?: Event): Promise<void> {
    event?.stopPropagation();
    await this.copyToClipboard(imageUrl);
  }

  protected removeSlot(_imageUrl: string, slotIndex: number, event?: Event): void {
    event?.stopPropagation();
    const slots = this.imageSlots();
    slots[this.clampSlotIndex(slotIndex)] = null;
    this.updateUrls(slots);
  }

  private normalizedInputImageUrls(): string[] {
    return Array.from(new Set((this.imageUrls ?? []).map(url => `${url ?? ''}`.trim()).filter(Boolean)));
  }

  private updateUrls(slots: readonly (string | null)[]): void {
    this.localImageUrls = this.urlsFromSlots(slots);
    this.imageUrlsChange.emit([...this.localImageUrls]);
    this.refreshView();
  }

  private urlsFromSlots(slots: readonly (string | null)[]): string[] {
    return Array.from(new Set(slots.map(slot => `${slot ?? ''}`.trim()).filter(Boolean)));
  }

  private async copyToClipboard(imageUrl: string): Promise<void> {
    const link = await this.copyableImageLink(imageUrl);
    if (!link) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        return;
      }
    } catch {
      // Fallback below.
    }
    this.copyWithFallback(link);
  }

  private async copyableImageLink(imageUrl: string): Promise<string> {
    const normalized = `${imageUrl ?? ''}`.trim();
    if (!normalized) {
      return normalized;
    }
    if (normalized.startsWith('data:image/')) {
      return this.objectUrlFromDataImage(normalized) ?? normalized;
    }
    if (normalized.startsWith('blob:') || normalized.startsWith('indexeddb:')) {
      return normalized;
    }
    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }
    if (typeof window === 'undefined') {
      return normalized;
    }
    return new URL(normalized, window.location.origin).toString();
  }

  private objectUrlFromDataImage(imageUrl: string): string | null {
    if (typeof URL === 'undefined' || !URL.createObjectURL) {
      return null;
    }
    try {
      const parts = imageUrl.split(',', 2);
      if (parts.length !== 2) {
        return null;
      }
      const metadata = parts[0] ?? '';
      const payload = parts[1] ?? '';
      const contentType = /^data:([^;,]+)/i.exec(metadata)?.[1] ?? 'image/png';
      const binary = metadata.includes(';base64')
        ? atob(payload)
        : decodeURIComponent(payload);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return URL.createObjectURL(new Blob([bytes], { type: contentType }));
    } catch {
      return null;
    }
  }

  private copyWithFallback(value: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  private normalizedSlotCount(): number {
    const parsed = Math.trunc(Number(this.slotCount));
    if (!Number.isFinite(parsed)) {
      return 1;
    }
    return Math.max(1, Math.min(24, parsed));
  }

  private refreshView(): void {
    this.changeDetectorRef.markForCheck();
    queueMicrotask(() => {
      try {
        this.changeDetectorRef.detectChanges();
      } catch {
        // The carousel may have been destroyed while an upload was completing.
      }
    });
  }

  private clampSlotIndex(slotIndex: number): number {
    const parsed = Math.trunc(Number(slotIndex));
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(this.normalizedSlotCount() - 1, parsed));
  }

  private slotsPerPage(): number {
    const viewportWidth = this.readViewportWidth();
    if (viewportWidth <= 720) {
      return 1;
    }
    if (viewportWidth <= 980) {
      return 3;
    }
    return 4;
  }

  private pageForSlot(slotIndex: number): number {
    return this.clampPageIndex(Math.floor(this.clampSlotIndex(slotIndex) / this.slotsPerPage()));
  }

  private clampPageIndex(pageIndex: number): number {
    const parsed = Math.trunc(Number(pageIndex));
    const maxPageIndex = Math.max(0, Math.ceil(this.normalizedSlotCount() / this.slotsPerPage()) - 1);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.min(maxPageIndex, parsed));
  }

  private usesNativeSnap(): boolean {
    return this.readViewportWidth() <= 720;
  }

  private readViewportWidth(): number {
    return typeof window === 'undefined' ? 1180 : window.innerWidth;
  }

  private scheduleViewportSync(behavior: ScrollBehavior): void {
    if (!this.usesNativeSnap()) {
      this.clearScrollLock();
      this.resetViewportScroll();
      return;
    }
    const targetPageIndex = this.carouselIndex;
    if (behavior === 'smooth') {
      this.carouselScrollLockTargetIndex = targetPageIndex;
      this.scheduleScrollLockRelease();
    } else {
      this.clearScrollLock();
    }

    const sync = () => {
      const viewport = this.carouselViewportRef?.nativeElement;
      if (!viewport) {
        return;
      }
      const targetLeft = this.pageOffsetLeft(viewport, targetPageIndex);
      if (targetLeft < 0) {
        return;
      }
      const previousScrollBehavior = viewport.style.scrollBehavior;
      viewport.style.scrollBehavior = behavior;
      viewport.scrollLeft = targetLeft;
      const restore = () => {
        viewport.style.scrollBehavior = previousScrollBehavior;
      };
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => restore());
      } else {
        setTimeout(restore, 0);
      }
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(sync));
      return;
    }
    setTimeout(sync, 0);
  }

  private scheduleScrollLockRelease(): void {
    if (this.carouselScrollLockTimer) {
      clearTimeout(this.carouselScrollLockTimer);
    }
    this.carouselScrollLockTimer = setTimeout(() => {
      this.carouselScrollLockTimer = null;
      const viewport = this.carouselViewportRef?.nativeElement;
      const finalPageIndex = viewport ? this.currentPageIndex(viewport) : this.carouselScrollLockTargetIndex;
      this.carouselScrollLockTargetIndex = null;
      if (finalPageIndex === null) {
        return;
      }
      this.carouselIndex = finalPageIndex;
    }, 96);
  }

  private clearScrollLock(): void {
    if (this.carouselScrollLockTimer) {
      clearTimeout(this.carouselScrollLockTimer);
      this.carouselScrollLockTimer = null;
    }
    this.carouselScrollLockTargetIndex = null;
  }

  private currentPageIndex(viewport: HTMLDivElement): number {
    const pages = Array.from(viewport.querySelectorAll<HTMLElement>('.editable-image-carousel__page'));
    if (pages.length === 0) {
      return 0;
    }
    const currentLeft = viewport.scrollLeft;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    pages.forEach((page, index) => {
      const distance = Math.abs(page.offsetLeft - currentLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    return Math.max(0, Math.min(pages.length - 1, closestIndex));
  }

  private pageOffsetLeft(viewport: HTMLDivElement, pageIndex: number): number {
    const pages = Array.from(viewport.querySelectorAll<HTMLElement>('.editable-image-carousel__page'));
    if (pages.length === 0) {
      return -1;
    }
    const targetIndex = Math.max(0, Math.min(pages.length - 1, pageIndex));
    return Math.max(0, pages[targetIndex]?.offsetLeft ?? 0);
  }

  private resetViewportScroll(): void {
    const viewport = this.carouselViewportRef?.nativeElement;
    if (viewport && viewport.scrollLeft !== 0) {
      viewport.scrollLeft = 0;
    }
  }
}
