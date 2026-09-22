import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import { PHOTO_FEED_TABLE_NAME, type PhotoFeedRecord } from '../entity/photo-feed.entity';
import { LocalPhotoFeedRepository } from './photo-feed.repository';
import { PhotoFeedConverter } from '../../../../ui/converters/photo-feed.converter';

describe('Photo feed local persistence and distance paging', () => {
  let db: LocalMemoryDb;
  let repository: LocalPhotoFeedRepository;
  const origin = { latitude: 0, longitude: 0 };
  const record = (id: string, latitude: number, createdAtIso: string): PhotoFeedRecord => ({
    id, createdAtIso, creatorUserId: 'alice', creatorName: 'Alice', creatorAvatarUrl: '',
    imageUrls: ['first', 'second'], imageDetails: { first: { location: 'Park', caption: 'First caption' } },
    locationCoordinates: { latitude, longitude: 0 }
  });
  beforeEach(async () => {
    TestBed.configureTestingModule({}); db = TestBed.inject(LocalMemoryDb); await db.resetStorage();
    repository = TestBed.inject(LocalPhotoFeedRepository);
  });
  afterEach(() => TestBed.resetTestingModule());
  it('groups by five kilometres, newest first within each bucket, and pages without duplicates', async () => {
    await repository.insert(record('near-old', .001, '2026-09-21T10:00:00.000Z'));
    await repository.insert(record('near-new', .035, '2026-09-22T10:00:00.000Z'));
    await repository.insert(record('far-newest', .055, '2026-09-23T10:00:00.000Z'));
    const first = repository.page('alice', origin, { page: 0, pageSize: 2 });
    const second = repository.page('alice', origin, { page: 1, pageSize: 2, cursor: first.nextCursor });
    expect(first.items.map(p => p.id)).toEqual(['near-new', 'near-old']);
    expect(second.items.map(p => p.id)).toEqual(['far-newest']); expect(second.nextCursor).toBeNull();
    expect(first.total).toBe(3);
    expect(PhotoFeedConverter.convert(first.items[0]).groupLabel).toBe('0–5 km');
    expect(PhotoFeedConverter.convert(second.items[0]).groupLabel).toBe('5–10 km');
  });
  it('preserves all URLs and metadata in the canonical table; repeated save does not add another row', async () => {
    const post = record('persisted', 0, '2026-09-22T10:00:00.000Z');
    await repository.insert(post); await repository.insert({ ...post, creatorName: 'Duplicate' });
    const table = db.read()[PHOTO_FEED_TABLE_NAME];
    expect(table.ids).toEqual(['persisted']); expect(table.byId['persisted']).toEqual({ ...post, moderationStatus: 'under-review' });
    const dto = repository.page('alice', origin, { page: 0, pageSize: 10 }).items[0];
    const card = PhotoFeedConverter.convert(dto);
    expect(card.imageUrls).toEqual(['first', 'second']); expect(card.title).toBe('First caption');
    expect(card.eagerDetail?.imageDetails.first.location).toBe('Park');
  });
});
