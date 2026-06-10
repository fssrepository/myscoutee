export type AdminParamValueType = 'number' | 'text';

export interface AdminParamOptionDto {
  value: string;
  label: string;
  labelKey?: string | null;
}

export interface AdminParamFieldDto {
  key: string;
  label: string;
  labelKey?: string | null;
  group: string;
  groupKey?: string | null;
  valueType: AdminParamValueType;
  numberValue?: number | null;
  textValue?: string | null;
  unit?: string | null;
  options?: AdminParamOptionDto[] | null;
  strategy?: string | null;
  strategyKey?: string | null;
  readOnly?: boolean | null;
}

export interface AdminParamsSectionDto {
  key: string;
  label: string;
  labelKey?: string | null;
  version: number;
  changedDate: string;
  changedBy: string;
  summary: string;
  summaryKey?: string | null;
  fields: AdminParamFieldDto[];
}

export interface AdminParamsStateDto {
  sections: AdminParamsSectionDto[];
  updatedDate: string;
}

export interface AdminParamsHistoryItemDto {
  configId?: string | null;
  version: number;
  changedDate: string;
  changedBy: string;
  summary: string;
  summaryKey?: string | null;
  active: boolean;
  fields: AdminParamFieldDto[];
}

export interface AdminParamsHistoryDto {
  sectionKey: string;
  label: string;
  labelKey?: string | null;
  versions: AdminParamsHistoryItemDto[];
}

export interface AdminParamsDemoStore extends AdminParamsStateDto {
  historyBySection: Record<string, AdminParamsHistoryItemDto[]>;
}
