import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, effect, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

import { I18nService, TermsPolicyService } from '../../../core';
import type { HelpCenterSection } from '../../../core/base/models';
import { LazyBgImageDirective } from '../../directives';
import { ProgressIndicatorComponent } from '../progress-indicator';

export type TermsPolicyShell = 'page' | 'popup';

@Component({
  selector: 'app-terms-policy',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatRippleModule, LazyBgImageDirective, ProgressIndicatorComponent],
  templateUrl: './terms-policy.component.html',
  styleUrl: './terms-policy.component.scss'
})
export class TermsPolicyComponent implements OnInit, OnChanges {
  private readonly termsPolicy = inject(TermsPolicyService);
  private readonly i18n = inject(I18nService);

  @Input() open = true;
  @Input() lazy = true;
  @Input() shell: TermsPolicyShell = 'page';
  @Input() loading = false;

  @Output() readonly closeRequested = new EventEmitter<void>();

  protected readonly activeRevision = this.termsPolicy.activeRevision;
  protected readonly versionLabel = this.termsPolicy.activeVersionLabel;
  protected readonly serviceLoading = this.termsPolicy.loading;
  protected readonly sections = computed<HelpCenterSection[]>(() => this.activeRevision()?.sections ?? []);
  protected openSectionId = '';

  constructor() {
    effect(() => {
      this.syncOpenSection(this.sections());
    });
  }

  ngOnInit(): void {
    if (this.open) {
      void this.prepareOpen();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['open'] || changes['lazy']) && this.open) {
      void this.prepareOpen();
    }
  }

  protected effectiveLoading(): boolean {
    return this.loading || this.serviceLoading();
  }

  protected isPopupShell(): boolean {
    return this.shell === 'popup';
  }

  protected requestClose(): void {
    this.closeRequested.emit();
  }

  protected toggleSection(sectionId: string, event?: Event): void {
    event?.stopPropagation();
    this.openSectionId = this.openSectionId === sectionId ? '' : sectionId;
  }

  protected onSectionKeydown(sectionId: string, event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    this.toggleSection(sectionId, event);
  }

  protected activeSummaryLabel(): string {
    return this.activeRevision()?.summary || this.uiText('Usage terms');
  }

  protected activeDescriptionLabel(): string {
    return this.activeRevision()?.description || this.uiText('Review the terms that apply when you use MyScoutee features, accounts, events, chats, and community tools.');
  }

  protected headerColorClass(): string {
    return `terms-policy-header-${this.normalizeHeaderColor(this.activeRevision()?.headerColor)}`;
  }

  protected uiText(value: string): string {
    return this.i18n.translate(value);
  }

  private async prepareOpen(): Promise<void> {
    await this.termsPolicy.prepareOpen({ lazy: this.lazy });
    this.syncOpenSection(this.sections());
  }

  private syncOpenSection(sections: readonly HelpCenterSection[]): void {
    if (this.openSectionId && sections.some(section => section.id === this.openSectionId)) {
      return;
    }
    this.openSectionId = sections[0]?.id ?? '';
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
