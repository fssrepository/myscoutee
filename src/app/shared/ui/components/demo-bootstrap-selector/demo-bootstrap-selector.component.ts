import { ChangeDetectorRef, Component, EventEmitter, HostListener, Input, NgZone, Output, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';

import { AppPopupContext, type DemoBootstrapSelectorState } from '../../context/app-popup.context';
import { ProgressIndicatorComponent } from '../progress-indicator';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../menu';
import { I18nPipe } from '../../pipes';
import { UsersService, type BootstrapProcessStage, type UserSelectorListItemDto } from '../../../core';
import { UserProfileStateBuilder } from '../../../core/base/builders';
import { SeedDemoBootstrapService } from '../../../core/local/seed';

type DemoSelectorHeaderMenuItemId = 'new-profile';

interface DemoSelectorHeaderMenuContext {
  action: 'new-profile';
}

@Component({
  selector: 'app-demo-bootstrap-selector',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatRippleModule,
    AppMenuComponent,
    ProgressIndicatorComponent,
    I18nPipe
  ],
  templateUrl: './demo-bootstrap-selector.component.html',
  styleUrl: './demo-bootstrap-selector.component.scss'
})
export class DemoBootstrapSelectorComponent {
  private readonly popupCtx = inject(AppPopupContext);
  private readonly usersService = inject(UsersService);
  private readonly seedBootstrap = inject(SeedDemoBootstrapService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private contextRequest: DemoBootstrapSelectorState | null = null;
  private contextRequestToken = 0;
  private contextControlled = false;

  @Input() open = false;
  @Input() loading = false;
  @Input() loadingProgress = 0;
  @Input() loadingLabel = 'Preparing demo data';
  @Input() loadingStage: BootstrapProcessStage = 'selector';
  protected loadingUserList = false;
  @Input() errorMessage = '';
  @Input() submitting = false;
  @Input() users: UserSelectorListItemDto[] = [];
  @Input() title = 'Select demo user';
  @Input() subtitle = 'Login disabled mode. Choose a demo user to open perspective-based data.';
  @Input() selectedUserId = '';

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly retryRequested = new EventEmitter<void>();
  @Output() readonly userSelected = new EventEmitter<string>();
  @Output() readonly newProfileRequested = new EventEmitter<void>();

  constructor() {
    effect(() => {
      const request = this.popupCtx.demoBootstrapSelector();
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
    return UserProfileStateBuilder.isEmptyOnboardingProfile(user);
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

  protected onHeaderMenuSelect(
    event: AppMenuItemSelectEvent<DemoSelectorHeaderMenuItemId, DemoSelectorHeaderMenuContext>
  ): void {
    if (event.context?.action !== 'new-profile') {
      return;
    }
    this.requestNewProfile();
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
    this.commit(() => {
      this.open = true;
      this.title = request.title ?? 'Select demo user';
      this.subtitle = request.subtitle ?? 'Login disabled mode. Choose a demo user to open perspective-based data.';
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
    void this.loadContextUsers(request, requestToken);
  }

  private async loadContextUsers(
    request: DemoBootstrapSelectorState,
    requestToken: number
  ): Promise<void> {
    await this.waitForPopupPaint();
    if (!this.isCurrentContextRequest(requestToken)) {
      return;
    }
    try {
      if (this.usersService.localModeEnabled) {
        await this.seedBootstrap.ensureDemoSelectorReady(request.mode, state => {
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
        await this.waitForPhaseReadyBlink();
      }
      if (!this.isCurrentContextRequest(requestToken)) {
        return;
      }
      let users = request.users?.map(user => ({ ...user })) ?? null;
      if (!users) {
        this.commit(() => {
          this.loadingUserList = true;
          this.loadingProgress = 0;
          this.loadingLabel = 'Loading demo users';
          this.loadingStage = 'users';
        });
        users = await this.usersService.loadAvailableDemoUsers(request.mode);
      }
      if (!this.isCurrentContextRequest(requestToken)) {
        return;
      }
      this.commit(() => {
        this.users = users;
        this.errorMessage = '';
        this.loadingUserList = false;
      });
      const autoSelectUserId = `${request.autoSelectUserId ?? ''}`.trim();
      if (autoSelectUserId) {
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
      void this.completeContextSelection(normalizedUserId, requestToken);
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

    void this.prepareContextUser(normalizedUserId, requestToken);
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

  private async prepareContextUser(userId: string, requestToken: number): Promise<void> {
    await this.waitForPopupPaint();
    if (!this.isCurrentContextRequest(requestToken) || !this.contextRequest) {
      return;
    }
    try {
      await this.seedBootstrap.ensureUserReady(userId, this.contextRequest.mode, state => {
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
      await this.completeContextSelection(userId, requestToken);
    } catch {
      if (this.isCurrentContextRequest(requestToken)) {
        this.resetContextSelectionFailure('Unable to open demo session.');
      }
    }
  }

  private async completeContextSelection(userId: string, requestToken: number): Promise<void> {
    const request = this.contextRequest;
    if (!request || !this.isCurrentContextRequest(requestToken)) {
      return;
    }
    try {
      const accepted = await request.onSelect(userId);
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
      return this.contextRequest.mode === 'member' && Boolean(this.contextRequest.onNewProfile);
    }
    return true;
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
