import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile-editor-image-editor-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-editor-image-editor-screen.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileEditorImageEditorScreenComponent implements OnChanges {
  @Input({ required: true }) imageSlots: Array<string | null> = [];

  @Output() imageSlotsChange = new EventEmitter<Array<string | null>>();

  @ViewChild('slotImageInput') private slotImageInput?: ElementRef<HTMLInputElement>;

  protected selectedImageIndex = 0;
  private pendingSlotUploadIndex: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['imageSlots']) {
      return;
    }
    if (this.imageSlots.length === 0) {
      this.selectedImageIndex = 0;
      return;
    }
    if (this.selectedImageIndex >= this.imageSlots.length) {
      this.selectedImageIndex = 0;
    }
    if (this.imageSlots[this.selectedImageIndex]) {
      return;
    }
    const firstFilled = this.imageSlots.findIndex(slot => Boolean(slot));
    this.selectedImageIndex = firstFilled >= 0 ? firstFilled : 0;
  }

  protected get selectedImagePreview(): string | null {
    return this.imageSlots[this.selectedImageIndex] ?? null;
  }

  protected get imageStackSlots(): number[] {
    return this.imageSlots
      .map((slot, index) => (slot ? index : -1))
      .filter(index => index >= 0);
  }

  protected selectImageSlot(index: number): void {
    if (index < 0 || index >= this.imageSlots.length) {
      return;
    }
    this.selectedImageIndex = index;
    if (this.imageSlots[index]) {
      return;
    }
    this.pendingSlotUploadIndex = index;
    this.slotImageInput?.nativeElement.click();
  }

  protected selectImageFromStack(index: number): void {
    if (index < 0 || index >= this.imageSlots.length || !this.imageSlots[index]) {
      return;
    }
    this.selectedImageIndex = index;
  }

  protected removeImage(index: number): void {
    if (index < 0 || index >= this.imageSlots.length) {
      return;
    }
    this.revokeObjectUrl(this.imageSlots[index]);
    const next = [...this.imageSlots];
    next[index] = null;
    this.emitImageSlots(next);
    if (this.selectedImageIndex === index) {
      const nearest = this.findNearestFilledImageIndex(index, next);
      this.selectedImageIndex = nearest >= 0 ? nearest : 0;
    }
  }

  protected onSlotImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    const slotIndex = this.pendingSlotUploadIndex;
    this.pendingSlotUploadIndex = null;
    if (!file || slotIndex === null || slotIndex < 0 || slotIndex >= this.imageSlots.length) {
      target.value = '';
      return;
    }
    const next = [...this.imageSlots];
    this.revokeObjectUrl(next[slotIndex]);
    next[slotIndex] = URL.createObjectURL(file);
    this.selectedImageIndex = slotIndex;
    this.emitImageSlots(next);
    target.value = '';
  }

  private emitImageSlots(slots: Array<string | null>): void {
    this.imageSlots = slots;
    this.imageSlotsChange.emit([...slots]);
  }

  private findNearestFilledImageIndex(fromIndex: number, slots: Array<string | null>): number {
    for (let distance = 1; distance < slots.length; distance += 1) {
      const right = fromIndex + distance;
      if (right < slots.length && slots[right]) {
        return right;
      }
      const left = fromIndex - distance;
      if (left >= 0 && slots[left]) {
        return left;
      }
    }
    return slots.findIndex(slot => Boolean(slot));
  }

  private revokeObjectUrl(value: string | null): void {
    if (value && value.startsWith('blob:')) {
      URL.revokeObjectURL(value);
    }
  }
}
