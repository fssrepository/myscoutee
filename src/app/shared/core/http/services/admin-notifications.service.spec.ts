import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { RouteDelayService } from '../../base/services/route-delay.service';
import { SessionService } from '../../base/services/session.service';
import type { AdminNotificationCenterState, AdminNotificationRule } from '../../contracts/admin.interface';
import { AdminNotificationsSeedBuilder } from '../../local/seed/builders/admin/admin-notifications-seed.builder';
import { HttpAdminNotificationsService } from './admin-notifications.service';

describe('HttpAdminNotificationsService', () => {
  const get = vi.fn();
  const post = vi.fn();
  const withRequestTimeout = vi.fn();

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    withRequestTimeout.mockReset().mockImplementation((_route: string, task: Promise<unknown>) => task);
    TestBed.configureTestingModule({
      providers: [
        HttpAdminNotificationsService,
        { provide: HttpClient, useValue: { get, post } },
        { provide: RouteDelayService, useValue: { withRequestTimeout } },
        { provide: SessionService, useValue: { authMode: 'local' } }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('asks the server for each selected process bucket', async () => {
    get.mockReturnValue(of(centerState([])));

    await TestBed.inject(HttpAdminNotificationsService).loadNotificationCenter(' admin-1 ', 'failed');

    expect(get).toHaveBeenCalledWith(
      expect.stringMatching(/\/admin\/notifications$/),
      {
        params: {
          adminUserId: 'admin-1',
          filter: 'failed'
        }
      }
    );
  });

  it('posts the complete rule contract and requests the same bucket after save', async () => {
    const rule = completeRule();
    post.mockReturnValue(of(centerState([rule])));

    await TestBed.inject(HttpAdminNotificationsService).saveNotificationCenter([rule], 'admin-1', 'suspended');

    expect(post).toHaveBeenCalledWith(
      expect.stringMatching(/\/admin\/notifications$/),
      {
        adminUserId: 'admin-1',
        rules: [rule]
      },
      {
        params: { filter: 'suspended' }
      }
    );
  });
});

function centerState(rules: AdminNotificationRule[]): AdminNotificationCenterState {
  return {
    rules,
    emailTemplates: [],
    filterCounts: {
      all: rules.length,
      active: 0,
      suspended: rules.length,
      running: 0,
      failed: 0
    },
    updatedDate: '2026-07-25T00:00:00.000Z'
  };
}

function completeRule(): AdminNotificationRule {
  const base = AdminNotificationsSeedBuilder.buildDefaultNotificationCenter().rules[0];
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
