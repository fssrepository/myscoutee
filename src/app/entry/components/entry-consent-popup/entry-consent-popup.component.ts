import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, effect, inject } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { HelpCenterService } from '../../../shared/core';
import type { HelpCenterSection } from '../../../shared/core/base/models';

@Component({
  selector: 'app-entry-consent-popup',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatRippleModule],
  templateUrl: './entry-consent-popup.component.html',
  styleUrl: './entry-consent-popup.component.scss'
})
export class EntryConsentPopupComponent {
  private readonly helpCenter = inject(HelpCenterService);

  @Input() open = false;
  @Input() viewOnly = false;
  @Input() loading = false;

  @Output() readonly closeRequested = new EventEmitter<void>();
  @Output() readonly acceptRequested = new EventEmitter<void>();
  @Output() readonly rejectRequested = new EventEmitter<void>();

  protected readonly activeRevision = this.helpCenter.activePrivacyRevision;
  protected readonly versionLabel = this.helpCenter.activePrivacyVersionLabel;
  protected readonly sections = computed<HelpCenterSection[]>(() => this.activeRevision()?.sections ?? []);
  protected readonly defaultPrivacyDescription = APP_STATIC_DATA.defaultPrivacyCenterDescription;
  protected openAccordionSectionId = '';
  protected approvedSectionIds = new Set<string>();

  constructor() {
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

  protected requestClose(): void {
    this.closeRequested.emit();
  }

  protected requestAccept(): void {
    if (!this.canAccept()) {
      return;
    }
    this.acceptRequested.emit();
  }

  protected requestReject(): void {
    this.rejectRequested.emit();
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

  protected canAccept(): boolean {
    const sections = this.sections();
    const mandatorySections = sections.filter(section => !this.isSectionOptional(section));
    return !this.viewOnly
      && !this.loading
      && Boolean(this.activeRevision())
      && sections.length > 0
      && mandatorySections.every(section => this.approvedSectionIds.has(section.id));
  }

  protected isSectionOptional(section: HelpCenterSection): boolean {
    return section.optional === true;
  }

  protected headerColorClass(): string {
    return `entry-consent-header-${this.normalizeHeaderColor(this.activeRevision()?.headerColor)}`;
  }

  protected onAccordionKeydown(sectionId: string, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.toggleAccordionSection(sectionId, event);
  }

  private normalizeHeaderColor(value: string | null | undefined): string {
    const normalized = `${value ?? ''}`.trim();
    switch (normalized) {
      case 'blue':
      case 'green':
      case 'rose':
      case 'violet':
      case 'slate':
        return normalized;
      default:
        return 'amber';
    }
  }
}
