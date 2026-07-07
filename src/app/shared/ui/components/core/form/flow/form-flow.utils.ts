import type {
  FormFlowCompletionItemConfig,
  FormFlowControlModel,
  FormFlowModel
} from './form-flow.types';

export interface FormFlowCompletionStats {
  completed: number;
  total: number;
  percent: number;
}

export function formFlowCompletionPercent(model: FormFlowModel | null | undefined, value: unknown): number {
  return formFlowCompletionStats(model, value).percent;
}

export function formFlowCompletionStats(
  model: FormFlowModel | null | undefined,
  value: unknown
): FormFlowCompletionStats {
  const items = formFlowCompletionItems(model);
  const stats = items.reduce(
    (total, item) => {
      const itemStats = formFlowCompletionItemStats(item, value);
      return {
        completed: total.completed + itemStats.completed,
        total: total.total + itemStats.total
      };
    },
    { completed: 0, total: 0 }
  );
  return {
    ...stats,
    percent: stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100)
  };
}

export function formFlowMissingRequiredControlIds(model: FormFlowModel | null | undefined, value: unknown): string[] {
  return formFlowMissingRequiredControls(model, value).map(control => control.id);
}

export function formFlowMissingRequiredControls(
  model: FormFlowModel | null | undefined,
  value: unknown
): FormFlowControlModel[] {
  return (model?.steps ?? [])
    .flatMap(step => step.controls)
    .filter(control => formFlowIsControlMissingRequired(control, value));
}

export function formFlowIsControlMissingRequired(control: FormFlowControlModel, value: unknown): boolean {
  const path = formFlowNormalizePath(control.bind);
  return control.required === true
    && path.length > 0
    && !formFlowHasRequiredValue(formFlowControlValue(value, control), control);
}

function formFlowControlValue(value: unknown, control: FormFlowControlModel): unknown {
  const rawValue = formFlowReadPath(value, control.bind);
  return control.valueFormat === 'csv' ? formFlowCsvStringArrayValue(rawValue) : rawValue;
}

function formFlowCompletionItems(model: FormFlowModel | null | undefined): FormFlowCompletionItemConfig[] {
  const configuredItems = [...(model?.completion?.items ?? [])];
  const controlsMode = model?.completion?.controls ?? (configuredItems.length > 0 ? 'none' : 'all');
  if (controlsMode === 'none') {
    return configuredItems;
  }
  const controlItems = (model?.steps ?? [])
    .flatMap(step => step.controls)
    .filter(control => {
      if (control.kind === 'section' || control.kind === 'static' || control.kind === 'review') {
        return false;
      }
      if (formFlowNormalizePath(control.bind).length === 0) {
        return false;
      }
      return controlsMode === 'all' || control.required === true;
    })
    .map(control => formFlowCompletionItemFromControl(control));
  return [...configuredItems, ...controlItems];
}

function formFlowCompletionItemFromControl(control: FormFlowControlModel): FormFlowCompletionItemConfig {
  if (control.kind === 'image-carousel') {
    const slotCount = formFlowImageSlotCount(control);
    return {
      id: control.id,
      bind: control.bind,
      metric: 'count',
      thresholds: Array.from({ length: slotCount }, (_value, index) => index + 1)
    };
  }
  return {
    id: control.id,
    bind: control.bind,
    valueFormat: control.valueFormat,
    metric: 'filled'
  };
}

function formFlowCompletionItemStats(
  item: FormFlowCompletionItemConfig,
  value: unknown
): { completed: number; total: number } {
  const itemValue = item.valueFormat === 'csv'
    ? formFlowCsvStringArrayValue(formFlowReadPath(value, item.bind))
    : formFlowReadPath(value, item.bind);
  const metricValue = formFlowCompletionMetricValue(item, itemValue);
  const thresholds = (item.thresholds ?? [])
    .map(threshold => Number(threshold))
    .filter(threshold => Number.isFinite(threshold) && threshold > 0)
    .sort((left, right) => left - right);
  if (thresholds.length > 0) {
    return {
      completed: thresholds.filter(threshold => metricValue >= threshold).length,
      total: thresholds.length
    };
  }
  const weight = Math.max(1, Math.trunc(Number(item.weight) || 1));
  return {
    completed: metricValue > 0 ? weight : 0,
    total: weight
  };
}

function formFlowCompletionMetricValue(item: FormFlowCompletionItemConfig, value: unknown): number {
  switch (item.metric ?? 'filled') {
    case 'count':
      return formFlowCountValue(value);
    case 'length':
      return `${value ?? ''}`.trim().length;
    case 'positiveNumber':
      return formFlowPositiveNumber(value) > 0 ? 1 : 0;
    case 'isoDate':
      return formFlowIsIsoDate(value) ? 1 : 0;
    default:
      return formFlowHasRequiredValue(value) ? 1 : 0;
  }
}

function formFlowHasRequiredValue(value: unknown, control?: FormFlowControlModel): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    if (control?.kind === 'number') {
      const parsed = Number(value.trim());
      if (!Number.isFinite(parsed)) {
        return false;
      }
      return formFlowNumberInRange(parsed, control);
    }
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return false;
    }
    return formFlowNumberInRange(value, control);
  }
  if (typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    const requiredCount = Math.max(1, Math.trunc(Number(control?.min) || 1));
    return value.filter(item => formFlowHasRequiredValue(item)).length >= requiredCount;
  }
  if (isRecord(value)) {
    if ('startAt' in value || 'endAt' in value) {
      return `${value['startAt'] ?? ''}`.trim().length > 0
        && `${value['endAt'] ?? ''}`.trim().length > 0;
    }
    return Object.keys(value).length > 0;
  }
  return true;
}

function formFlowNumberInRange(value: number, control?: FormFlowControlModel): boolean {
  const min = typeof control?.min === 'number' ? control.min : null;
  const max = typeof control?.max === 'number' ? control.max : null;
  return (min === null || value >= min) && (max === null || value <= max);
}

function formFlowReadPath(source: unknown, path: FormFlowControlModel['bind']): unknown {
  const segments = formFlowNormalizePath(path);
  if (segments.length === 0) {
    return source;
  }
  let current = source;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current) && typeof segment === 'number') {
      current = current[segment];
      continue;
    }
    if (isRecord(current)) {
      current = current[String(segment)];
      continue;
    }
    return undefined;
  }
  return current;
}

function formFlowNormalizePath(path: FormFlowControlModel['bind']): Array<string | number> {
  if (!path) {
    return [];
  }
  if (typeof path !== 'string') {
    return path.map(segment => typeof segment === 'number' ? segment : `${segment}`.trim()).filter(segment => segment !== '');
  }
  return path
    .replace(/\[(\d+)]/g, '.$1')
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean)
    .map(segment => /^\d+$/.test(segment) ? Number(segment) : segment);
}

function formFlowCsvStringArrayValue(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.map(item => `${item ?? ''}`.trim()).filter(Boolean);
  }
  return `${value ?? ''}`
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function formFlowCountValue(value: unknown): number {
  if (Array.isArray(value)) {
    return value.filter(item => formFlowHasRequiredValue(item)).length;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0 ? 1 : 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length;
  }
  return formFlowHasRequiredValue(value) ? 1 : 0;
}

function formFlowPositiveNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number.parseFloat(`${value ?? ''}`.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function formFlowIsIsoDate(value: unknown): boolean {
  const normalized = `${value ?? ''}`.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    && Number.isFinite(Date.parse(`${normalized}T00:00:00Z`));
}

function formFlowImageSlotCount(control: FormFlowControlModel): number {
  const config = control.config;
  if (isRecord(config)) {
    const slotCount = Math.trunc(Number(config['slotCount']));
    if (Number.isFinite(slotCount) && slotCount > 0) {
      return slotCount;
    }
  }
  return Math.max(1, Math.trunc(Number(control.max) || Number(control.min) || 1));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
