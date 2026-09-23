import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalMemoryDb } from '../../../common/app.db';
import { LocalContentModerationRepository } from './content-moderation.repository';
import { CONTENT_MODERATION_TABLE_NAME, emptyContentModeration } from '../entity/content-moderation.entity';
import { LocalPhotoFeedRepository } from './photo-feed.repository';

describe('Content moderation canonical writes', () => {
  let repository: LocalContentModerationRepository, feed: LocalPhotoFeedRepository;
  beforeEach(async () => {
    TestBed.configureTestingModule({}); await TestBed.inject(LocalMemoryDb).resetStorage();
    repository = TestBed.inject(LocalContentModerationRepository); feed = TestBed.inject(LocalPhotoFeedRepository);
    await repository.saveSettings({ enabled: true, autoApprove: false, delayMinutes: 0, categories: ['asset', 'event', 'feed'] }, repository.snapshot().revision);
  });
  afterEach(() => TestBed.resetTestingModule());
  async function post() {
    return feed.insert({ id: 'post', creatorUserId: 'alice', creatorName: 'Alice', creatorAvatarUrl: '', createdAtIso: new Date().toISOString(),
      imageUrls: ['photo'], imageDetails: {}, locationCoordinates: { latitude: 0, longitude: 0 } });
  }
  it('defaults to disabled moderation without holding back publication or running auto approval', async () => {
    const defaults = emptyContentModeration().settings;
    expect(defaults.enabled).toBe(false);
    expect(defaults.autoApprove).toBe(false);
    await repository.saveSettings(defaults, repository.snapshot().revision);
    await post();
    expect(repository.snapshot().pendingCount).toBe(0);
    expect(feed.page('bob', { latitude: 0, longitude: 0 }, { page: 0, pageSize: 10 }).total).toBe(1);
    expect(await repository.approveDue()).toBe(0);
  });
  it('releases pending, rejected and blocked photos through the Job when disabled and preserves counts on repeat and re-enable', async () => {
    for (const id of ['pending', 'rejected', 'blocked']) {
      await feed.insert({ id, creatorUserId: 'alice', creatorName: 'Alice', creatorAvatarUrl: '', createdAtIso: new Date().toISOString(),
        imageUrls: ['photo'], imageDetails: {}, locationCoordinates: { latitude: 0, longitude: 0 } });
    }
    await repository.decide('feed:rejected', { adminUserId: 'admin', commandId: 'reject', expectedVersion: 1, status: 'rejected', message: '' });
    await repository.decide('feed:blocked', { adminUserId: 'admin', commandId: 'accept', expectedVersion: 1, status: 'accepted', message: '' });
    await repository.decide('feed:blocked', { adminUserId: 'admin', commandId: 'block', expectedVersion: 2, status: 'blocked', message: '' });
    const settings = { enabled: false, autoApprove: false, delayMinutes: 43200, categories: ['asset'] as const };
    await repository.saveSettings({ ...settings, categories: [...settings.categories] }, repository.snapshot().revision);
    expect(repository.snapshot().pendingCount).toBe(1);
    expect(await repository.approveDue()).toBe(3);
    expect(repository.snapshot().pendingCount).toBe(0);
    expect(repository.snapshot().counts.feed).toEqual({ 'under-review': 0, accepted: 3, rejected: 0, blocked: 0 });
    expect(feed.page('bob', { latitude: 0, longitude: 0 }, { page: 0, pageSize: 10 }).total).toBe(3);
    const released = repository.item('feed:blocked')!;
    await expect(repository.decide(released.id, { adminUserId: 'admin', commandId: 'blocked-while-off', expectedVersion: released.version,
      status: 'blocked', message: '' })).rejects.toThrow();
    await repository.saveSettings({ ...settings, categories: [...settings.categories] }, repository.snapshot().revision);
    expect(await repository.approveDue()).toBe(0);
    expect(repository.item(released.id)?.version).toBe(released.version);
    await repository.saveSettings({ ...settings, enabled: true, categories: [...settings.categories] }, repository.snapshot().revision);
    expect(repository.snapshot().pendingCount).toBe(0);
    expect(feed.page('bob', { latitude: 0, longitude: 0 }, { page: 0, pageSize: 10 }).total).toBe(3);
  });
  it('hides pending photos and approves them through the delayed periodic Job', async () => {
    await repository.saveSettings({ enabled: true, autoApprove: true, delayMinutes: 1, categories: ['feed'] }, repository.snapshot().revision);
    await post(); expect(repository.snapshot().pendingCount).toBe(1);
    expect(feed.page('bob', { latitude: 0, longitude: 0 }, { page: 0, pageSize: 10 }).total).toBe(0);
    expect(feed.page('alice', { latitude: 0, longitude: 0 }, { page: 0, pageSize: 10 }).total).toBe(1);
    expect(await repository.approveDue(Date.now() + 60001)).toBe(1);
    expect(repository.snapshot().pendingCount).toBe(0);
    expect(feed.page('bob', { latitude: 0, longitude: 0 }, { page: 0, pageSize: 10 }).total).toBe(1);
    expect(await repository.approveDue()).toBe(0);
  });
  it('honours delay and leaves counts unchanged on reads', async () => {
    await post(); const snapshot = repository.snapshot();
    await repository.saveSettings({ enabled: true, autoApprove: true, delayMinutes: 5, categories: ['feed'] }, snapshot.revision);
    expect(await repository.approveDue()).toBe(0);
    expect(await repository.approveDue(Date.now() + 300001)).toBe(1);
    expect(repository.snapshot().counts.feed.accepted).toBe(1);
    expect(repository.page('feed', 'accepted', { page: 0, pageSize: 10 }).total).toBe(1);
    expect(repository.snapshot().counts.feed.accepted).toBe(1);
  });
  it('moves one count, rejects stale admins and treats retries as idempotent', async () => {
    await post(); const request = { adminUserId: 'admin', commandId: 'reject', expectedVersion: 1, status: 'rejected' as const, message: '' };
    await repository.decide('feed:post', request); await repository.decide('feed:post', request);
    expect(repository.snapshot().counts.feed).toEqual({ 'under-review': 0, rejected: 1 });
    await expect(repository.decide('feed:post', { ...request, commandId: 'other-admin', status: 'blocked' })).rejects.toThrow();
    expect(repository.snapshot().pendingCount).toBe(0);
  });
  it('retains an undelivered support message across a decision retry until acknowledgement', async () => {
    await post();
    const admin = { id: 'admin', name: 'Admin', initials: 'AD', email: 'admin@example.invalid' };
    const request = { adminUserId: admin.id, commandId: 'support-reject', expectedVersion: 1,
      status: 'rejected' as const, message: 'Please review this photo.' };
    await repository.decide('feed:post', request, admin);
    await repository.decide('feed:post', request, admin);
    expect(repository.state().pendingMessages).toHaveLength(1);
    expect(repository.state().pendingMessages[0].ownerUserId).toBe('alice');
    expect(repository.snapshot()).not.toHaveProperty('pendingMessages');
    expect(repository.snapshot().counts.feed.rejected).toBe(1);
    await repository.acknowledgeMessage(request.commandId);
    expect(repository.state().pendingMessages).toEqual([]);
    expect(repository.snapshot().counts.feed.rejected).toBe(1);
  });
  it('combines category and state filters while bucket moves preserve category totals', async () => {
    await post();
    const feedItem = repository.item('feed:post');
    TestBed.inject(LocalMemoryDb).write(state => ({ ...state, [CONTENT_MODERATION_TABLE_NAME]: {
      ...repository.state(), items: { ...repository.state().items,
        'event:party': { ...feedItem, id: 'event:party', sourceId: 'party', category: 'event' },
        'asset:car': { ...feedItem, id: 'asset:car', sourceId: 'car', category: 'asset' } },
      counts: { feed: { 'under-review': 1 }, event: { 'under-review': 1 }, asset: { 'under-review': 1 } }
    } }));
    const first = repository.page('all', 'under-review', { page: 0, pageSize: 1 });
    expect(first.total).toBe(3); expect(first.items).toHaveLength(1);
    const next = repository.page('all', 'under-review', { page: 0, pageSize: 10, cursor: first.nextCursor });
    expect(next.items).toHaveLength(2);
    for (const [index, status] of (['accepted', 'blocked', 'under-review'] as const).entries()) {
      await repository.decide('feed:post', { adminUserId: 'admin', expectedVersion: index + 1, commandId: `move-${index}`, status, message: '' });
      expect(repository.page('feed', status, { page: 0, pageSize: 10 }).total).toBe(1);
      expect(repository.page('event', 'under-review', { page: 0, pageSize: 10 }).total).toBe(1);
      expect(repository.page('all', 'under-review', { page: 0, pageSize: 10 }).total).toBe(status === 'under-review' ? 3 : 2);
    }
  });

  it('publishes immediately at zero minutes without waiting for the Job', async () => {
    await repository.saveSettings({ enabled: true, autoApprove: true, delayMinutes: 0, categories: ['feed'] }, repository.snapshot().revision);
    await post();
    expect(repository.item('feed:post')?.status).toBe('accepted');
    expect(repository.item('feed:post')?.publiclyVisibleOnce).toBe(true);
    expect(repository.snapshot().pendingCount).toBe(0);
    expect(feed.page('bob', { latitude: 0, longitude: 0 }, { page: 0, pageSize: 10 }).total).toBe(1);
    expect(await repository.approveDue()).toBe(0);
  });

});
