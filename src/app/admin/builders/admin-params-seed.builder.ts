import type {
  AdminSeedParamFieldDto,
  AdminSeedParamOptionDto,
  AdminSeedParamsHistoryItemDto,
  AdminSeedParamsSectionDto,
  AdminSeedParamsStore
} from './admin-seed.models';

export class AdminParamsSeedBuilder {
  static buildDefaultParamsStore(): AdminSeedParamsStore {
    const changedDate = '2026-05-01T09:00:00.000Z';
    const sections: AdminSeedParamsSectionDto[] = [
      this.paramSection('matching', 'Matching', 3, '2026-05-07T12:30:00.000Z', 'admin-demo-ava', 'Raised inside-network confidence after graph review.', [
        this.numberParam('rating.singleMutual', 'Single mutual', 'Ratings', 10, 'x'),
        this.numberParam('rating.singleOneSided', 'Single one-sided', 'Ratings', 2, 'x'),
        this.numberParam('rating.pairOutsideNetwork', 'Pair outside network', 'Ratings', 2, 'x'),
        this.numberParam('rating.pairInsideNetwork', 'Pair inside network', 'Ratings', 5, 'x'),
        this.numberParam('evidence.mutualSingle', 'Mutual single', 'Evidence', 1, 'x'),
        this.numberParam('evidence.singleOneSided', 'Single one-sided', 'Evidence', 0, 'x'),
        this.numberParam('evidence.pairOutsideNetwork', 'Pair outside network', 'Evidence', 0.3, 'x'),
        this.numberParam('evidence.pairInsideNetwork', 'Pair inside network', 'Evidence', 0.7, 'x'),
        this.numberParam('evidence.met', 'Met in person', 'Evidence', 0.5, 'x'),
        this.numberParam('ownerContext', 'Owner context', 'Network', 3, 'x')
      ]),
      this.paramSection('profile', 'Profile', 2, '2026-05-04T10:10:00.000Z', 'admin-demo-noel', 'Balanced profile, workplace, school, and trait inputs.', [
        this.numberParam('profileRules.0', 'Languages', 'Profile fields', 2, 'x', 'intersection'),
        this.numberParam('profileRules.1', 'Physique', 'Profile fields', 3, 'x', 'exact'),
        this.numberParam('profileRules.2', 'Interest', 'Profile fields', 2, 'x', 'intersection'),
        this.numberParam('profileRules.3', 'Values', 'Profile fields', 3, 'x', 'intersection'),
        this.numberParam('profileRules.4', 'Workout', 'Profile fields', 2, 'x', 'exact'),
        this.numberParam('profileRules.5', 'Workplace', 'Experience', 4, 'x', 'intersection'),
        this.numberParam('profileRules.6', 'Profession', 'Experience', 3, 'x', 'intersection'),
        this.numberParam('profileRules.7', 'School', 'Experience', 4, 'x', 'intersection'),
        this.numberParam('impressionRules.0', 'Personality traits', 'Traits', 4, 'x', 'trait-vector'),
        this.numberParam('absolute.user.completion', 'Completion', 'Absolute user', 13, 'pts'),
        this.numberParam('absolute.user.impressionAverageRating', 'Average rating', 'Impressions', 29, 'pts')
      ]),
      this.paramSection('events', 'Events', 4, '2026-05-08T15:45:00.000Z', 'admin-demo-ava', 'Adjusted host confidence and open-capacity boost.', [
        this.numberParam('absolute.event.contentTokens', 'Content tokens', 'Affinity', 89, 'pts'),
        this.numberParam('absolute.event.participantAffinity', 'Participant affinity', 'Affinity', 1, 'x'),
        this.numberParam('boost.event.rating', 'Rating', 'Boost', 29, 'pts'),
        this.numberParam('boost.event.acceptedMembers', 'Accepted members', 'Boost', 19, 'pts'),
        this.numberParam('boost.event.pendingMembers', 'Pending members', 'Boost', 11, 'pts'),
        this.numberParam('boost.event.capacityAvailable', 'Capacity available', 'Boost', 7, 'pts'),
        this.numberParam('boost.event.hostConfidence', 'Host confidence', 'Boost', 0.25, 'x')
      ]),
      this.paramSection('assets', 'Assets', 2, '2026-05-06T08:15:00.000Z', 'admin-demo-noel', 'Added owner confidence and request pressure to asset ranking.', [
        this.numberParam('absolute.asset.contentTokens', 'Content tokens', 'Affinity', 83, 'pts'),
        this.numberParam('absolute.asset.ownerAffinity', 'Owner affinity', 'Affinity', 1, 'x'),
        this.numberParam('boost.asset.capacityAvailable', 'Capacity available', 'Boost', 7, 'pts'),
        this.numberParam('boost.asset.quantity', 'Quantity', 'Boost', 11, 'pts'),
        this.numberParam('boost.asset.requestCount', 'Request count', 'Boost', 13, 'pts'),
        this.numberParam('boost.asset.freshness', 'Freshness', 'Boost', 3, 'pts'),
        this.numberParam('boost.asset.ownerConfidence', 'Owner confidence', 'Boost', 0.25, 'x')
      ]),
      this.paramSection('discovery', 'Discovery', 1, changedDate, 'system', 'Initial outside-network and distance balance.', [
        this.numberParam('distance.multiplier', 'Distance multiplier', 'Distance', 5, 'pts'),
        this.numberParam('distance.maxMeters', 'Max distance', 'Distance', 50000, 'm'),
        this.textParam('distance.strategy', 'Distance strategy', 'Distance', 'linear', 'linear')
      ]),
      this.paramSection('notifications', 'Notifications', 1, changedDate, 'system', 'Initial Firebase batching and retry defaults.', [
        this.numberParam('notifications.firebaseWindowStartHour', 'Window start', 'Firebase', 8, 'h'),
        this.numberParam('notifications.firebaseWindowEndHour', 'Window end', 'Firebase', 22, 'h'),
        this.numberParam('notifications.maxWorkers', 'Max workers', 'Delivery', 4, ''),
        this.numberParam('notifications.maxRetries', 'Max retries', 'Retry', 5, ''),
        this.numberParam('notifications.initialBackoffSeconds', 'Initial backoff', 'Retry', 30, 's'),
        this.numberParam('notifications.collapseWindowSeconds', 'Collapse window', 'Collapse', 300, 's'),
        this.numberParam('notifications.multicastThreshold', 'Multicast threshold', 'Delivery', 3, ''),
        this.numberParam('notifications.topicThreshold', 'Topic threshold', 'Delivery', 250, '')
      ]),
      this.paramSection('jobs', 'Jobs', 1, changedDate, 'system', 'Initial recompute worker scheduling defaults.', [
        this.numberParam('jobs.userChangedDebounceSeconds', 'User debounce', 'Debounce', 300, 's'),
        this.numberParam('jobs.eventChangedDebounceSeconds', 'Event debounce', 'Debounce', 180, 's'),
        this.numberParam('jobs.eventMembersChangedDebounceSeconds', 'Members debounce', 'Debounce', 300, 's'),
        this.numberParam('jobs.assetChangedDebounceSeconds', 'Asset debounce', 'Debounce', 180, 's'),
        this.numberParam('jobs.assetRequestsChangedDebounceSeconds', 'Requests debounce', 'Debounce', 180, 's'),
        this.numberParam('jobs.configChangedDebounceSeconds', 'Config debounce', 'Debounce', 900, 's'),
        this.numberParam('jobs.workerPollDelayMs', 'Worker poll delay', 'Worker', 60000, 'ms'),
        this.numberParam('jobs.batchSize', 'Batch size', 'Worker', 50, ''),
        this.numberParam('jobs.leaseDurationSeconds', 'Lease duration', 'Worker', 600, 's'),
        this.numberParam('jobs.process.eventSchedulerPollDelayMs', 'Event scheduler poll', 'Processes', 1800000, 'ms'),
        this.numberParam('jobs.process.autoInviterCadenceMs', 'Auto-inviter cadence', 'Processes', 7200000, 'ms'),
        this.numberParam('jobs.process.notificationOutboxPollDelayMs', 'Notification outbox poll', 'Processes', 60000, 'ms'),
        this.numberParam('jobs.process.accountPurgeWindowDays', 'Account purge window', 'Processes', 30, 'd'),
        this.textParam('jobs.policy.autoInviterScope', 'Auto-inviter scope', 'Policy', 'Main event before tournament start', '', true),
        this.textParam('jobs.policy.tournamentStart', 'Tournament start', 'Policy', 'Manual admin start from first stage', '', true),
        this.textParam('jobs.policy.stageProgression', 'Stage progression', 'Policy', 'Admin finalizes scores before next stage', '', true)
      ])
    ];
    const historyBySection = sections.reduce<Record<string, AdminSeedParamsHistoryItemDto[]>>((acc, section) => {
      acc[section.key] = [
        {
          configId: `demo-params-${section.key}-v${section.version}`,
          version: section.version,
          changedDate: section.changedDate,
          changedBy: section.changedBy,
          summary: section.summary,
          summaryKey: section.summaryKey,
          active: true,
          fields: section.fields.map(field => ({ ...field }))
        },
        {
          configId: `demo-params-${section.key}-v1`,
          version: 1,
          changedDate,
          changedBy: 'system',
          summary: 'Initial parameter seed.',
          summaryKey: this.paramSummaryKey('Initial parameter seed.', section.key),
          active: section.version === 1,
          fields: section.fields.map(field => ({ ...field }))
        }
      ].filter((item, index, values) => values.findIndex(candidate => candidate.version === item.version) === index);
      return acc;
    }, {});
    return {
      sections,
      updatedDate: '2026-05-08T15:45:00.000Z',
      historyBySection
    };
  }

  private static paramSection(
    key: string,
    label: string,
    version: number,
    changedDate: string,
    changedBy: string,
    summary: string,
    fields: AdminSeedParamFieldDto[]
  ): AdminSeedParamsSectionDto {
    return {
      key,
      label,
      labelKey: this.paramSectionLabelKey(key),
      version,
      changedDate,
      changedBy,
      summary,
      summaryKey: this.paramSummaryKey(summary, key),
      fields
    };
  }

  private static numberParam(
    key: string,
    label: string,
    group: string,
    numberValue: number,
    unit: string,
    strategy = '',
    readOnly = false
  ): AdminSeedParamFieldDto {
    return {
      key,
      label,
      labelKey: this.paramFieldLabelKey(key),
      group,
      groupKey: this.paramGroupLabelKey(group),
      valueType: 'number',
      numberValue,
      textValue: null,
      unit,
      options: [],
      strategy,
      strategyKey: this.paramStrategyLabelKey(strategy),
      readOnly
    };
  }

  private static textParam(
    key: string,
    label: string,
    group: string,
    textValue: string,
    strategy = '',
    readOnly = false
  ): AdminSeedParamFieldDto {
    return {
      key,
      label,
      labelKey: this.paramFieldLabelKey(key),
      group,
      groupKey: this.paramGroupLabelKey(group),
      valueType: 'text',
      numberValue: null,
      textValue,
      unit: null,
      options: this.paramOptionsFor(key),
      strategy,
      strategyKey: this.paramStrategyLabelKey(strategy),
      readOnly
    };
  }

  private static paramSectionLabelKey(sectionKey: string | null | undefined): string {
    const normalized = `${sectionKey ?? ''}`.trim();
    return normalized ? `admin.params.section.${normalized}` : 'admin.params.platform';
  }

  private static paramFieldLabelKey(fieldKey: string | null | undefined): string {
    const normalized = `${fieldKey ?? ''}`.trim();
    return normalized ? `admin.params.field.${normalized}` : '';
  }

  private static paramGroupLabelKey(group: string | null | undefined): string {
    const normalized = this.paramsI18nSegment(group);
    return normalized ? `admin.params.group.${normalized}` : 'admin.params.group.general';
  }

  private static paramStrategyLabelKey(strategy: string | null | undefined): string {
    const normalized = `${strategy ?? ''}`.trim();
    return normalized ? `admin.params.strategy.${normalized}` : '';
  }

  private static paramOptionsFor(fieldKey: string | null | undefined): AdminSeedParamOptionDto[] {
    if (`${fieldKey ?? ''}`.trim() !== 'distance.strategy') {
      return [];
    }
    return ['linear', 'exponential', 'bucketed'].map(value => ({
      value,
      label: value.charAt(0).toUpperCase() + value.slice(1),
      labelKey: this.paramStrategyLabelKey(value)
    }));
  }

  private static paramSummaryKey(summary: string | null | undefined, sectionKey: string | null | undefined): string {
    const normalizedSummary = `${summary ?? ''}`.trim();
    const normalizedSection = `${sectionKey ?? ''}`.trim();
    if (!normalizedSummary || !normalizedSection) {
      return '';
    }
    if (/^Updated\s+.+?\s+parameters\.$/i.test(normalizedSummary)) {
      return `admin.params.summary.updated.${normalizedSection}`;
    }
    return '';
  }

  private static paramsI18nSegment(value: string | null | undefined): string {
    return `${value ?? ''}`
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
      .replace(/[^a-zA-Z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .toLocaleLowerCase('en-US');
  }
}
