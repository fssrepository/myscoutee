import type {
  AppMenuItem,
  AppMenuKind,
  AppMenuLayout,
  AppMenuModel,
  AppMenuPanelMode,
  AppMenuTrigger
} from '../menu';
import type { ImageCardData, InfoCardData } from '../card';

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

export type FormFlowPathSegment = string | number;
export type FormFlowPath = string | readonly FormFlowPathSegment[];

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

export interface FormFlowControlSummaryConfig {
  hidden?: boolean;
  label?: string;
  emptyLabel?: string;
  value?: (formValue: unknown, control: FormFlowControlModel) => unknown;
}

export interface FormFlowControlModel {
  id: string;
  bind?: FormFlowPath;
  kind: FormFlowControlKind;
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
  config?: FormFlowMenuControlConfig | FormFlowImageCarouselControlConfig | null;
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
  layout?: 'default' | 'carousel';
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
