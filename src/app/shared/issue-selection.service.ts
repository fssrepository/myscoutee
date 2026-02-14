import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class IssueSelectionService {
  readonly selectedIssue = signal<string | null>(null);
  readonly selectedIssueLabel = signal<string | null>(null);

  setIssue(label: string | null, detail: string | null): void {
    this.selectedIssueLabel.set(label);
    this.selectedIssue.set(detail);
  }
}
