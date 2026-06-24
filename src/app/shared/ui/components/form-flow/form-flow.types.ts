import type {
  AppMenuItem,
  AppMenuItemSelectEvent,
  AppMenuKind,
  AppMenuLayout,
  AppMenuModel,
  AppMenuPanelMode,
  AppMenuTrigger
} from '../menu';
import type { ImageCardData, InfoCardData } from '../card';

export interface FormFlowDraft<TData> {
  version: 1;
  userId: string;
  currentStepId: string;
  updatedAtIso: string;
  completedStepIds: string[];
  skippedStepIds: string[];
  data: TData;
}

export type FormFlowControlKind =
  | 'date'
  | 'image-carousel'
  | 'menu'
  | 'number'
  | 'review'
  | 'section'
  | 'static'
  | 'text'
  | 'textarea';

export interface FormFlowHeaderModel {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  icon?: string;
  palette?: string;
  imageCard?: ImageCardData | null;
  infoCard?: InfoCardData | null;
}

export interface FormFlowMenuControlConfig {
  kind?: AppMenuKind;
  layout?: AppMenuLayout;
  panelMode?: AppMenuPanelMode;
  title?: string;
  filterable?: boolean;
  closeOnSelect?: boolean;
  trigger?: AppMenuTrigger | null;
  model?: AppMenuModel<string, unknown> | null;
  items?: readonly AppMenuItem<string, unknown>[];
}

export interface FormFlowImageCarouselControlConfig {
  slotCount?: number;
  compact?: boolean;
  previewMode?: boolean;
  ariaLabel?: string;
  uploadOwnerId?: string;
  uploadEntityId?: string;
}

export interface FormFlowDateMetaConfig {
  label?: string;
  emptyLabel?: string;
  value?: (formValue: unknown, control: FormFlowControlModel) => unknown;
}

export interface FormFlowDateControlConfig {
  meta?: FormFlowDateMetaConfig | null;
}

export interface FormFlowControlSummaryConfig {
  hidden?: boolean;
  label?: string;
  emptyLabel?: string;
  value?: (formValue: unknown, control: FormFlowControlModel) => unknown;
}

export interface FormFlowControlModel {
  id: string;
  bind?: string | readonly (string | number)[];
  kind: FormFlowControlKind;
  layout?: 'default' | 'half' | 'wide';
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
  rows?: number;
  maxLength?: number;
  valueFormat?: 'csv';
  config?: FormFlowMenuControlConfig | FormFlowImageCarouselControlConfig | FormFlowDateControlConfig | null;
  accessory?: { menu?: FormFlowMenuControlConfig | null } | null;
  summary?: FormFlowControlSummaryConfig | null;
}

export interface FormFlowStepModel {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  palette?: string;
  header?: FormFlowHeaderModel | null;
  controls: readonly FormFlowControlModel[];
}

export interface FormFlowSummaryModel {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  icon?: string;
  emptyLabel?: string;
  includeEmpty?: boolean;
}

export interface FormFlowSaveModel {
  label?: string;
  ariaLabel?: string;
  icon?: string;
  disabled?: boolean;
}

export interface FormFlowModel {
  title: string;
  subtitle?: string;
  layout?: 'default' | 'carousel' | 'grouped';
  header?: boolean;
  steps: readonly FormFlowStepModel[];
  summary?: FormFlowSummaryModel | null;
  save?: FormFlowSaveModel | null;
  loadingLabel?: string;
}

export interface FormFlowSaveEvent {
  value: unknown;
  stepId: string;
  stepIndex: number;
  sourceEvent?: Event;
}

export interface FormFlowActionEvent {
  control: FormFlowControlModel;
  value: unknown;
  context?: unknown;
  sourceEvent: AppMenuItemSelectEvent<string, unknown>;
}
