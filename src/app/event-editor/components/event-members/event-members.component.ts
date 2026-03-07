import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import type { ActivityMemberEntry } from '../../../shared/app-types';

@Component({
  selector: 'app-event-members',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="members-section">
      <div class="members-header">
        <h3>Members</h3>
        <span class="member-count">{{ members.length }}</span>
      </div>
      <div class="members-list" *ngIf="members.length; else emptyState">
        <div class="member-item" *ngFor="let member of members.slice(0, 5)">
          <span class="member-initials">{{ member.initials }}</span>
          <span class="member-name">{{ member.name }}</span>
          <span class="member-role">{{ member.role }}</span>
        </div>
      </div>
      <button *ngIf="members.length > 5" type="button" class="view-all-btn" (click)="viewAll.emit()">
        View all {{ members.length }} members
      </button>
      <div class="pending-count" *ngIf="pendingCount > 0">
        {{ pendingCount }} pending request{{ pendingCount > 1 ? 's' : '' }}
      </div>
      <ng-template #emptyState>
        <div class="empty-state">No members yet</div>
      </ng-template>
    </div>
  `,
  styles: [`
    .members-section { padding: 16px; }
    .members-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
      h3 { margin: 0; font-size: 16px; font-weight: 500; }
    }
    .member-count {
      background: #007bff; color: white; font-size: 12px; padding: 2px 8px; border-radius: 10px;
    }
    .members-list { display: flex; flex-direction: column; gap: 8px; }
    .member-item {
      display: flex; align-items: center; gap: 8px; padding: 8px;
      background: #f8f9fa; border-radius: 4px;
    }
    .member-initials {
      width: 32px; height: 32px; background: #6c757d; color: white;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 500;
    }
    .member-name { flex: 1; font-size: 14px; }
    .member-role { font-size: 12px; color: #666; }
    .view-all-btn {
      width: 100%; margin-top: 12px; padding: 8px; background: white; border: 1px solid #ddd;
      border-radius: 4px; cursor: pointer; font-size: 13px;
      &:hover { background: #f8f9fa; }
    }
    .pending-count {
      margin-top: 8px; font-size: 13px; color: #dc3545;
    }
    .empty-state { text-align: center; color: #999; padding: 20px; }
  `]
})
export class EventMembersComponent {
  @Input() members: ActivityMemberEntry[] = [];
  @Input() pendingCount = 0;
  @Input() readOnly = false;
  
  @Output() viewAll = new EventEmitter<void>();
}
