import { TestBed } from '@angular/core/testing';
import { ImageGalleryStore, ImageGalleryRequest } from '@myscoutee/components';

describe('MyScoutee gallery event requirement', () => {
  it('requires a saved event on each uploaded image only when configured', async () => {
    const store = TestBed.runInInjectionContext(() => new ImageGalleryStore()), save = vi.fn();
    const event = { id: 'event', title: 'Event', organizerId: 'host', organizerName: 'Host', location: 'Park' };
    const token = store.open({ images: ['one', 'two'], slotCount: 5, readOnly: false, title: '',
      uploadOwnerId: 'uploader', uploadEntityId: 'post', onSave: save, detailsConfig: { eventRequired: true } });
    expect(store.invalid()).toBe(true);
    await store.save(token);
    expect(save).not.toHaveBeenCalled();
    store.updateDetails(token, { one: { location: 'Park', caption: '', event } });
    expect(store.invalid()).toBe(true);
    store.updateImages(token, ['one']);
    expect(store.invalid()).toBe(false);
    await store.save(token);
    expect(save).toHaveBeenCalledOnce();
    store.open({ images: ['one'], slotCount: 5, readOnly: false, title: '', uploadOwnerId: 'uploader', uploadEntityId: 'event' });
    expect(store.invalid()).toBe(false);
  });
});
