import { Injectable, inject } from '@angular/core';

import { AppContext, type UserDto } from '../../shared/core';

@Injectable({
  providedIn: 'root'
})
export class AdminProfileService {
  private readonly appCtx = inject(AppContext);

  updateAdminProfile(patch: Pick<UserDto, 'name' | 'headline' | 'about'>): void {
    const current = this.appCtx.activeUserProfile();
    if (!current) {
      return;
    }
    const nextUser: UserDto = {
      ...current,
      name: patch.name.trim() || current.name,
      initials: this.initialsFromName(patch.name.trim() || current.name, current.initials),
      headline: patch.headline.trim(),
      about: patch.about.trim()
    };
    this.appCtx.setUserProfile(nextUser);
  }

  private initialsFromName(name: string, fallback: string): string {
    const initials = name.trim().split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
    return initials || fallback;
  }
}
