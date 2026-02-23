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
  protected selectedCandidateImageIndex = 0;
  protected candidateImageZoom = 1;
  protected candidateImagePanX = 0;
  protected candidateImagePanY = 0;
  protected localPopup: LocalPopup = null;
  protected activeUserId = this.getActiveUserId();
  private isCandidateImageDragging = false;
  private candidateDragOffsetX = 0;
  private candidateDragOffsetY = 0;
  private activeTouchId: number | null = null;

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
    this.resetCandidateImageState();
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

  protected get candidateImageStack(): string[] {
    const explicitImages = (this.activeCandidate.images ?? []).filter(Boolean);
    if (explicitImages.length > 0) {
      return explicitImages;
    }
    const base = `assets/profile/${this.activeCandidate.id}`;
    return ['a', 'b', 'c'].map(suffix => `${base}-${suffix}.svg`);
  }

  protected get candidateImage(): string | null {
    if (this.candidateImageStack.length === 0) {
      return null;
    }
    const safeIndex = Math.min(this.selectedCandidateImageIndex, this.candidateImageStack.length - 1);
    return this.candidateImageStack[safeIndex] ?? null;
  }

  protected selectCandidateImage(index: number): void {
    if (index < 0 || index >= this.candidateImageStack.length) {
      return;
    }
    this.selectedCandidateImageIndex = index;
    this.candidateImageZoom = 1;
    this.candidateImagePanX = 0;
    this.candidateImagePanY = 0;
    this.isCandidateImageDragging = false;
  }

  protected onCandidateImageWheel(event: WheelEvent): void {
    if (!this.candidateImage) {
      return;
    }
    event.preventDefault();
    const zoomDelta = event.deltaY < 0 ? 0.12 : -0.12;
    this.candidateImageZoom = this.clamp(this.candidateImageZoom + zoomDelta, 1, 3.5);
    this.clampCandidateImagePan();
  }

  protected onCandidateImageMouseDown(event: MouseEvent): void {
    if (this.candidateImageZoom <= 1) {
      return;
    }
    this.isCandidateImageDragging = true;
    this.candidateDragOffsetX = event.clientX - this.candidateImagePanX;
    this.candidateDragOffsetY = event.clientY - this.candidateImagePanY;
  }

  protected onCandidateImageMouseMove(event: MouseEvent): void {
    if (!this.isCandidateImageDragging) {
      return;
    }
    this.candidateImagePanX = event.clientX - this.candidateDragOffsetX;
    this.candidateImagePanY = event.clientY - this.candidateDragOffsetY;
    this.clampCandidateImagePan();
  }

  protected onCandidateImageMouseUp(): void {
    this.isCandidateImageDragging = false;
  }

  protected onCandidateImageTouchStart(event: TouchEvent): void {
    if (this.candidateImageZoom <= 1 || event.touches.length === 0) {
      return;
    }
    const touch = event.touches[0];
    this.activeTouchId = touch.identifier;
    this.isCandidateImageDragging = true;
    this.candidateDragOffsetX = touch.clientX - this.candidateImagePanX;
    this.candidateDragOffsetY = touch.clientY - this.candidateImagePanY;
  }

  protected onCandidateImageTouchMove(event: TouchEvent): void {
    if (!this.isCandidateImageDragging || this.activeTouchId === null) {
      return;
    }
    const touch = Array.from(event.touches).find(item => item.identifier === this.activeTouchId);
    if (!touch) {
      return;
    }
    event.preventDefault();
    this.candidateImagePanX = touch.clientX - this.candidateDragOffsetX;
    this.candidateImagePanY = touch.clientY - this.candidateDragOffsetY;
    this.clampCandidateImagePan();
  }

  protected onCandidateImageTouchEnd(): void {
    this.isCandidateImageDragging = false;
    this.activeTouchId = null;
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
    this.resetCandidateImageState();
  }

  private getActiveUserId(): string {
    const stored = localStorage.getItem('demo-active-user');
    if (!stored) {
      return this.users[0].id;
    }
    return this.users.some(user => user.id === stored) ? stored : this.users[0].id;
  }

  private clampCandidateImagePan(): void {
    const bound = (this.candidateImageZoom - 1) * 140;
    this.candidateImagePanX = this.clamp(this.candidateImagePanX, -bound, bound);
    this.candidateImagePanY = this.clamp(this.candidateImagePanY, -bound, bound);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private resetCandidateImageState(): void {
    this.selectedCandidateImageIndex = 0;
    this.candidateImageZoom = 1;
    this.candidateImagePanX = 0;
    this.candidateImagePanY = 0;
    this.isCandidateImageDragging = false;
    this.activeTouchId = null;
  }
}
