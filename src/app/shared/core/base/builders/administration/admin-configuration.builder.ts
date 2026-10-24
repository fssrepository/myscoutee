import { AppUtils } from '../../app-utils';
import type { AdminParamFieldDto, AdminParamOptionDto, AdminParamValueType, AdminNotificationIntervalUnit } from '../../../contracts/administration/admin.interface';

export class AdminConfigurationBuilder {
  static fieldsByGroup(fields: readonly AdminParamFieldDto[]): { group: string; groupKey: string; fields: AdminParamFieldDto[] }[] {
    const groups = new Map<string, AdminParamFieldDto[]>();
    const groupKeys = new Map<string, string>();
    for (const field of fields) {
      const group = `${field.group ?? ''}`.trim() || 'General';
      if (!groupKeys.has(group)) {
        groupKeys.set(group, `${field.groupKey ?? ''}`.trim());
      }
      groups.set(group, [...(groups.get(group) ?? []), field]);
    }
    return [...groups.entries()].map(([group, groupFields]) => ({
      group,
      groupKey: groupKeys.get(group) ?? '',
      fields: groupFields
    }));
  }

  private static paramsI18nSegment(value: string | null | undefined): string {
    return AppUtils.trimCharacters(`${value ?? ''}`
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
      .replace(/[^a-zA-Z0-9]+/g, '.'), ".")
      .toLocaleLowerCase('en-US');
  }

  static fixedNotificationIntervalUnit(seconds: number, intervals: Readonly<Record<AdminNotificationIntervalUnit, number>>): AdminNotificationIntervalUnit {
    const value = Math.max(1, Math.trunc(Number(seconds) || 1));
    return (['years', 'months', 'weeks', 'days', 'hours', 'minutes'] as const).find(unit => value % intervals[unit] === 0) ?? 'seconds';
  }

  static normalizeParamField(field: AdminParamFieldDto): AdminParamFieldDto {
    const valueType: AdminParamValueType = field.valueType === 'text' ? 'text' : 'number';
    const numberValue = valueType === 'number'
      ? (Number.isFinite(Number(field.numberValue)) ? Number(field.numberValue) : 0)
      : null;
    return {
      key: `${field.key ?? ''}`.trim(),
      label: `${field.label ?? ''}`.trim() || `${field.key ?? ''}`.trim(),
      labelKey: `${field.labelKey ?? ''}`.trim() || this.paramFieldLabelKey(field.key),
      group: `${field.group ?? ''}`.trim() || 'General',
      groupKey: `${field.groupKey ?? ''}`.trim() || this.paramGroupLabelKey(field.group),
      valueType,
      numberValue,
      textValue: valueType === 'text' ? `${field.textValue ?? ''}`.trim() : null,
      unit: `${field.unit ?? ''}`.trim(),
      options: (field.options ?? []).map(option => this.normalizeParamOption(option)),
      strategy: `${field.strategy ?? ''}`.trim(),
      strategyKey: `${field.strategyKey ?? ''}`.trim() || this.paramStrategyLabelKey(field.strategy),
      readOnly: field.readOnly === true
    };
  }

  static normalizeParamOption(option: AdminParamOptionDto): AdminParamOptionDto {
    const value = `${option.value ?? ''}`.trim();
    return {
      value,
      label: `${option.label ?? ''}`.trim() || value,
      labelKey: `${option.labelKey ?? ''}`.trim() || this.paramStrategyLabelKey(value)
    };
  }

  static paramStrategyLabelKey(strategy: string | null | undefined): string {
    const normalized = `${strategy ?? ''}`.trim();
    return normalized ? `admin.params.strategy.${normalized}` : '';
  }

  static paramGroupLabelKey(group: string | null | undefined): string {
    const normalized = this.paramsI18nSegment(group);
    return normalized ? `admin.params.group.${normalized}` : 'admin.params.group.general';
  }

  static paramFieldLabelKey(fieldKey: string | null | undefined): string {
    const normalized = `${fieldKey ?? ''}`.trim();
    return normalized ? `admin.params.field.${normalized}` : '';
  }

  static paramSectionLabelKey(sectionKey: string | null | undefined): string {
    const normalized = `${sectionKey ?? ''}`.trim();
    return normalized ? `admin.params.section.${normalized}` : 'admin.params.platform';
  }
}
