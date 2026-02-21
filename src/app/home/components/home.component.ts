import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DEMO_USERS, DemoUser } from '../../shared/demo-data';

type LocalPopup = 'history' | null;

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  private users = DEMO_USERS;
  protected selectedRating = 7;
  protected isPairMode = false;
  protected cardIndex = 0;
  protected localPopup: LocalPopup = null;
  protected activeUserId = this.getActiveUserId();

  protected get activeUser(): DemoUser {
    return this.users.find(user => user.id === this.activeUserId) ?? this.users[0];
  }

  protected get candidatePool(): DemoUser[] {
    return this.users.filter(user => user.id !== this.activeUserId);
  }

  protected get activeCandidate(): DemoUser {
    const pool = this.candidatePool;
    return pool[this.cardIndex % pool.length];
  }

  protected get ratingScale(): number[] {
    return Array.from({ length: 10 }, (_, index) => index + 1);
  }

  protected setRating(value: number): void {
    this.selectedRating = value;
    const nextIndex = this.cardIndex + 1;
    this.cardIndex = nextIndex % this.candidatePool.length;
  }

  protected togglePairMode(): void {
    this.isPairMode = !this.isPairMode;
  }

  protected openHistory(): void {
    this.localPopup = 'history';
  }

  protected closeLocalPopup(): void {
    this.localPopup = null;
  }

  protected openFilter(): void {
    this.localPopup = 'history';
  }

  protected get candidateInitials(): string {
    const parts = this.activeCandidate.name.split(' ').filter(Boolean);
    if (parts.length === 0) {
      return 'U';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  @HostListener('window:active-user-changed')
  onActiveUserChanged(): void {
    this.activeUserId = this.getActiveUserId();
    this.cardIndex = 0;
  }

  private getActiveUserId(): string {
    const stored = localStorage.getItem('demo-active-user');
    if (!stored) {
      return this.users[0].id;
    }
    return this.users.some(user => user.id === stored) ? stored : this.users[0].id;
  }
}
