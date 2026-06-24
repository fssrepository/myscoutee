import type { FormFlowControlModel, FormFlowModel } from './form-flow.types';

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

function formFlowHasRequiredValue(value: unknown, control?: FormFlowControlModel): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    const requiredCount = Math.max(1, Math.trunc(Number(control?.min) || 1));
    return value.filter(item => formFlowHasRequiredValue(item)).length >= requiredCount;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
