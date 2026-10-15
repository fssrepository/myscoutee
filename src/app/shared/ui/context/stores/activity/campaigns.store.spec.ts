import '@angular/compiler';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { CampaignsStore } from './campaigns.store';
import { ActivityStore } from './activity.store';
import { GroupWorkspaceContextService } from '../../../../core/base/services/groups/group-workspace-context.service';
import type { Campaign, CampaignFilters } from '../../../../core/contracts/campaigns/campaign.interface';
import type { PageResult } from '@fssrepository/myscoutee-components';

function setup() {
  const activity = new ActivityStore(new GroupWorkspaceContextService());
  activity.patchUserCounterOverrides('work-profile', {
    notifications: 16, menuCounters: { campaignsPublished: 3, campaignsDrafts: 2, campaignsTrash: 4 }
  });
  let resolve!: (page: PageResult<Campaign>) => void;
  let reject!: (error: Error) => void;
  const response = new Promise<PageResult<Campaign>>((yes, no) => { resolve = yes; reject = no; });
  const host = {
    activity, session: signal<{ userId: string } | null>({ userId: 'work-profile' }),
    known: signal({}), service: { page: vi.fn(() => response) }
  };
  const page = (filters: CampaignFilters = { scope: 'own', status: 'draft' }, signal?: AbortSignal) =>
    CampaignsStore.prototype.page.call(host as unknown as CampaignsStore, { page: 0, pageSize: 10, filters }, signal);
  return { activity, host, resolve, reject, page };
}

describe('Campaign list reconciles its own status counter', () => {
  it.each([0, 1, 23])('uses absolute total %s, including empty and paginated results, preserving other counters', async total => {
    const { activity, page, resolve } = setup();
    const loading = page();
    resolve({ items: [], total, nextCursor: total > 10 ? '10' : null });
    await loading;
    expect(activity.getUserCounterOverrides('work-profile')).toMatchObject({
      notifications: 16, menuCounters: { campaignsPublished: 3, campaignsDrafts: total, campaignsTrash: 4 }
    });
  });

  it.each<CampaignFilters>([
    { scope: 'all', status: 'published' }, { scope: 'discover', status: 'published' },
    { scope: 'own', status: 'draft', category: 'technology' },
    { scope: 'own', status: 'draft', kind: 'work' },
    { scope: 'own', status: 'draft', search: 'subset' }
  ])('does not replace a whole bucket with a filtered or other-owner total: %j', async filters => {
    const { activity, page, resolve } = setup();
    const loading = page(filters); resolve({ items: [], total: 0, nextCursor: null }); await loading;
    expect(activity.getUserCounterOverrides('work-profile').menuCounters).toEqual({
      campaignsPublished: 3, campaignsDrafts: 2, campaignsTrash: 4
    });
  });

  it('does not overwrite a newer committed mutation with an older list response', async () => {
    const { activity, page, resolve } = setup();
    const loading = page();
    activity.patchUserCounterOverrides('work-profile', { menuCounters: { campaignsDrafts: 5 } });
    resolve({ items: [], total: 2, nextCursor: null }); await loading;
    expect(activity.getUserCounterOverrides('work-profile').menuCounters?.['campaignsDrafts']).toBe(5);
  });

  it('retains counters on request failure', async () => {
    const { activity, page, reject } = setup();
    const loading = page(); reject(new Error('Unavailable'));
    await expect(loading).rejects.toThrow('Unavailable');
    expect(activity.getUserCounterOverrides('work-profile').menuCounters?.['campaignsDrafts']).toBe(2);
  });

  it.each(['close', 'abort'])('ignores a response after %s', async action => {
    const { activity, host, page, resolve } = setup();
    const controller = new AbortController(); const loading = page(undefined, controller.signal);
    if (action === 'close') host.session.set(null); else controller.abort();
    resolve({ items: [], total: 0, nextCursor: null }); await expect(loading).rejects.toThrow();
    expect(activity.getUserCounterOverrides('work-profile').menuCounters?.['campaignsDrafts']).toBe(2);
  });
});
