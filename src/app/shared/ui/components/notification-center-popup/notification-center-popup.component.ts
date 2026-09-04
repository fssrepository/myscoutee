import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  inject
} from '@angular/core';
import { from } from 'rxjs';

import { AppUtils } from '../../../app-utils';
import { I18nService } from '../../../core';
import * as AppConstants from '../../../core/common/constants';
import type {
  NotificationBucket,
  NotificationDto,
  NotificationListFilters,
  NotificationSyncRequestDto
} from '../../../core/contracts/notification.interface';
import type { ListQuery } from '../../../core/contracts/list.interface';
import {
  NotificationSingleRowConverter
} from '../../converters/notification-single-row.converter';
import { DialogStore } from '../../context/stores/dialog.store';
import { ActivitiesPopupStore } from '../../context/stores/activities-popup.store';
import { EventSubeventsPopupStore } from '../../context/stores/event-subevents-popup.store';
import { NotificationCenterStore } from '../../context/stores/notification-center.store';
import { SubEventResourcePopupStore } from '../../context/stores/sub-event-resource-popup.store';
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
  type SmartListLoadPage,
  type SmartListPollDeltaSnapshot
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
  private readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly eventSubeventsStore = inject(EventSubeventsPopupStore);
  private readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  private readonly i18n = inject(I18nService);
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
    pollDelta: {
      revision: item => item.revision,
      position: item => item.createdAtIso,
      load: (query, snapshot, context) => from(this.store.sync(
        this.notificationSyncRequest(query.filters?.bucket, query.pageSize, snapshot),
        context?.signal
      ))
    },
    headerProgress: {
      enabled: true,
      placement: 'inline',
      tone: 'accent'
    },
    cacheable: {
      identity: item => item.id
    },
    sortable: {
      sortKey: item => [
        -this.notificationDateMs(item.createdAtIso),
        item.id
      ]
    },
    groupBy: item => this.notificationDateGroupLabel(item.createdAtIso),
    showFirstGroupMarker: true,
    containerClass: {
      'notification-center-smart-list': true
    },
    trackBy: (_index, item) => item.id
  };

  private notificationSyncRequest(
    bucket: NotificationBucket | undefined,
    pageSize: number,
    snapshot: SmartListPollDeltaSnapshot
  ): NotificationSyncRequestDto {
    return {
      bucket: bucket === 'new' ? 'new' as const : 'all' as const,
      limit: Math.max(1, Math.trunc(Number(pageSize) || 20)),
      knownItems: snapshot.knownItems.map(item => ({
        id: item.id,
        revision: Math.max(1, Math.trunc(Number(item.revision) || 1))
      })),
      loadedTail: snapshot.loadedTail
        ? {
            id: snapshot.loadedTail.id,
            createdAtIso: `${snapshot.loadedTail.position}`
          }
        : null
    };
  }

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
      progressRing: this.store.isMarkReadPending(notification.id),
      translate: (key, fallback) => this.i18n.translate(key, fallback)
    });
  }

  private notificationDateGroupLabel(value: string): string {
    const groupDate = new Date(value);
    return Number.isNaN(groupDate.getTime())
      ? 'Date unavailable'
      : AppUtils.smartListDayLabel(groupDate);
  }

  private notificationDateMs(value: string): number {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
  }

  protected rowMenuContext(notification: NotificationDto): NotificationRowMenuContext {
    return { notification };
  }

  protected onRowMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as NotificationRowMenuContext | undefined;
    const notification = context?.notification;
    const actionId = `${context?.action?.id ?? event.id ?? ''}`.trim();
    if (!notification) {
      return;
    }
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (actionId === 'markNotificationRead') {
      if (notification.readAtIso || this.store.isMarkReadPending(notification.id)) {
        return;
      }
      void this.markRead(notification);
      return;
    }
    if (actionId === NotificationSingleRowConverter.targetActionId(notification)) {
      void this.openNotificationTarget(notification, actionId);
    }
  }

  private async openNotificationTarget(
    notification: NotificationDto,
    actionId: string
  ): Promise<void> {
    const eventId = NotificationSingleRowConverter.eventId(notification);
    if (!eventId) {
      return;
    }
    const payload = notification.payload;
    const eventTitle = `${payload?.['eventTitle'] ?? notification.title ?? ''}`.trim() || 'Event';
    const invitation = actionId === 'openNotificationInvitation';
    this.store.close();
    try {
      await this.activitiesStore.ensureActivitiesPopupLoaded();
      this.activitiesStore.openActivities(
        'events',
        invitation ? 'invitations' : 'active-events'
      );
      this.eventSubeventsStore.openEventSubeventsListPopup({
        eventId,
        host: 'activities',
        target: 'events',
        title: eventTitle,
        startAtIso: `${payload?.['startAtIso'] ?? ''}`.trim() || null,
        editorAction: 'view'
      });
      const resourceType = this.notificationResourceType(actionId);
      const ownerId = `${payload?.['ownerId'] ?? ''}`.trim();
      const subEventId = `${payload?.['subEventId'] ?? ''}`.trim();
      if (!resourceType || !ownerId || !subEventId) {
        return;
      }
      this.resourcePopupStore.requestSubEventResourcePopup({
        type: resourceType,
        ownerId,
        eventId,
        subEventId,
        parentTitle: eventTitle,
        popupHeader: {
          title: `${eventTitle} - ${resourceType}`
        },
        subEventHeader: {
          title: resourceType
        }
      });
    } catch (error) {
      this.dialogStore.openInfo(
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Unable to open this notification.',
        {
          title: 'Notification target unavailable',
          confirmTone: 'danger'
        }
      );
    }
  }

  private notificationResourceType(actionId: string): AppConstants.AssetType | null {
    switch (actionId) {
      case 'openNotificationTransport':
        return AppConstants.ASSET_TYPE_TRANSPORT;
      case 'openNotificationAccommodation':
        return AppConstants.ASSET_TYPE_ACCOMMODATION;
      case 'openNotificationSupplies':
        return AppConstants.ASSET_TYPE_SUPPLIES;
      default:
        return null;
    }
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
