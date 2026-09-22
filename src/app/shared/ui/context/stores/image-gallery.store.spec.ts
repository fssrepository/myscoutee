import { ImageGalleryStore, ImageGalleryRequest } from './image-gallery.store';

describe('Shared signal gallery', () => {
  const request = (patch: Partial<ImageGalleryRequest> = {}): ImageGalleryRequest => ({
    images: ['a', 'b', 'c', 'd', 'e'], slotCount: 5, readOnly: false,
    title: 'images', uploadOwnerId: 'owner', uploadEntityId: 'event', ...patch
  });
  it('passes all five URLs and updates the caller only within the configured limit', () => {
    const store = new ImageGalleryStore(), onChange = vi.fn();
    const token = store.open(request({ onChange }));
    expect(store.request()?.images).toEqual(['a', 'b', 'c', 'd', 'e']);
    store.updateImages(token, ['b', 'c']);
    expect(onChange).toHaveBeenCalledWith(['b', 'c']);
    store.updateImages(token, ['1','2','3','4','5','6']);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it('cannot mutate a read-only gallery', () => {
    const store = new ImageGalleryStore(), onChange = vi.fn();
    const token = store.open(request({ readOnly: true, onChange }));
    store.updateImages(token, []);
    expect(onChange).not.toHaveBeenCalled();
    expect(store.request()?.images.length).toBe(5);
  });
  it('ignores stale uploads or closing an older caller after another gallery opens', () => {
    const store = new ImageGalleryStore(), oldChange = vi.fn();
    const old = store.open(request({ onChange: oldChange }));
    const current = store.open(request({ images: ['new'] }));
    store.updateImages(old, ['stale']); store.close(old);
    expect(oldChange).not.toHaveBeenCalled();
    expect(store.request()?.token).toBe(current);
    expect(store.request()?.images).toEqual(['new']);
  });
});

describe('Gallery submit boundary', () => {
  it('waits for save, blocks duplicate submissions and keeps a failed draft for retry', async () => {
    const store = new ImageGalleryStore();
    let reject!: (reason: Error) => void;
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, failed) => { reject = failed; })).mockResolvedValueOnce(undefined);
    const token = store.open({ images: ['one'], imageDetails: { one: { location: 'Here', caption: 'Caption' } },
      slotCount: 5, readOnly: false, title: '', uploadOwnerId: 'a', uploadEntityId: 'p', onSave: save });
    const pending = store.save(token);
    await store.save(token);
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.saving()).toBe(true);
    store.updateImages(token, []);
    reject(new Error('offline')); await pending;
    expect(store.error()).toBe(true);
    expect(store.request()?.images).toEqual(['one']);
    await store.save(token);
    expect(save).toHaveBeenCalledTimes(2); expect(store.request()).toBeNull();
  });
  it('cannot submit while a photo is uploading or submit a read-only request', async () => {
    const store = new ImageGalleryStore(), save = vi.fn();
    const request = { images: ['one'], slotCount: 5, readOnly: false, title: '', uploadOwnerId: 'a', uploadEntityId: 'p', onSave: save };
    const token = store.open(request); store.setUploading(token, true); await store.save(token);
    expect(save).not.toHaveBeenCalled();
    const readonly = store.open({ ...request, readOnly: true }); await store.save(readonly);
    expect(save).not.toHaveBeenCalled();
  });
});
