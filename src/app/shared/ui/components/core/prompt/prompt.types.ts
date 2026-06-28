export type PromptTone = 'default' | 'info' | 'success' | 'warning' | 'danger';
export type PromptPosition = 'top' | 'bottom';

export interface PromptImageIcon {
  kind: 'image';
  src: string;
  alt?: string | null;
}

export interface PromptMaterialIcon {
  kind?: 'material';
  name: string;
  ariaLabel?: string | null;
}

export type PromptIcon = string | PromptImageIcon | PromptMaterialIcon;

export interface PromptAction {
  label: string;
  busyLabel?: string | null;
  icon?: string | null;
  ariaLabel?: string | null;
  disabled?: boolean;
}

export interface PromptModel {
  visible?: boolean;
  title?: string | null;
  description?: string | null;
  ariaLabel?: string | null;
  icon?: PromptIcon | null;
  action?: PromptAction | null;
  busy?: boolean;
  dismissible?: boolean;
  closeAriaLabel?: string | null;
  tone?: PromptTone;
  position?: PromptPosition;
}

export interface PromptActionEvent {
  action: PromptAction;
  sourceEvent: Event;
}
