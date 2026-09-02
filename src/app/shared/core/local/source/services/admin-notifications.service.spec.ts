import { TestBed } from '@angular/core/testing';

import { RouteDelayService } from '../../../base/services/route-delay.service';
import type { AdminNotificationCenterState, AdminNotificationRule } from '../../../contracts/admin.interface';
import { AdminNotificationsSeedBuilder } from '../../seed/builders/admin/admin-notifications-seed.builder';
import { LocalAdminNotificationsRepository } from '../repositories/admin-notifications.repository';
import { LocalAdminNotificationsService } from './admin-notifications.service';

describe('LocalAdminNotificationsService', () => {
  const whenReady = vi.fn();
  const readStore = vi.fn();
  const writeStore = vi.fn();
  const waitForRouteDelay = vi.fn();
  let stored: AdminNotificationCenterState;

  beforeEach(() => {
    stored = AdminNotificationsSeedBuilder.buildDefaultNotificationCenter();
    whenReady.mockReset().mockResolvedValue(undefined);
    readStore.mockReset().mockImplementation(async () => stored);
    writeStore.mockReset().mockImplementation(async (next: AdminNotificationCenterState) => {
      stored = next;
    });
    waitForRouteDelay.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        LocalAdminNotificationsService,
        {
          provide: LocalAdminNotificationsRepository,
          useValue: { whenReady, readStore, writeStore }
        },
        {
          provide: RouteDelayService,
          useValue: { waitForRouteDelay }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('returns local bucket results and counts through the same contract as HTTP', async () => {
    const state = await TestBed.inject(LocalAdminNotificationsService)
      .loadNotificationCenter({ filter: 'suspended', skipDemoDelay: true });

    expect(state.rules.map(rule => rule.ruleKey)).toEqual(['event-random-groups']);
    expect(state.filterCounts).toEqual({
      all: 9,
      active: 8,
      suspended: 1,
      running: 0,
      failed: 0
    });
  });

  it('merges a filtered save into the full store and reloads every nested value', async () => {
    const service = TestBed.inject(LocalAdminNotificationsService);
    const original = stored.rules.find(rule => rule.ruleKey === 'event-random-groups');
    expect(original).toBeDefined();
    const updated = completeRule(original!);

    const filtered = await service.saveNotificationCenter(
      [updated],
      'admin-1',
      { filter: 'suspended', skipDemoDelay: true }
    );
    const reloaded = await service.loadNotificationCenter({ filter: 'all', skipDemoDelay: true });

    expect(filtered.rules).toEqual([updated]);
    expect(reloaded.rules).toHaveLength(9);
    expect(reloaded.rules.find(rule => rule.ruleKey === updated.ruleKey)).toEqual(updated);
    expect(stored.rules).toHaveLength(9);
    expect(writeStore).toHaveBeenCalledOnce();
  });

  it('loads saved runtime state by rule key for polling fallback', async () => {
    const rule = stored.rules[0];
    rule.runState = {
      ...rule.runState,
      currentStatus: 'completed',
      progressPercent: 100,
      finishedAtIso: '2026-07-25T00:40:32.000Z',
      lastRunAtIso: '2026-07-25T00:40:32.000Z',
      lastRunStatus: 'completed'
    };

    const runtime = await TestBed.inject(LocalAdminNotificationsService)
      .loadNotificationRuleRuntime(rule.ruleKey);

    expect(runtime?.runState).toEqual({
      ...rule.runState,
      nextRunAtIso: '2026-07-26T00:40:32.000Z'
    });
  });

  it('projects the next interval run in the local service layer', async () => {
    const rule = stored.rules.find(item => item.ruleKey === 'event-random-groups')!;
    rule.enabled = true;
    rule.timing = {
      ...rule.timing,
      mode: 'interval',
      intervalAmount: 1,
      intervalUnit: 'minutes',
      intervalSeconds: 60,
      intervalMinutes: 1
    };
    rule.runState = {
      ...rule.runState,
      lastRunAtIso: '2026-09-02T06:49:51.458Z'
    };

    const runtime = await TestBed.inject(LocalAdminNotificationsService)
      .loadNotificationRuleRuntime(rule.ruleKey);

    expect(runtime?.runState.nextRunAtIso).toBe('2026-09-02T06:50:00.000Z');
  });
});

function completeRule(base: AdminNotificationRule): AdminNotificationRule {
  return {
    ...base,
    enabled: false,
    channels: {
      pushEnabled: true,
      emailEnabled: true,
      inAppEnabled: true,
      supportChatEnabled: true
    },
    timing: {
      mode: 'interval',
      delayMinutes: 7,
      intervalMinutes: 20160,
      intervalSeconds: 1209600,
      intervalAmount: 2,
      intervalUnit: 'weeks',
      month: 11,
      dayOfMonth: 23,
      time: '14:35',
      timezone: 'Europe/Bratislava',
      cronExpression: '@every 2 weeks @ 14:35'
    },
    scheduleSlots: [{
      id: 'slot-complete',
      frequency: 'bi-weekly',
      date: '2026-07-20',
      dayOfWeek: 4,
      time: '14:35',
      timezone: 'Europe/Bratislava',
      cronExpression: '0 35 14 ? * 5',
      actionKey: 'event.scheduler.random-groups',
      enabled: true
    }],
    parameters: [
      {
        key: 'jobs.process.randomGroups.minRoomSize',
        label: 'Min room size',
        labelKey: 'admin.params.field.jobs.process.randomGroups.minRoomSize',
        group: 'Matched rooms',
        groupKey: 'admin.params.group.matched.rooms',
        valueType: 'number',
        numberValue: 3.5,
        textValue: null,
        unit: 'users',
        options: [],
        strategy: 'balanced',
        strategyKey: 'admin.params.strategy.balanced',
        readOnly: false
      },
      {
        key: 'jobs.process.randomGroups.strategy',
        label: 'Strategy',
        labelKey: 'admin.params.field.jobs.process.randomGroups.strategy',
        group: 'Matched rooms',
        groupKey: 'admin.params.group.matched.rooms',
        valueType: 'text',
        numberValue: null,
        textValue: 'affinity',
        unit: '',
        options: [{
          value: 'affinity',
          label: 'Affinity',
          labelKey: 'admin.params.strategy.affinity'
        }],
        strategy: 'affinity',
        strategyKey: 'admin.params.strategy.affinity',
        readOnly: false
      }
    ],
    message: {
      pushTitle: 'Push title',
      pushBody: 'Push body',
      emailTemplateKey: 'job-complete',
      emailSubject: 'Email subject',
      emailBody: 'Email body',
      ctaPath: '/admin/jobs'
    }
  };
}
