import { Injectable, signal } from '@angular/core';

export interface UserMenuShellAvatarState {
  initials: string;
  gender: 'woman' | 'man';
  imageUrl: string | null;
  badgeCount: number;
}

const DEFAULT_USER_MENU_SHELL_AVATAR_STATE: UserMenuShellAvatarState = {
  initials: '',
  gender: 'woman',
  imageUrl: null,
  badgeCount: 0
};

@Injectable({
  providedIn: 'root'
})
export class UserMenuShellService {
  private readonly avatarStateRef = signal<UserMenuShellAvatarState>(DEFAULT_USER_MENU_SHELL_AVATAR_STATE);
  private readonly menuOpenRef = signal(false);

  readonly avatarState = this.avatarStateRef.asReadonly();
  readonly menuOpen = this.menuOpenRef.asReadonly();

  setAvatarState(next: UserMenuShellAvatarState): void {
    const current = this.avatarStateRef();
    if (
      current.initials === next.initials &&
      current.gender === next.gender &&
      current.imageUrl === next.imageUrl &&
      current.badgeCount === next.badgeCount
    ) {
      return;
    }
    this.avatarStateRef.set({ ...next });
  }

  resetAvatarState(): void {
    this.avatarStateRef.set(DEFAULT_USER_MENU_SHELL_AVATAR_STATE);
  }

  setMenuOpen(open: boolean): void {
    if (this.menuOpenRef() === open) {
      return;
    }
    this.menuOpenRef.set(open);
  }

  toggleMenu(): void {
    this.menuOpenRef.update(open => !open);
  }
}
