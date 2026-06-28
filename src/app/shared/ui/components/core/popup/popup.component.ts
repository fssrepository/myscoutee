import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { I18nPipe } from '../../../pipes';
import { AppMenuComponent, type AppMenuItemSelectEvent } from '../menu';
import type {
  PopupAction,
  PopupActionEvent,
  PopupControl,
  PopupMenuControl,
  PopupMenuSelectEvent,
  PopupModel
} from './popup.types';

@Component({
  selector: 'app-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, AppMenuComponent, I18nPipe],
  templateUrl: './popup.component.html',
  styleUrl: './popup.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PopupComponent<TContext = unknown> {
  @Input() model: PopupModel<TContext> | null = null;
  @Input() zIndex: number | null = null;

  @Output() readonly close = new EventEmitter<Event>();
  @Output() readonly menuSelect = new EventEmitter<PopupMenuSelectEvent<TContext>>();
  @Output() readonly action = new EventEmitter<PopupActionEvent>();

  protected get popupModel(): PopupModel<TContext> {
    return this.model ?? {};
  }

  protected get ariaLabel(): string {
    return this.popupModel.ariaLabel?.trim()
      || this.popupModel.title?.trim()
      || 'Popup';
  }

  protected get closeAriaLabel(): string {
    return this.popupModel.closeAriaLabel?.trim() || 'Close';
  }

  protected get closeOnBackdrop(): boolean {
    return this.popupModel.closeOnBackdrop !== false;
  }

  protected get showClose(): boolean {
    return this.popupModel.showClose !== false;
  }

  protected get showHeader(): boolean {
    return this.popupModel.showHeader !== false;
  }

  protected get hasHeader(): boolean {
    return this.showHeader
      && (
        Boolean(this.popupModel.title?.trim())
        || Boolean(this.popupModel.subtitle?.trim())
        || Boolean(this.popupModel.secondarySubtitle?.trim())
        || this.hasHeaderControls
        || this.hasHeaderActions
        || this.showClose
      );
  }

  protected get headerControls(): readonly PopupControl<TContext>[] {
    return this.popupModel.headerControls ?? [];
  }

  protected get headerActions(): readonly PopupAction[] {
    return this.popupModel.headerActions ?? [];
  }

  protected get toolbarControls(): readonly PopupControl<TContext>[] {
    return this.popupModel.toolbarControls ?? [];
  }

  protected get toolbarStartControls(): readonly PopupControl<TContext>[] {
    return this.toolbarControls.filter(control => control.align !== 'end');
  }

  protected get toolbarEndControls(): readonly PopupControl<TContext>[] {
    return this.toolbarControls.filter(control => control.align === 'end');
  }

  protected get hasToolbar(): boolean {
    return this.toolbarControls.length > 0;
  }

  protected get hasToolbarStartControls(): boolean {
    return this.toolbarStartControls.length > 0;
  }

  protected get hasToolbarEndControls(): boolean {
    return this.toolbarEndControls.length > 0;
  }

  protected get hasHeaderControls(): boolean {
    return this.headerControls.length > 0;
  }

  protected get hasHeaderActions(): boolean {
    return this.headerActions.length > 0;
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (!this.closeOnBackdrop) {
      return;
    }
    this.emitClose(event);
  }

  protected onPanelClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  protected isMenuControl(control: PopupControl<TContext>): control is PopupMenuControl<TContext> {
    return 'kind' in control && control.kind === 'menu';
  }

  protected actionPaletteClass(action: PopupAction): string {
    return `ui-popup__action--${action.palette ?? 'default'}`;
  }

  protected panelSizeClass(): string {
    return `ui-popup__panel--${this.popupModel.size ?? 'default'}`;
  }

  protected panelHeightClass(): string {
    return `ui-popup__panel--height-${this.popupModel.height ?? 'auto'}`;
  }

  protected headerToneClass(): string {
    return `ui-popup__header--${this.popupModel.headerTone ?? 'default'}`;
  }

  protected bodyLayoutClass(): string {
    return `ui-popup__body--${this.popupModel.bodyLayout ?? 'default'}`;
  }

  protected backdropToneClass(): string {
    return `ui-popup__backdrop--${this.popupModel.backdropTone ?? 'default'}`;
  }

  protected emitClose(event: Event): void {
    this.popupModel.onClose?.(event);
    this.close.emit(event);
  }

  protected selectMenuItem(
    control: PopupMenuControl<TContext>,
    itemSelect: AppMenuItemSelectEvent<string, TContext>
  ): void {
    const event = { control, itemSelect };
    this.popupModel.onMenuSelect?.(event);
    this.menuSelect.emit(event);
  }

  protected selectAction(action: PopupAction, sourceEvent: Event): void {
    if (action.disabled) {
      return;
    }
    const event = { action, sourceEvent };
    this.popupModel.onAction?.(event);
    this.action.emit(event);
  }
}
