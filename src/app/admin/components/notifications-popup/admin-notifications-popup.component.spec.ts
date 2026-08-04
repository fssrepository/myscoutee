import { signal, type WritableSignal } from '@angular/core';

import type {
  AdminNotificationCenterState,
  AdminNotificationRule
} from '../../../shared/core';
import type { ListQuery, PageResult } from '../../../shared/core/contracts/list.interface';
import { AdminNotificationsSeedBuilder } from '../../../shared/core/local/seed/builders/admin/admin-notifications-seed.builder';
import type {
  SmartListComponent,
  SmartListStateChange
} from '../../../shared/ui/components/core/smart-list';
import { AdminNotificationsPopupComponent } from './admin-notifications-popup.component';

type ProcessListFilter = 'all' | 'active' | 'suspended' | 'running' | 'failed';

interface ProcessListFilters {
  filter: ProcessListFilter;
}

interface NotificationServiceStub {
  loadNotificationCenter: ReturnType<typeof vi.fn>;
}

interface TestSubject {
  state: WritableSignal<AdminNotificationCenterState | null>;
  error: WritableSignal<string>;
  detailOpen: WritableSignal<boolean>;
  selectedRuleKey: WritableSignal<string>;
  detailRule: WritableSignal<AdminNotificationRule | null>;
  timingDirtyKeys: WritableSignal<ReadonlySet<string>>;
  parameterDirtyKeys: WritableSignal<ReadonlySet<string>>;
  processFilter: WritableSignal<ProcessListFilter>;
  processListLoadedOnce: boolean;
  processBaselinesCaptured: boolean;
  latestProcessCenterState: AdminNotificationCenterState | null;
  timingBaselineSignatures: Map<string, string>;
  parameterBaselineSignatures: Map<string, string>;
  processSmartList?: Pick<SmartListComponent<AdminNotificationRule, ProcessListFilters>, 'patchVisibleItem'>;
  userProfileStore: { activeUserId: () => string };
  notificationsService: NotificationServiceStub;
  loadProcessListPage: (
    query: ListQuery<ProcessListFilters>,
    signal?: AbortSignal
  ) => Promise<PageResult<AdminNotificationRule>>;
  onProcessListStateChange: (
    change: SmartListStateChange<AdminNotificationRule, ProcessListFilters>
  ) => void;
  reconcileProcessListState: (
    rules: readonly AdminNotificationRule[],
    state: AdminNotificationCenterState
  ) => void;
  sameProcessRule: (current: AdminNotificationRule, next: AdminNotificationRule) => boolean;
  patchRule: (
    ruleKey: string,
    update: (rule: AdminNotificationRule) => AdminNotificationRule
  ) => void;
}

describe('AdminNotificationsPopupComponent SmartList refresh', () => {
  it('provides the SmartList loader with initial and background load semantics', async () => {
    const rule = scheduledRule();
    const state = centerState(rule);
    const subject = createSubject(null);
    subject.notificationsService.loadNotificationCenter.mockResolvedValue(clone(state));

    const initial = await subject.loadProcessListPage(listQuery('all'));
    const background = await subject.loadProcessListPage(listQuery('failed'));

    expect(subject.notificationsService.loadNotificationCenter).toHaveBeenNthCalledWith(1, 'admin-1', {
      skipDemoDelay: false,
      filter: 'all'
    });
    expect(subject.notificationsService.loadNotificationCenter).toHaveBeenNthCalledWith(2, 'admin-1', {
      skipDemoDelay: true,
      filter: 'failed'
    });
    expect(initial).toEqual({ items: expect.any(Array), total: 1, nextCursor: null });
    expect(background.total).toBe(1);
    expect(subject.latestProcessCenterState?.rules[0].ruleKey).toBe(rule.ruleKey);
  });

  it('recognizes an unchanged row so SmartList can preserve its reference', () => {
    const rule = scheduledRule();
    const subject = createSubject(centerState(rule));

    expect(subject.sameProcessRule(rule, clone(rule))).toBe(true);

    const changed = clone(rule);
    changed.runState.pendingCount += 1;
    expect(subject.sameProcessRule(rule, changed)).toBe(false);
  });

  it('commits only SmartList row deltas and preserves unchanged row references', () => {
    const [changedBefore, control] = scheduledRules(2);
    const state = centerState(changedBefore, control);
    const subject = createSubject(state);
    const changedAfter = clone(changedBefore);
    changedAfter.runState.pendingCount += 1;
    const incomingState = centerState(changedAfter, clone(control));
    subject.latestProcessCenterState = incomingState;

    subject.onProcessListStateChange(smartListState([changedAfter, control]));

    expect(subject.state()).not.toBe(state);
    expect(subject.state()?.rules[0]).toBe(changedAfter);
    expect(subject.state()?.rules[1]).toBe(control);
  });

  it('sends only the selected changed row to the Job Detail signal', () => {
    const [selectedBefore, control] = scheduledRules(2);
    const state = centerState(selectedBefore, control);
    const subject = createSubject(state);
    subject.detailOpen.set(true);
    subject.selectedRuleKey.set(selectedBefore.ruleKey);
    subject.detailRule.set(selectedBefore);
    const selectedAfter = clone(selectedBefore);
    selectedAfter.runState.progressPercent = 35;
    const incomingState = centerState(selectedAfter, clone(control));
    subject.latestProcessCenterState = incomingState;

    subject.onProcessListStateChange(smartListState([selectedAfter, control]));

    expect(subject.detailRule()).toBe(selectedAfter);
    expect(subject.detailRule()?.runState.progressPercent).toBe(35);
    expect(subject.state()?.rules[1]).toBe(control);
  });

  it('does not touch Job Detail when SmartList changes another row', () => {
    const [selected, controlBefore] = scheduledRules(2);
    const state = centerState(selected, controlBefore);
    const subject = createSubject(state);
    subject.detailOpen.set(true);
    subject.selectedRuleKey.set(selected.ruleKey);
    subject.detailRule.set(selected);
    const controlAfter = clone(controlBefore);
    controlAfter.runState.pendingCount += 1;
    const incomingState = centerState(clone(selected), controlAfter);
    subject.latestProcessCenterState = incomingState;

    subject.onProcessListStateChange(smartListState([selected, controlAfter]));

    expect(subject.detailRule()).toBe(selected);
    expect(subject.state()?.rules[0]).toBe(selected);
    expect(subject.state()?.rules[1]).toBe(controlAfter);
  });

  it('routes local runtime updates through SmartList patching', () => {
    const rule = scheduledRule();
    const state = centerState(rule);
    const subject = createSubject(state);
    const patchVisibleItem = vi.fn((
      predicate: (item: AdminNotificationRule, index: number) => boolean,
      patch: Partial<AdminNotificationRule> | ((item: AdminNotificationRule, index: number) => AdminNotificationRule)
    ) => {
      expect(predicate(rule, 0)).toBe(true);
      const updated = typeof patch === 'function' ? patch(rule, 0) : { ...rule, ...patch };
      subject.onProcessListStateChange(smartListState([updated]));
      return true;
    });
    subject.processSmartList = { patchVisibleItem };

    subject.patchRule(rule.ruleKey, current => ({
      ...current,
      runState: { ...current.runState, progressPercent: 42 }
    }));

    expect(patchVisibleItem).toHaveBeenCalledOnce();
    expect(subject.state()?.rules[0].runState.progressPercent).toBe(42);
  });
});

function createSubject(state: AdminNotificationCenterState | null): TestSubject {
  const subject = Object.create(AdminNotificationsPopupComponent.prototype) as TestSubject;
  subject.state = signal<AdminNotificationCenterState | null>(state);
  subject.error = signal('');
  subject.detailOpen = signal(false);
  subject.selectedRuleKey = signal('');
  subject.detailRule = signal<AdminNotificationRule | null>(null);
  subject.timingDirtyKeys = signal<ReadonlySet<string>>(new Set());
  subject.parameterDirtyKeys = signal<ReadonlySet<string>>(new Set());
  subject.processFilter = signal<ProcessListFilter>('all');
  subject.processListLoadedOnce = false;
  subject.processBaselinesCaptured = true;
  subject.latestProcessCenterState = state;
  subject.timingBaselineSignatures = new Map();
  subject.parameterBaselineSignatures = new Map();
  subject.userProfileStore = { activeUserId: () => 'admin-1' };
  subject.notificationsService = {
    loadNotificationCenter: vi.fn()
  };
  return subject;
}

function scheduledRule(): AdminNotificationRule {
  return scheduledRules(1)[0];
}

function scheduledRules(count: number): AdminNotificationRule[] {
  const rules = AdminNotificationsSeedBuilder.buildDefaultNotificationCenter().rules
    .filter(item => item.triggerKind === 'scheduled_process')
    .slice(0, count);
  if (rules.length !== count) {
    throw new Error(`The notification seed must contain ${count} scheduled processes.`);
  }
  return clone(rules);
}

function centerState(rule: AdminNotificationRule, ...additionalRules: AdminNotificationRule[]): AdminNotificationCenterState {
  const rules = [rule, ...additionalRules];
  return {
    rules,
    emailTemplates: [],
    filterCounts: {
      all: rules.length,
      active: rules.length,
      suspended: 0,
      running: 0,
      failed: 0
    },
    updatedDate: '2026-08-04T09:00:00.000Z'
  };
}

function listQuery(filter: ProcessListFilter): ListQuery<ProcessListFilters> {
  return {
    page: 0,
    pageSize: 100,
    sort: 'runtime',
    direction: 'asc',
    filters: { filter }
  };
}

function smartListState(
  items: readonly AdminNotificationRule[]
): SmartListStateChange<AdminNotificationRule, ProcessListFilters> {
  return {
    items,
    groups: [],
    query: listQuery('all'),
    total: items.length,
    currentView: 'list',
    hasMore: false,
    loading: false,
    initialLoading: false,
    progress: 1,
    loadingProgress: 1,
    loadingOverdue: false,
    scrollable: false,
    stickyLabel: '',
    cursorIndex: 0,
    cursorTotal: items.length,
    cursorProgress: items.length > 0 ? 1 / items.length : 0,
    cursorCanPrev: false,
    cursorCanNext: items.length > 1
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
