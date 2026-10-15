import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { CommunityCasesStore } from './community-cases.store';

describe('Case read errors', () => {
  function setup() {
    const store = Object.assign(Object.create(CommunityCasesStore.prototype), {
      session: signal({ userId: 'actor', list: false, tasks: false }),
      board: signal(null), quotations: signal(null), quotationFocus: signal(null),
      busy: signal(false), error: signal(''), generation: 0,
      service: { read: vi.fn() }, publish: vi.fn(), open: vi.fn().mockResolvedValue(undefined)
    });
    return store;
  }

  it.each(['reference', 'board', 'quotations'])('identifies a failed %s read as loading, not saving', async surface => {
    const store = setup();
    store.service.read.mockRejectedValue({ status: 503 });
    if (surface === 'reference') await store.openReference('case', false);
    else if (surface === 'board') await store.view({ id: 'case' });
    else await store.openQuotations({ id: 'case' });
    expect(store.error()).toBe('case.load.failed');
    expect(store.busy()).toBe(false);
    expect(store.publish).not.toHaveBeenCalled();
  });

  it.each([{ status: 403 }, { status: 404 }, new Error('Case not found'), new Error('Forbidden')])(
    'uses the same unavailable state for HTTP and local access failures: %s', async error => {
      const store = setup();
      store.service.read.mockRejectedValue(error);
      await store.openReference('case', false);
      expect(store.error()).toBe('case.load.unavailable');
      expect(store.board()).toBeNull();
    }
  );

  it('clears a failed read when the user opens it successfully again, using one read', async () => {
    const store = setup();
    store.error.set('case.load.failed');
    const detail = { id: 'case', boardTasks: [] };
    store.service.read.mockResolvedValue(detail);
    await store.openReference('case', false);
    expect(store.service.read).toHaveBeenCalledExactlyOnceWith('actor', 'case');
    expect(store.error()).toBe('');
    expect(store.board()).toBe(detail);
  });

  it('ignores a failed request after its session was closed', async () => {
    const store = setup();
    let fail!: (error: unknown) => void;
    store.service.read.mockReturnValue(new Promise((_, reject) => { fail = reject; }));
    const read = store.view({ id: 'case' });
    store.generation++;
    fail({ status: 503 });
    await read;
    expect(store.error()).toBe('');
  });

  it.each([[403, 'case.save.forbidden'], [409, 'case.changed'], [503, 'case.save.failed']])(
    'preserves mutation error semantics for status %s', async (status, message) => {
      const store = setup();
      await store.mutate(async () => { throw { status }; });
      expect(store.error()).toBe(message);
    }
  );
});
