import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { DEMO_USERS, DemoUser } from '../../shared/demo-data';

type LocalPopup = 'history' | 'filter' | null;

interface GameFilterForm {
  ageMin: number;
  ageMax: number;
  heightMinCm: number;
  heightMaxCm: number;
  maxDistanceKm: number;
  physiques: string[];
  languages: string[];
  genders: Array<DemoUser['gender']>;
  horoscopes: string[];
  traitLabels: string[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, FormsModule, MatSliderModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  private static readonly AGE_MIN = 18;
  private static readonly AGE_MAX = 120;
  private static readonly HEIGHT_MIN_CM = 40;
  private static readonly HEIGHT_MAX_CM = 250;
  private static readonly DISTANCE_MAX_KM = 500;
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
  protected filterDraft: GameFilterForm;
  protected gameFilter: GameFilterForm;
  private isCandidateImageDragging = false;
  private candidateDragOffsetX = 0;
  private candidateDragOffsetY = 0;
  private activeTouchId: number | null = null;
  private readonly cityCoordinates: Record<string, { lat: number; lng: number }> = {
    Austin: { lat: 30.2672, lng: -97.7431 },
    Chicago: { lat: 41.8781, lng: -87.6298 },
    Seattle: { lat: 47.6062, lng: -122.3321 },
    'San Diego': { lat: 32.7157, lng: -117.1611 },
    Denver: { lat: 39.7392, lng: -104.9903 },
    Miami: { lat: 25.7617, lng: -80.1918 },
    'New York': { lat: 40.7128, lng: -74.006 },
    Boston: { lat: 42.3601, lng: -71.0589 },
    Portland: { lat: 45.5152, lng: -122.6784 },
    'Los Angeles': { lat: 34.0522, lng: -118.2437 },
    Nashville: { lat: 36.1627, lng: -86.7816 },
    Phoenix: { lat: 33.4484, lng: -112.074 }
  };

  constructor() {
    const initialFilter = this.createInitialFilter();
    this.gameFilter = this.cloneFilter(initialFilter);
    this.filterDraft = this.cloneFilter(initialFilter);
  }

  protected get activeUser(): DemoUser {
    return this.users.find(user => user.id === this.activeUserId) ?? this.users[0];
  }

  protected get candidatePool(): DemoUser[] {
    return this.users
      .filter(user => user.id !== this.activeUserId)
      .filter(user => this.matchesFilter(user));
  }

  protected get activeCandidate(): DemoUser | null {
    const pool = this.candidatePool;
    if (pool.length === 0) {
      return null;
    }
    return pool[this.cardIndex % pool.length] ?? null;
  }

  protected get hasFilteredCandidates(): boolean {
    return this.candidatePool.length > 0;
  }

  protected get minAgeBound(): number {
    return HomeComponent.AGE_MIN;
  }

  protected get maxAgeBound(): number {
    return HomeComponent.AGE_MAX;
  }

  protected get minHeightBoundCm(): number {
    return HomeComponent.HEIGHT_MIN_CM;
  }

  protected get maxHeightBoundCm(): number {
    return HomeComponent.HEIGHT_MAX_CM;
  }

  protected get availablePhysiques(): string[] {
    return Array.from(new Set(this.users.map(user => user.physique))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableLanguages(): string[] {
    return Array.from(new Set(this.users.flatMap(user => user.languages))).sort((a, b) => a.localeCompare(b));
  }

  protected readonly genderFilterOptions: Array<{ value: DemoUser['gender']; label: string; icon: string }> = [
    { value: 'woman', label: 'Woman', icon: 'female' },
    { value: 'man', label: 'Man', icon: 'male' }
  ];

  protected get availableHoroscopes(): string[] {
    return Array.from(new Set(this.users.map(user => user.horoscope))).sort((a, b) => a.localeCompare(b));
  }

  protected get availableTraitLabels(): string[] {
    return Array.from(new Set(this.users.map(user => user.traitLabel))).sort((a, b) => a.localeCompare(b));
  }

  protected get ratingScale(): number[] {
    return Array.from({ length: 10 }, (_, index) => index + 1);
  }

  protected get isFilterActive(): boolean {
    const baseline = this.createInitialFilter();
    return (
      this.gameFilter.ageMin !== baseline.ageMin ||
      this.gameFilter.ageMax !== baseline.ageMax ||
      this.gameFilter.heightMinCm !== baseline.heightMinCm ||
      this.gameFilter.heightMaxCm !== baseline.heightMaxCm ||
      this.gameFilter.maxDistanceKm !== baseline.maxDistanceKm ||
      this.gameFilter.physiques.length > 0 ||
      this.gameFilter.languages.length > 0 ||
      this.gameFilter.genders.length > 0 ||
      this.gameFilter.horoscopes.length > 0 ||
      this.gameFilter.traitLabels.length > 0
    );
  }

  protected setRating(value: number): void {
    if (!this.activeCandidate) {
      return;
    }
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
    this.filterDraft = this.cloneFilter(this.gameFilter);
    this.localPopup = 'filter';
  }

  protected applyFilter(): void {
    this.gameFilter = this.normalizeFilter(this.filterDraft);
    this.cardIndex = 0;
    this.resetCandidateImageState();
    this.localPopup = null;
  }

  protected resetFilterDraft(): void {
    this.filterDraft = this.createInitialFilter();
  }

  protected toggleFilterPhysique(physique: string): void {
    this.filterDraft.physiques = this.toggleArraySelection(this.filterDraft.physiques, physique);
  }

  protected toggleFilterLanguage(language: string): void {
    this.filterDraft.languages = this.toggleArraySelection(this.filterDraft.languages, language);
  }

  protected toggleFilterGender(gender: DemoUser['gender']): void {
    this.filterDraft.genders = this.toggleArraySelection(this.filterDraft.genders, gender);
  }

  protected toggleFilterHoroscope(horoscope: string): void {
    this.filterDraft.horoscopes = this.toggleArraySelection(this.filterDraft.horoscopes, horoscope);
  }

  protected toggleFilterTraitLabel(traitLabel: string): void {
    this.filterDraft.traitLabels = this.toggleArraySelection(this.filterDraft.traitLabels, traitLabel);
  }

  protected isPhysiqueSelected(physique: string): boolean {
    return this.filterDraft.physiques.includes(physique);
  }

  protected isLanguageSelected(language: string): boolean {
    return this.filterDraft.languages.includes(language);
  }

  protected isGenderSelected(gender: DemoUser['gender']): boolean {
    return this.filterDraft.genders.includes(gender);
  }

  protected isHoroscopeSelected(horoscope: string): boolean {
    return this.filterDraft.horoscopes.includes(horoscope);
  }

  protected isTraitLabelSelected(traitLabel: string): boolean {
    return this.filterDraft.traitLabels.includes(traitLabel);
  }

  protected onAgeMinChange(value: number): void {
    this.filterDraft.ageMin = Number(value);
    if (this.filterDraft.ageMin > this.filterDraft.ageMax) {
      this.filterDraft.ageMax = this.filterDraft.ageMin;
    }
  }

  protected onAgeMaxChange(value: number): void {
    this.filterDraft.ageMax = Number(value);
    if (this.filterDraft.ageMax < this.filterDraft.ageMin) {
      this.filterDraft.ageMin = this.filterDraft.ageMax;
    }
  }

  protected onHeightMinChange(value: number): void {
    this.filterDraft.heightMinCm = Number(value);
    if (this.filterDraft.heightMinCm > this.filterDraft.heightMaxCm) {
      this.filterDraft.heightMaxCm = this.filterDraft.heightMinCm;
    }
  }

  protected onHeightMaxChange(value: number): void {
    this.filterDraft.heightMaxCm = Number(value);
    if (this.filterDraft.heightMaxCm < this.filterDraft.heightMinCm) {
      this.filterDraft.heightMinCm = this.filterDraft.heightMaxCm;
    }
  }

  protected onDistanceChange(value: number): void {
    this.filterDraft.maxDistanceKm = this.clamp(Math.round(Number(value)), 0, HomeComponent.DISTANCE_MAX_KM);
  }

  protected localizedStatusText(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'aktív felhasználó') {
      return 'Active user';
    }
    return value;
  }

  protected get candidateImageStack(): string[] {
    if (!this.activeCandidate) {
      return [];
    }
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
    if (!this.activeCandidate) {
      return 'NO';
    }
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
    const initialFilter = this.createInitialFilter();
    this.gameFilter = this.cloneFilter(initialFilter);
    this.filterDraft = this.cloneFilter(initialFilter);
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

  private createInitialFilter(): GameFilterForm {
    const minAge = this.minAgeBound;
    const maxAge = this.maxAgeBound;
    const minHeight = this.minHeightBoundCm;
    const maxHeight = this.maxHeightBoundCm;
    const activeHeight = this.parseHeightCm(this.activeUser.height);
    const preferredMin = Math.max(minAge, this.activeUser.age - 5);
    const preferredMax = Math.min(maxAge, this.activeUser.age + 5);
    return {
      ageMin: preferredMin,
      ageMax: preferredMax,
      heightMinCm: Math.max(minHeight, (activeHeight ?? minHeight) - 10),
      heightMaxCm: Math.min(maxHeight, (activeHeight ?? maxHeight) + 10),
      maxDistanceKm: 300,
      physiques: [],
      languages: [],
      genders: [],
      horoscopes: [],
      traitLabels: []
    };
  }

  private cloneFilter(filter: GameFilterForm): GameFilterForm {
    return {
      ageMin: filter.ageMin,
      ageMax: filter.ageMax,
      heightMinCm: filter.heightMinCm,
      heightMaxCm: filter.heightMaxCm,
      maxDistanceKm: filter.maxDistanceKm,
      physiques: [...filter.physiques],
      languages: [...filter.languages],
      genders: [...filter.genders],
      horoscopes: [...filter.horoscopes],
      traitLabels: [...filter.traitLabels]
    };
  }

  private normalizeFilter(filter: GameFilterForm): GameFilterForm {
    const minAge = Math.max(this.minAgeBound, Math.min(filter.ageMin, filter.ageMax));
    const maxAge = Math.min(this.maxAgeBound, Math.max(filter.ageMin, filter.ageMax));
    const minHeight = Math.max(this.minHeightBoundCm, Math.min(filter.heightMinCm, filter.heightMaxCm));
    const maxHeight = Math.min(this.maxHeightBoundCm, Math.max(filter.heightMinCm, filter.heightMaxCm));
    return {
      ageMin: minAge,
      ageMax: maxAge,
      heightMinCm: minHeight,
      heightMaxCm: maxHeight,
      maxDistanceKm: this.clamp(Math.round(filter.maxDistanceKm), 0, HomeComponent.DISTANCE_MAX_KM),
      physiques: [...filter.physiques],
      languages: [...filter.languages],
      genders: [...filter.genders],
      horoscopes: [...filter.horoscopes],
      traitLabels: [...filter.traitLabels]
    };
  }

  private toggleArraySelection<T extends string>(values: T[], target: T): T[] {
    const hasTarget = values.includes(target);
    return hasTarget ? values.filter(item => item !== target) : [...values, target];
  }

  private matchesFilter(user: DemoUser): boolean {
    const filter = this.gameFilter;
    if (user.age < filter.ageMin || user.age > filter.ageMax) {
      return false;
    }
    const userHeight = this.parseHeightCm(user.height);
    if (userHeight !== null && (userHeight < filter.heightMinCm || userHeight > filter.heightMaxCm)) {
      return false;
    }
    if (filter.physiques.length > 0 && !filter.physiques.includes(user.physique)) {
      return false;
    }
    if (filter.languages.length > 0) {
      const hasLanguageMatch = user.languages.some(language => filter.languages.includes(language));
      if (!hasLanguageMatch) {
        return false;
      }
    }
    if (filter.genders.length > 0 && !filter.genders.includes(user.gender)) {
      return false;
    }
    if (filter.horoscopes.length > 0 && !filter.horoscopes.includes(user.horoscope)) {
      return false;
    }
    if (filter.traitLabels.length > 0 && !filter.traitLabels.includes(user.traitLabel)) {
      return false;
    }
    const distanceKm = this.distanceBetweenCities(this.activeUser.city, user.city);
    if (distanceKm !== null && distanceKm > filter.maxDistanceKm) {
      return false;
    }
    return true;
  }

  private distanceBetweenCities(cityA: string, cityB: string): number | null {
    const pointA = this.cityCoordinates[cityA];
    const pointB = this.cityCoordinates[cityB];
    if (!pointA || !pointB) {
      return null;
    }
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthKm = 6371;
    const dLat = toRad(pointB.lat - pointA.lat);
    const dLng = toRad(pointB.lng - pointA.lng);
    const lat1 = toRad(pointA.lat);
    const lat2 = toRad(pointB.lat);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthKm * c);
  }

  private parseHeightCm(height: string): number | null {
    const parsed = Number.parseInt(height, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
