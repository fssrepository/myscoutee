import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  Output,
  effect,
  inject
} from '@angular/core';
import {
  CommonModule
} from '@angular/common';
import {
  MatButtonModule
} from '@angular/material/button';
import {
  MatRippleModule
} from '@angular/material/core';

import {
  type DemoBootstrapSelectorMode,
  type DemoBootstrapSelectorState
} from '../../context/stores/demo-bootstrap-selector.store';
import {
  IndicatorComponent
} from '../core/indicator';
import {
  type AppMenuItem,
  type AppMenuTrigger
} from '../core/menu';
import {
  PopupComponent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../core/popup';
import {
  I18nPipe
} from '../../pipes';
import {
  UsersService,
  type BootstrapProcessStage,
  type UserSelectorListItemDto
} from '../../../core';
import {
  UserProfileState
} from '../../../core/common/user-profile-state';
import {
  SeedDemoBootstrapService
} from '../../../core/local/seed/services/demo-bootstrap.service';
import { DemoBootstrapSelectorStore } from '../../context/stores/demo-bootstrap-selector.store';

type DemoSelectorHeaderMenuItemId = 'new-profile';
type DemoSelectorRoleMenuItemId = DemoBootstrapSelectorMode;

interface DemoSelectorHeaderMenuContext {
  action: 'new-profile';
}

interface DemoSelectorRoleMenuContext {
  mode: DemoBootstrapSelectorMode;
}

type DemoSelectorPopupMenuContext = DemoSelectorHeaderMenuContext | DemoSelectorRoleMenuContext;

@Component({
  selector: 'app-demo-bootstrap-selector',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatRippleModule,
    PopupComponent,
    IndicatorComponent,
    I18nPipe
  ],
  templateUrl: './demo-bootstrap-selector.component.html',
  styleUrl: './demo-bootstrap-selector.component.scss'
})
export class DemoBootstrapSelectorComponent {
  private readonly demoBootstrapSelectorStore = inject(DemoBootstrapSelectorStore);
  private readonly usersService = inject(UsersService);
  private readonly seedBootstrap = inject(SeedDemoBootstrapService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private contextRequest: DemoBootstrapSelectorState | null = null;
  private contextRequestToken = 0;
  private contextControlled = false;
  private contextSelectorSeedReady = false;
  private selectedMode: DemoBootstrapSelectorMode = 'member';

  @Input() open = false;
  @Input() loading = false;
  @Input() loadingProgress = 0;
  @Input() loadingLabel = 'Preparing demo data';
  @Input() loadingStage: BootstrapProcessStage = 'selector';
  protected loadingUserList = false;
  @Input() errorMessage = '';
  @Input() submitting = false;
  @Input() users: UserSelectorListItemDto[] = [];
  @Input() title = 'select.demo.user';
  @Input() subtitle = 'demo.selector.subtitle';
  @Input() selectedUserId = '';

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly retryRequested = new EventEmitter<void>();
  @Output() readonly userSelected = new EventEmitter<string>();
  @Output() readonly newProfileRequested = new EventEmitter<void>();

  constructor() {
    effect(() => {
      const request = this.demoBootstrapSelectorStore.demoBootstrapSelector();
      if (!request) {
        this.resetContextState();
        return;
      }
      this.openContextRequest(request);
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onGlobalEscape(event: Event): void {
    if (!this.open || !this.contextRequest) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.stopPropagation();
    this.requestClose();
  }

  protected requestClose(): void {
    if (this.submitting) {
      return;
    }
    if (this.contextRequest) {
      this.contextRequest.onClose?.();
      return;
    }
    this.closeRequested.emit();
  }

  protected popupModel(): PopupModel<DemoSelectorPopupMenuContext> {
    const headerControls: PopupControl<DemoSelectorPopupMenuContext>[] = [];
    const newProfileItems = this.newProfileMenuItems();
    if (newProfileItems.length > 0) {
      headerControls.push({
        id: 'new-profile',
        kind: 'menu',
        menuKind: 'inline',
        items: newProfileItems
      });
    }
    const roleItems = this.selectorRoleMenuItems();
    if (roleItems.length > 0) {
      headerControls.push({
        id: 'selector-role',
        kind: 'menu',
        menuKind: 'select',
        trigger: this.selectorRoleMenuTrigger(),
        items: roleItems,
        panelAlign: 'end'
      });
    }
    return {
      title: this.title,
      subtitle: this.subtitle,
      ariaLabel: 'Demo user selector',
      closeAriaLabel: 'Close demo user popup',
      size: 'wide',
      height: 'auto',
      headerLayout: 'document',
      headerTone: 'accent',
      headerPalette: 'green',
      headerTitleTone: 'neutral',
      bodyLayout: 'flush',
      headerControls,
      onClose: () => this.requestClose(),
      onMenuSelect: event => this.onPopupMenuSelect(event)
    };
  }

  protected requestUserSelect(userId: string): void {
    if (this.loading || this.submitting) {
      return;
    }
    if (this.contextRequest) {
      this.selectContextUser(userId);
      return;
    }
    this.userSelected.emit(userId);
  }

  protected requestRetry(): void {
    if (this.loading || this.submitting) {
      return;
    }
    if (this.contextRequest) {
      this.openContextRequest(this.contextRequest);
      return;
    }
    this.retryRequested.emit();
  }

  protected userStatusClass(user: UserSelectorListItemDto): string {
    switch (user.profileStatus) {
      case 'blocked':
        return 'demo-user-item-blocked';
      case 'deleted':
        return 'demo-user-item-deleted';
      default:
        return this.isNewProfile(user) ? 'demo-user-item-new' : '';
    }
  }

  protected userStatusLabel(user: UserSelectorListItemDto): string {
    switch (user.profileStatus) {
      case 'blocked':
        return 'Blocked';
      case 'deleted':
        return 'Deleted';
      default:
        return this.isNewProfile(user) ? 'New' : '';
    }
  }

  protected userGenderLabel(user: UserSelectorListItemDto): string {
    return user.gender === 'woman' ? 'woman' : 'man';
  }

  protected userAvatarClass(user: UserSelectorListItemDto): string {
    return this.isNewProfile(user) ? 'user-color-setup' : `user-color-${user.gender}`;
  }

  protected userAvatarLabel(user: UserSelectorListItemDto): string {
    return this.isNewProfile(user) ? '' : `${user.initials ?? ''}`.trim();
  }

  protected isNewProfile(user: UserSelectorListItemDto): boolean {
    return UserProfileState.isEmptyOnboardingProfile(user);
  }

  protected newProfileMenuItems(): readonly AppMenuItem<DemoSelectorHeaderMenuItemId, DemoSelectorHeaderMenuContext>[] {
    if (!this.newProfileAvailable()) {
      return [];
    }
    return [{
      id: 'new-profile',
      label: 'new.demo.profile',
      icon: 'person_add',
      kind: 'action',
      palette: 'orange',
      disabled: () => this.loading || this.submitting,
      ariaLabel: 'Open new demo profile',
      context: { action: 'new-profile' }
    }];
  }

  protected selectorRoleMenuTrigger(): AppMenuTrigger {
    return {
      label: this.selectorRoleLabel(this.selectedMode),
      icon: this.selectorRoleIcon(this.selectedMode),
      trailingIcon: 'expand_more',
      ariaLabel: 'Filter demo users',
      palette: this.selectorRolePalette(this.selectedMode),
      layout: 'pill',
      disabled: () => this.submitting
    };
  }

  protected selectorRoleMenuItems(): readonly AppMenuItem<DemoSelectorRoleMenuItemId, DemoSelectorRoleMenuContext>[] {
    const modes = this.contextRequest?.selectableModes ?? [this.selectedMode];
    if (modes.length <= 1) {
      return [];
    }
    return modes.map(mode => ({
      id: mode,
      label: this.selectorRoleLabel(mode),
      icon: this.selectorRoleIcon(mode),
      kind: 'radio',
      palette: this.selectorRolePalette(mode),
      surface: 'tinted',
      active: () => this.selectedMode === mode,
      disabled: () => this.submitting,
      ariaLabel: `Show ${this.selectorRoleLabel(mode)} demo users`,
      context: { mode }
    }));
  }

  protected onPopupMenuSelect(event: PopupMenuSelectEvent<DemoSelectorPopupMenuContext>): void {
    if (event.control.id === 'new-profile') {
      if (event.itemSelect.context && 'action' in event.itemSelect.context) {
        this.requestNewProfile();
      }
      return;
    }
    const context = event.itemSelect.context;
    const mode = context && 'mode' in context ? context.mode : event.itemSelect.id;
    this.selectContextMode(mode as DemoBootstrapSelectorMode);
  }

  protected visibleUsers(): readonly UserSelectorListItemDto[] {
    return this.users.filter(user => !this.isNewProfile(user));
  }

  protected selectedUser(): UserSelectorListItemDto | null {
    const normalizedUserId = this.selectedUserId.trim();
    if (!normalizedUserId) {
      return null;
    }
    return this.users.find(user => user.id.trim() === normalizedUserId) ?? null;
  }

  protected loadingPosition(): number {
    const progress = Number(this.loadingProgress);
    if (!Number.isFinite(progress)) {
      return 0;
    }
    return Math.max(0, Math.min(1, progress / 100));
  }

  protected userListLoadDurationMs(): number {
    return 3000;
  }

  private openContextRequest(request: DemoBootstrapSelectorState): void {
    const requestToken = ++this.contextRequestToken;
    this.contextRequest = request;
    this.contextControlled = true;
    this.contextSelectorSeedReady = false;
    this.commit(() => {
      this.open = true;
      this.title = request.title ?? 'select.demo.user';
      this.subtitle = request.subtitle ?? 'demo.selector.subtitle';
      this.selectedMode = request.mode;
      this.users = request.users?.map(user => ({ ...user })) ?? [];
      this.loading = true;
      this.loadingUserList = false;
      this.loadingProgress = 0;
      this.loadingLabel = 'Preparing demo data';
      this.loadingStage = 'selector';
      this.errorMessage = '';
      this.submitting = false;
      this.selectedUserId = '';
    });
    void this.loadContextUsers(request, requestToken, request.mode, true);
  }

  private async loadContextUsers(
    request: DemoBootstrapSelectorState,
    requestToken: number,
    mode: DemoBootstrapSelectorMode,
    showSelectorProgress: boolean
  ): Promise<void> {
    await this.waitForPopupPaint();
    if (!this.isCurrentContextRequest(requestToken)) {
      return;
    }
    try {
      if (this.usersService.localModeEnabled && !this.contextSelectorSeedReady) {
        if (showSelectorProgress) {
          await this.seedBootstrap.ensureDemoSelectorReady(this.selectorSeedMode(request), state => {
            if (!this.isCurrentContextRequest(requestToken)) {
              return;
            }
            this.commit(() => {
              this.loadingUserList = false;
              this.loadingProgress = state.percent;
              this.loadingLabel = state.label;
              this.loadingStage = state.stage;
            });
          });
        } else {
          this.commit(() => {
            this.loadingUserList = true;
            this.loadingProgress = 0;
            this.loadingLabel = `Loading ${this.selectorRoleLabel(mode).toLowerCase()} demo users`;
            this.loadingStage = 'users';
          });
          await this.seedBootstrap.ensureDemoSelectorReady(this.selectorSeedMode(request));
        }
        this.contextSelectorSeedReady = true;
        if (showSelectorProgress) {
          await this.waitForPhaseReadyBlink();
        }
      }
      if (!this.isCurrentContextRequest(requestToken)) {
        return;
      }
      let users = mode === request.mode
        ? request.users?.map(user => ({ ...user })) ?? null
        : null;
      if (!users) {
        this.commit(() => {
          this.loadingUserList = true;
          this.loadingProgress = 0;
          this.loadingLabel = `Loading ${this.selectorRoleLabel(mode).toLowerCase()} demo users`;
          this.loadingStage = 'users';
        });
        users = await this.usersService.loadAvailableDemoUsers(mode);
      }
      if (!this.isCurrentContextRequest(requestToken)) {
        return;
      }
      this.commit(() => {
        this.users = users;
        this.errorMessage = '';
        this.loadingUserList = false;
        this.selectedMode = mode;
      });
      const autoSelectUserId = `${request.autoSelectUserId ?? ''}`.trim();
      if (autoSelectUserId && mode === request.mode) {
        const autoSelectedUser = users.find(user => user.id.trim() === autoSelectUserId) ?? null;
        if (!autoSelectedUser) {
          this.commit(() => {
            this.loading = false;
            this.loadingUserList = false;
            this.loadingProgress = 0;
            this.loadingLabel = 'Retry demo selector';
            this.loadingStage = 'selector';
            this.errorMessage = 'Unable to open selected demo user.';
          });
          return;
        }
        this.selectContextUser(autoSelectUserId);
        return;
      }
      this.commit(() => {
        this.loading = false;
      });
    } catch {
      if (!this.isCurrentContextRequest(requestToken)) {
        return;
      }
      this.commit(() => {
        this.loading = false;
        this.loadingUserList = false;
        this.loadingProgress = 0;
        this.loadingLabel = 'Retry demo selector';
        this.loadingStage = 'selector';
        this.errorMessage = 'Unable to load demo users right now.';
      });
    }
  }

  private selectContextUser(userId: string): void {
    if (!this.contextRequest) {
      return;
    }
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const requestToken = this.contextRequestToken;
    if (!this.usersService.localModeEnabled) {
      this.commit(() => {
        this.submitting = true;
        this.selectedUserId = normalizedUserId;
        this.errorMessage = '';
      });
      void this.completeContextSelection(normalizedUserId, this.selectedMode, requestToken);
      return;
    }
    this.commit(() => {
      this.submitting = true;
      this.selectedUserId = normalizedUserId;
      this.loading = true;
      this.loadingUserList = false;
      this.loadingProgress = 0;
      this.loadingLabel = 'Preparing demo session';
      this.loadingStage = 'session';
      this.errorMessage = '';
    });

    void this.prepareContextUser(normalizedUserId, this.selectedMode, requestToken);
  }

  private selectContextMode(mode: DemoBootstrapSelectorMode): void {
    if (!this.contextRequest) {
      return;
    }
    const normalizedMode = mode === 'admin' ? 'admin' : 'member';
    if (normalizedMode === this.selectedMode || this.submitting) {
      return;
    }
    if (!this.contextRequest.selectableModes.includes(normalizedMode)) {
      return;
    }
    const request = this.contextRequest;
    const requestToken = ++this.contextRequestToken;
    this.commit(() => {
      this.selectedMode = normalizedMode;
      this.users = [];
      this.selectedUserId = '';
      this.loading = true;
      this.loadingUserList = true;
      this.loadingProgress = 0;
      this.loadingLabel = `Loading ${this.selectorRoleLabel(normalizedMode).toLowerCase()} demo users`;
      this.loadingStage = 'users';
      this.errorMessage = '';
    });
    void this.loadContextUsers(request, requestToken, normalizedMode, false);
  }

  private requestNewProfile(): void {
    if (this.loading || this.submitting) {
      return;
    }
    if (this.contextRequest) {
      this.selectContextNewProfile();
      return;
    }
    this.newProfileRequested.emit();
  }

  private selectContextNewProfile(): void {
    if (!this.contextRequest?.onNewProfile) {
      return;
    }
    const requestToken = this.contextRequestToken;
    this.commit(() => {
      this.submitting = true;
      this.selectedUserId = '';
      this.loading = true;
      this.loadingUserList = false;
      this.loadingProgress = 0;
      this.loadingLabel = 'Opening profile setup';
      this.loadingStage = 'session';
      this.errorMessage = '';
    });
    void this.completeContextNewProfileSelection(requestToken);
  }

  private async prepareContextUser(
    userId: string,
    mode: DemoBootstrapSelectorMode,
    requestToken: number
  ): Promise<void> {
    await this.waitForPopupPaint();
    if (!this.isCurrentContextRequest(requestToken) || !this.contextRequest) {
      return;
    }
    try {
      await this.seedBootstrap.ensureUserReady(userId, mode, state => {
        if (!this.isCurrentContextRequest(requestToken)) {
          return;
        }
        this.commit(() => {
          this.loadingProgress = state.percent;
          this.loadingLabel = state.label;
          this.loadingStage = state.stage;
        });
      });
      if (!this.isCurrentContextRequest(requestToken)) {
        return;
      }
      this.commit(() => {
        this.loadingProgress = 100;
        this.loadingLabel = 'Demo session ready';
        this.loadingStage = 'sessionReady';
      });
      await this.waitForLoaderCompletionBeat();
      if (!this.isCurrentContextRequest(requestToken)) {
        return;
      }
      await this.completeContextSelection(userId, mode, requestToken);
    } catch {
      if (this.isCurrentContextRequest(requestToken)) {
        this.resetContextSelectionFailure('Unable to open demo session.');
      }
    }
  }

  private async completeContextSelection(
    userId: string,
    mode: DemoBootstrapSelectorMode,
    requestToken: number
  ): Promise<void> {
    const request = this.contextRequest;
    if (!request || !this.isCurrentContextRequest(requestToken)) {
      return;
    }
    try {
      const accepted = await request.onSelect(userId, mode);
      if (!this.isCurrentContextRequest(requestToken)) {
        return;
      }
      if (accepted !== false) {
        return;
      }
      this.resetContextSelectionFailure('Unable to open selected demo user.');
    } catch {
      if (this.isCurrentContextRequest(requestToken)) {
        this.resetContextSelectionFailure('Unable to open selected demo user.');
      }
    }
  }

  private async completeContextNewProfileSelection(requestToken: number): Promise<void> {
    const request = this.contextRequest;
    if (!request?.onNewProfile || !this.isCurrentContextRequest(requestToken)) {
      return;
    }
    try {
      const accepted = await request.onNewProfile();
      if (!this.isCurrentContextRequest(requestToken)) {
        return;
      }
      if (accepted !== false) {
        return;
      }
      this.resetContextSelectionFailure('Unable to open profile setup.');
    } catch {
      if (this.isCurrentContextRequest(requestToken)) {
        this.resetContextSelectionFailure('Unable to open profile setup.');
      }
    }
  }

  private newProfileAvailable(): boolean {
    if (this.contextRequest) {
      return this.selectedMode === 'member' && Boolean(this.contextRequest.onNewProfile);
    }
    return true;
  }

  private selectorSeedMode(request: DemoBootstrapSelectorState): DemoBootstrapSelectorMode | 'union' {
    return request.selectableModes.length > 1 ? 'union' : request.mode;
  }

  private selectorRoleLabel(mode: DemoBootstrapSelectorMode): string {
    return mode === 'admin' ? 'Admin' : 'Member';
  }

  private selectorRoleIcon(mode: DemoBootstrapSelectorMode): string {
    return mode === 'admin' ? 'admin_panel_settings' : 'person';
  }

  private selectorRolePalette(mode: DemoBootstrapSelectorMode): 'blue' | 'green' {
    return mode === 'admin' ? 'blue' : 'green';
  }

  private resetContextSelectionFailure(message: string): void {
    this.commit(() => {
      this.loading = false;
      this.loadingUserList = false;
      this.submitting = false;
      this.selectedUserId = '';
      this.loadingProgress = 0;
      this.loadingLabel = 'Preparing demo data';
      this.loadingStage = 'selector';
      this.errorMessage = message;
    });
  }

  private isCurrentContextRequest(requestToken: number): boolean {
    return this.open && this.contextRequestToken === requestToken && this.contextRequest !== null;
  }

  private resetContextState(): void {
    if (!this.contextControlled) {
      return;
    }
    this.contextRequestToken += 1;
    this.contextRequest = null;
    this.contextControlled = false;
    this.contextSelectorSeedReady = false;
    this.open = false;
    this.loading = false;
    this.loadingUserList = false;
    this.loadingProgress = 0;
    this.loadingLabel = 'Preparing demo data';
    this.loadingStage = 'selector';
    this.errorMessage = '';
    this.submitting = false;
    this.selectedUserId = '';
    this.users = [];
    this.selectedMode = 'member';
    this.changeDetectorRef.markForCheck();
  }

  private commit(update: () => void): void {
    this.ngZone.run(() => {
      update();
      this.changeDetectorRef.detectChanges();
    });
  }

  private waitForPopupPaint(): Promise<void> {
    return new Promise(resolve => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setTimeout(resolve, 80);
          });
        });
        return;
      }
      setTimeout(resolve, 80);
    });
  }

  private waitForLoaderCompletionBeat(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 240));
  }

  private waitForPhaseReadyBlink(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 500));
  }
}
