import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  inject
} from '@angular/core';
import { from } from 'rxjs';

import type {
  NotificationBucket,
  NotificationDto,
  NotificationListFilters
} from '../../../core/contracts/notification.interface';
import type { ListQuery } from '../../../core/contracts/list.interface';
import {
  NotificationSingleRowConverter
} from '../../converters/notification-single-row.converter';
import { DialogStore } from '../../context/stores/dialog.store';
import { NotificationCenterStore } from '../../context/stores/notification-center.store';
import {
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuTrigger
} from '../core/menu';
import {
  PopupComponent,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../core/popup';
import {
  SmartListComponent,
  type SmartListConfig,
  type SmartListLoadPage
} from '../core/smart-list';
import {
  SingleRowComponent
} from '../core/smart-list/card/single-row/single-row.component';
import type {
  SingleRowData
} from '../core/smart-list/card/card.types';

interface NotificationRowMenuContext extends Record<string, unknown> {
  notification: NotificationDto;
  action?: { id?: string };
}

type NotificationHeaderMenuContext =
  | { action: 'set-bucket'; bucket: NotificationBucket }
  | { action: 'toggle-muted' };

@Component({
  selector: 'app-notification-center-popup',
  standalone: true,
  imports: [
    PopupComponent,
    SmartListComponent,
    SingleRowComponent
  ],
  templateUrl: './notification-center-popup.component.html',
  styleUrl: './notification-center-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationCenterPopupComponent {
  @ViewChild('notificationsSmartList')
  private notificationsSmartList?: SmartListComponent<NotificationDto, NotificationListFilters>;

  protected readonly store = inject(NotificationCenterStore);
  private readonly dialogStore = inject(DialogStore);
  private readonly converter = new NotificationSingleRowConverter();

  protected readonly query = computed<Partial<ListQuery<NotificationListFilters>>>(() => ({
    page: 0,
    pageSize: 20,
    sort: 'createdAt',
    direction: 'desc',
    filters: { bucket: this.store.bucket() }
  }));

  private readonly bucketMenuItems = computed<
    readonly AppMenuItem<string, NotificationHeaderMenuContext>[]
  >(() => {
    const bucket = this.store.bucket();
    const unreadCount = this.store.unreadCount();
    return (['new', 'all'] as const).map(value => ({
      id: `notification-bucket:${value}`,
      kind: 'radio',
      label: value === 'new' ? 'New' : 'All',
      icon: value === 'new' ? 'fiber_new' : 'notifications',
      palette: value === 'new' ? 'rose' : 'violet',
      surface: 'tinted',
      active: bucket === value,
      counter: value === 'new' && unreadCount > 0
        ? { value: unreadCount, max: 99 }
        : null,
      counterTone: value === 'new' ? 'alert' : 'default',
      ariaLabel: value === 'new'
        ? `${unreadCount} new notifications`
        : 'All notifications',
      context: { action: 'set-bucket', bucket: value }
    }));
  });

  protected readonly smartListConfig: SmartListConfig<
    NotificationDto,
    NotificationListFilters
  > = {
    pageSize: 20,
    defaultView: 'list',
    defaultSort: 'createdAt',
    defaultDirection: 'desc',
    defaultFilters: { bucket: 'new' },
    emptyLabel: 'No notifications',
    emptyDescription: 'New messages and updates will appear here.',
    showStickyHeader: false,
    listLayout: 'stack',
    snapMode: 'none',
    scrollPaddingTop: '0.5rem',
    pollIntervalMs: () => this.store.pollIntervalMs(),
    headerProgress: {
      enabled: true,
      placement: 'inline',
      tone: 'accent'
    },
    cacheable: {
      identity: item => item.id
    },
    containerClass: {
      'notification-center-smart-list': true
    },
    trackBy: (_index, item) => item.id
  };

  protected readonly loadPage: SmartListLoadPage<
    NotificationDto,
    NotificationListFilters
  > = (query, context) => from(this.store.queryPage(query, context?.signal));

  protected popupModel(): PopupModel<NotificationHeaderMenuContext> {
    const muted = this.store.muted();
    const unreadCount = this.store.unreadCount();
    return {
      title: 'Notifications',
      subtitle: unreadCount === 1 ? '1 new notification' : `${unreadCount} new notifications`,
      ariaLabel: 'Notifications',
      closeAriaLabel: 'Close notifications',
      size: 'wide',
      height: 'full',
      bodyLayout: 'fill',
      headerTone: 'accent',
      headerPalette: 'violet',
      headerControls: [
        {
          kind: 'menu',
          id: 'notification-bucket',
          trigger: this.bucketMenuTrigger(),
          items: this.bucketMenuItems(),
          panelAlign: 'end'
        },
        {
          kind: 'menu',
          id: 'notification-attention-preference',
          menuKind: 'inline',
          closeOnSelect: false,
          items: [
            {
              id: 'notification-attention-toggle',
              kind: 'toggle',
              icon: muted ? 'notifications_off' : 'notifications_active',
              layout: 'icon',
              palette: muted ? 'slate' : 'violet',
              active: muted,
              checked: muted,
              closeOnSelect: false,
              ariaLabel: muted ? 'Unmute notification alerts' : 'Mute notification alerts',
              context: { action: 'toggle-muted' }
            }
          ]
        }
      ],
      onClose: () => this.store.close(),
      onMenuSelect: event => this.onHeaderMenuSelect(event)
    };
  }

  protected notificationRow(notification: NotificationDto): SingleRowData<NotificationDto> {
    return this.converter.convert(notification, {
      progressRing: this.store.isMarkReadPending(notification.id)
    });
  }

  protected rowMenuContext(notification: NotificationDto): NotificationRowMenuContext {
    return { notification };
  }

  protected onRowMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as NotificationRowMenuContext | undefined;
    const notification = context?.notification;
    const actionId = `${context?.action?.id ?? event.id ?? ''}`.trim();
    if (
      !notification
      || actionId !== 'markNotificationRead'
      || notification.readAtIso
      || this.store.isMarkReadPending(notification.id)
    ) {
      return;
    }
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    void this.markRead(notification);
  }

  private onHeaderMenuSelect(
    event: PopupMenuSelectEvent<NotificationHeaderMenuContext>
  ): void {
    if (event.itemSelect.context?.action === 'set-bucket') {
      const bucket = event.itemSelect.context.bucket;
      if (bucket !== this.store.bucket()) {
        this.store.setBucket(bucket);
      }
      return;
    }
    if (
      event.itemSelect.id !== 'notification-attention-toggle'
      || event.itemSelect.context?.action !== 'toggle-muted'
    ) {
      return;
    }
    event.itemSelect.sourceEvent.preventDefault();
    event.itemSelect.sourceEvent.stopPropagation();
    this.confirmMutedChange(!this.store.muted());
  }

  private bucketMenuTrigger(): AppMenuTrigger {
    const bucket = this.store.bucket();
    const unreadCount = this.store.unreadCount();
    return {
      label: bucket === 'new' ? 'New' : 'All',
      icon: bucket === 'new' ? 'fiber_new' : 'notifications',
      palette: bucket === 'new' ? 'rose' : 'violet',
      layout: 'pill',
      counter: bucket === 'new' && unreadCount > 0
        ? { value: unreadCount, max: 99 }
        : null,
      ariaLabel: bucket === 'new'
        ? `${unreadCount} new notifications`
        : 'All notifications'
    };
  }

  private confirmMutedChange(muted: boolean): void {
    this.dialogStore.open({
      title: muted ? 'Mute notification alerts?' : 'Unmute notification alerts?',
      message: muted
        ? 'New notifications will still be counted and saved, but the floating alert button will stay hidden until you unmute it.'
        : 'The floating alert button can appear again when a new notification arrives.',
      confirmLabel: muted ? 'Mute alerts' : 'Unmute alerts',
      busyConfirmLabel: muted ? 'Muting...' : 'Unmuting...',
      confirmTone: muted ? 'warning' : 'accent',
      confirmPalette: muted ? 'warning' : 'violet',
      ringPerimeter: 112,
      onConfirm: async () => {
        await this.store.setMuted(muted);
      }
    });
  }

  private async markRead(notification: NotificationDto): Promise<void> {
    try {
      const updated = await this.store.markRead(notification.id);
      if (this.store.bucket() === 'new') {
        this.notificationsSmartList?.removeVisibleItemByIdentity(notification.id, {
          totalDelta: -1
        });
        return;
      }
      this.notificationsSmartList?.patchVisibleItem(
        item => item.id === notification.id,
        () => updated
      );
    } catch (error) {
      this.dialogStore.openInfo(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Unable to mark this notification as read.',
        {
          title: 'Notification update failed',
          confirmTone: 'danger'
        }
      );
    }
  }
}
