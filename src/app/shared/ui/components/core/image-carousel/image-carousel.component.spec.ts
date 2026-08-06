import { TestBed } from '@angular/core/testing';

import { MediaService } from '../../../../core';
import { ImageCarouselComponent } from './image-carousel.component';

describe('ImageCarouselComponent media variants', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ImageCarouselComponent],
      providers: [
        {
          provide: MediaService,
          useValue: { uploadImage: vi.fn() }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('keeps the canonical URL while requesting medium preview and small slot variants', () => {
    const component = TestBed.createComponent(ImageCarouselComponent).componentInstance;
    const view = component as unknown as ImageCarouselTestView;
    const largeUrl = managedImageUrl('large');

    component.writeValue([largeUrl]);
    const slots = view.imageSlots();

    expect(slots[0]).toBe(largeUrl);
    expect(view.selectedPreviewUrl(slots)).toBe(managedImageUrl('medium'));
    expect(view.slotImageUrl(slots[0])).toBe(managedImageUrl('small'));
  });

  it('requests a medium variant for a large editor slot when configured', () => {
    const component = TestBed.createComponent(ImageCarouselComponent).componentInstance;
    const view = component as unknown as ImageCarouselTestView;
    const largeUrl = managedImageUrl('large');

    component.slotImageVariant = 'medium';
    component.writeValue([largeUrl]);

    expect(view.imageSlots()[0]).toBe(largeUrl);
    expect(view.slotImageUrl(largeUrl)).toBe(managedImageUrl('medium'));
  });

  it('leaves external and local-mode images unchanged', () => {
    const component = TestBed.createComponent(ImageCarouselComponent).componentInstance;
    const view = component as unknown as ImageCarouselTestView;

    expect(view.slotImageUrl('https://cdn.example.test/photo.jpg')).toBe(
      'https://cdn.example.test/photo.jpg'
    );
    expect(view.selectedPreviewUrl(['data:image/png;base64,AAAA'])).toBe(
      'data:image/png;base64,AAAA'
    );
  });

  it('reports a removed slot while retaining the other image without replacement', () => {
    const component = TestBed.createComponent(ImageCarouselComponent).componentInstance;
    const view = component as unknown as ImageCarouselTestView;
    const largeUrl = managedImageUrl('large');
    const remainingUrl = largeUrl.replace('upload-1', 'upload-2');
    const removed = vi.fn();
    component.imageRemoved.subscribe(removed);

    component.writeValue([largeUrl, remainingUrl]);
    view.removeSlot(largeUrl, 0);

    expect(removed).toHaveBeenCalledWith(largeUrl);
    expect(view.imageSlots().slice(0, 2)).toEqual([remainingUrl, null]);
  });
});

interface ImageCarouselTestView {
  imageSlots: () => Array<string | null>;
  selectedPreviewUrl: (slots: readonly (string | null)[]) => string | null;
  slotImageUrl: (imageUrl: string | null) => string | null;
  removeSlot: (imageUrl: string, slotIndex: number) => void;
}

function managedImageUrl(variant: 'small' | 'medium' | 'large'): string {
  return `/api/media/public?key=${encodeURIComponent(`images/owner/article/upload-1/${variant}.webp`)}`;
}
