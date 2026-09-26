import { Directive, Input } from '@angular/core';
import { LazyBgImageDirective } from '../../../directives/lazy-bg-image.directive';

@Directive({selector: '[appLazyBgImage]', standalone: true})
class TestImageDirective { @Input() appLazyBgImage: string | null = null; }
import { TestBed } from '@angular/core/testing';

import { I18nService, MediaService } from '../../../../core';
import { ImageCarouselComponent } from './image-carousel.component';

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
  it('read-only slideshow renders existing images, permits navigation and offers no upload/remove', () => {
    const fixture = TestBed.createComponent(ImageCarouselComponent);
    fixture.componentRef.setInput('readOnly', true);
    fixture.componentRef.setInput('slideshow', true);
    fixture.componentInstance.writeValue(['a.jpg', 'b.jpg']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.image-carousel__slot').length).toBe(2);
    expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.image-carousel__slot-action--remove')).toBeNull();
    const next = fixture.nativeElement.querySelector('.image-carousel__arrow--next');
    expect(next.disabled).toBe(false);
    next.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.image-carousel__arrow--prev')).not.toBeNull();
  });
  it('single cover has expansion without arrows even when five gallery images exist elsewhere', () => {
    const fixture = TestBed.createComponent(ImageCarouselComponent);
    fixture.componentRef.setInput('slotCount', 1);
    fixture.componentRef.setInput('expandable', true);
    fixture.componentRef.setInput('disabled', true);
    fixture.componentInstance.writeValue(['cover.jpg']);
    const expand = vi.fn(); fixture.componentInstance.expand.subscribe(expand);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.image-carousel__arrow')).toBeNull();
    fixture.nativeElement.querySelector('.image-carousel__expand').click();
    expect(expand).toHaveBeenCalledOnce();
  });

  it('read-only editor selects every stored image and exposes details without mutation controls', () => {
    const fixture = TestBed.createComponent(ImageCarouselComponent);
    fixture.componentRef.setInput('readOnly', true);
    fixture.componentRef.setInput('previewMode', true);
    fixture.componentRef.setInput('imageDetails', {
      'a.jpg': { location: 'Park', caption: 'First photo' },
      'b.jpg': { location: 'Hall', caption: 'Second photo' }
    });
    fixture.componentInstance.writeValue(['a.jpg', 'b.jpg']);
    fixture.detectChanges();
    const slots = fixture.nativeElement.querySelectorAll('.image-carousel__slot');
    expect(slots.length).toBe(2);
    slots[1].querySelector('.image-carousel__slot-hit').click();
    fixture.detectChanges();
    expect(slots[1].classList.contains('is-selected')).toBe(true);
    expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.image-carousel__slot-action--remove')).toBeNull();
    const c = fixture.componentInstance as any;
    slots[1].querySelector('.image-carousel__slot-action--details').click();
    expect(c.detailsDraft.caption).toBe('Second photo');
    expect(c.detailsPopupModel().headerActions).toEqual([]);
    c.updateCaption('Changed');
    expect(c.detailsDraft.caption).toBe('Second photo');
    const changed = vi.fn(); c.imageDetailsChange.subscribe(changed);
    c.saveDetails();
    expect(changed).not.toHaveBeenCalled();
  });

  it('edits details in a draft, cancels without change, and emits only on the tick action', () => {
    const fixture = TestBed.createComponent(ImageCarouselComponent);
    const c = fixture.componentInstance as any;
    c.detailsEditable = true; c.writeValue(['a.jpg']);
    c.imageDetails = { 'a.jpg': { location: 'Budapest', caption: 'Old caption' } };
    const changed = vi.fn(); c.imageDetailsChange.subscribe(changed);
    c.openDetails('a.jpg', new Event('click'));
    c.updateCaption('x'.repeat(50));
    expect(c.detailsDraft.caption.length).toBe(40);
    c.detailsPopupModel().onClose(); expect(changed).not.toHaveBeenCalled();
    c.openDetails('a.jpg', new Event('click')); c.updateCaption('New caption');
    c.detailsPopupModel().onAction();
    expect(changed).toHaveBeenCalledWith({ 'a.jpg': {location: 'Budapest', caption: 'New caption'} });
    c.readOnly = true; c.openDetails('a.jpg', new Event('click'));
    expect(c.detailsDraft).toBeNull();
  });
  it('replaces copy with the panel button and displays location/caption only in gallery view', () => {
    const fixture = TestBed.createComponent(ImageCarouselComponent);
    fixture.componentRef.setInput('detailsEditable', true);
    fixture.componentRef.setInput('imageDetails', {'a.jpg':{location:'Budapest',caption:'Short caption'}});
    fixture.componentInstance.writeValue(['a.jpg']); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.image-carousel__slot-action--copy')).toBeNull();
    expect(fixture.nativeElement.querySelector('.image-carousel__slot-action--details')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.image-carousel__caption')).toBeNull();
    fixture.componentRef.setInput('readOnly', true); fixture.componentRef.setInput('slideshow', true); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.image-carousel__caption').textContent).toBe('Short caption');
    expect(fixture.nativeElement.querySelector('.image-carousel__location').href).toContain('Budapest');
    expect(fixture.nativeElement.querySelector('.image-carousel__slot-action--details')).toBeNull();
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
