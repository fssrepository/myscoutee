import { Directive, Input } from '@angular/core';
import { LazyBgImageDirective, ImageCarouselComponent } from '@myscoutee/components';

@Directive({selector: '[appLazyBgImage]', standalone: true})
class TestImageDirective { @Input() appLazyBgImage: string | null = null; }
import { TestBed } from '@angular/core/testing';

import { I18nService, MediaService } from '../core';

describe('ImageCarouselComponent media variants', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ImageCarouselComponent],
      providers: [
        { provide: I18nService, useValue: { revision: () => 0, translate: (key: string) => key } },
        {
          provide: MediaService,
          useValue: { uploadImage: vi.fn() }
        }
      ]
    });
    TestBed.overrideComponent(ImageCarouselComponent, { remove: { imports: [LazyBgImageDirective] }, add: { imports: [TestImageDirective] } });
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
