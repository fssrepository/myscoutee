import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { HelpCenterService } from '../../../shared/core';
import type { HelpCenterSection } from '../../../shared/core/base/models';

@Component({
  selector: 'app-navigator-privacy-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './navigator-privacy-popup.component.html',
  styleUrl: './navigator-privacy-popup.component.scss'
})
export class NavigatorPrivacyPopupComponent {
  private readonly helpCenter = inject(HelpCenterService);

  protected readonly activeRevision = this.helpCenter.activePrivacyRevision;
  protected readonly sections = computed<HelpCenterSection[]>(() => this.activeRevision()?.sections ?? []);
  protected readonly defaultPrivacyDescription = APP_STATIC_DATA.defaultPrivacyCenterDescription;
  protected openAccordionSectionId = '';
  protected approvedSectionIds = new Set<string>();
  protected loading = false;

  constructor() {
    this.loading = this.helpCenter.privacyState() === null;
    if (this.loading) {
      void this.loadPrivacy();
    }
    effect(() => {
      const sections = this.sections();
      this.approvedSectionIds = new Set(
        Array.from(this.approvedSectionIds).filter(sectionId => sections.some(section => section.id === sectionId))
      );
      if (sections.length === 0) {
        this.openAccordionSectionId = '';
        return;
      }
      if (!this.openAccordionSectionId || !sections.some(section => section.id === this.openAccordionSectionId)) {
        this.openAccordionSectionId = sections[0].id;
      }
    });
  }

  protected toggleAccordionSection(sectionId: string, event?: Event): void {
    event?.stopPropagation();
    this.openAccordionSectionId = this.openAccordionSectionId === sectionId ? '' : sectionId;
  }

  protected toggleSectionApproval(sectionId: string, event?: Event): void {
    event?.preventDefault();
    this.stopNestedAccordionEvent(event);
    const next = new Set(this.approvedSectionIds);
    if (next.has(sectionId)) {
      next.delete(sectionId);
    } else {
      next.add(sectionId);
    }
    this.approvedSectionIds = next;
  }

  protected stopNestedAccordionEvent(event?: Event): void {
    event?.stopPropagation();
    event?.stopImmediatePropagation();
  }

  protected isSectionApproved(sectionId: string): boolean {
    return this.approvedSectionIds.has(sectionId);
  }

  protected isSectionOptional(section: HelpCenterSection): boolean {
    return section.optional === true;
  }

  protected onAccordionKeydown(sectionId: string, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.toggleAccordionSection(sectionId, event);
  }

  private async loadPrivacy(): Promise<void> {
    try {
      await this.helpCenter.preload('privacy');
    } finally {
      this.loading = false;
    }
  }
}
