import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import type * as AppTypes from '../../../core/base/models';
import type * as ProfileContracts from '../../../core/contracts/profile.interface';

@Component({
  selector: 'app-topic-picker-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule
  ],
  templateUrl: './topic-picker-popup.component.html',
  styleUrl: './topic-picker-popup.component.scss'
})
export class TopicPickerPopupComponent implements OnChanges {
  @Input() open = false;
  @Input() title = 'Topics';
  @Input() groups: readonly ProfileContracts.InterestOptionGroup[] = [];
  @Input() selected: readonly string[] = [];
  @Input() multiple = true;
  @Input() maxSelections = 5;
  @Input() closeOnSelect = false;

  @Output() readonly selectedChange = new EventEmitter<string[]>();
  @Output() readonly close = new EventEmitter<void>();

  protected activeGroupIndex = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['groups']) {
      this.activeGroupIndex = this.clampGroupIndex(this.activeGroupIndex);
    }
    if (changes['open']?.currentValue === true || changes['selected']) {
      const selectedGroupIndex = this.selectedTopicGroupIndex();
      if (selectedGroupIndex >= 0) {
        this.activeGroupIndex = selectedGroupIndex;
      } else {
        this.activeGroupIndex = this.clampGroupIndex(this.activeGroupIndex);
      }
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!this.open || keyboardEvent.defaultPrevented) {
      return;
    }
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    this.requestClose();
  }

  protected requestClose(event?: Event): void {
    event?.stopPropagation();
    this.close.emit();
  }

  protected isSelected(option: string): boolean {
    const normalizedOption = this.normalizeTopic(option);
    return this.selected.some(item => this.normalizeTopic(item) === normalizedOption);
  }

  protected topicToneClass(topic: string): string {
    const normalizedTopic = this.normalizeTopic(topic);
    if (!normalizedTopic) {
      return '';
    }
    for (const group of this.groups) {
      if (group.options.some(option => this.normalizeTopic(option) === normalizedTopic)) {
        return group.toneClass;
      }
    }
    return '';
  }

  protected topicLabel(topic: string): string {
    return `#${topic.replace(/^#+/, '')}`;
  }

  protected activeGroup(): ProfileContracts.InterestOptionGroup | null {
    return this.groups[this.clampGroupIndex(this.activeGroupIndex)] ?? null;
  }

  protected selectGroup(index: number, event?: Event): void {
    event?.stopPropagation();
    this.activeGroupIndex = this.clampGroupIndex(index);
  }

  protected isActiveGroup(index: number): boolean {
    return this.clampGroupIndex(this.activeGroupIndex) === index;
  }

  protected toggleOption(option: string, event?: Event): void {
    event?.stopPropagation();
    const normalizedOption = this.normalizeTopic(option);
    if (!normalizedOption) {
      return;
    }

    if (!this.multiple) {
      const next = this.isSelected(option) ? [] : [option];
      this.selectedChange.emit(next);
      if (this.closeOnSelect) {
        this.close.emit();
      }
      return;
    }

    const current = [...this.selected];
    const existingIndex = current.findIndex(item => this.normalizeTopic(item) === normalizedOption);
    if (existingIndex >= 0) {
      current.splice(existingIndex, 1);
      this.selectedChange.emit(current);
      return;
    }

    if (current.length >= Math.max(1, Math.trunc(this.maxSelections))) {
      return;
    }

    this.selectedChange.emit([...current, option]);
  }

  protected removeOption(option: string, event?: Event): void {
    event?.stopPropagation();
    const normalizedOption = this.normalizeTopic(option);
    this.selectedChange.emit(this.selected.filter(item => this.normalizeTopic(item) !== normalizedOption));
  }

  private normalizeTopic(value: string): string {
    return value.trim().replace(/^#+/, '').toLowerCase();
  }

  private selectedTopicGroupIndex(): number {
    for (const selectedTopic of this.selected) {
      const normalizedSelected = this.normalizeTopic(selectedTopic);
      if (!normalizedSelected) {
        continue;
      }
      const groupIndex = this.groups.findIndex(group =>
        group.options.some(option => this.normalizeTopic(option) === normalizedSelected)
      );
      if (groupIndex >= 0) {
        return groupIndex;
      }
    }
    return -1;
  }

  private clampGroupIndex(index: number): number {
    if (this.groups.length === 0) {
      return 0;
    }
    return Math.min(Math.max(0, Math.trunc(Number(index) || 0)), this.groups.length - 1);
  }
}
