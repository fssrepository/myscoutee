import type { AdminSeedChatMessageDto, AdminSeedModerationStore } from './admin-seed.models';

export interface AdminModerationSeedContext {
  userImageUrl(userId: string): string | null | undefined;
  chatMessages(ownerUserId: string, chatId: string): AdminSeedChatMessageDto[];
}

export class AdminModerationSeedBuilder {
  static buildSeedDemoModerationStore(context: AdminModerationSeedContext): AdminSeedModerationStore {
    return {
      seededAtIso: new Date().toISOString(),
      reports: [
        {
          id: 'admin-demo-report-chat-kai-001',
          reporterUserId: 'u1',
          reporterName: 'Farkas Anna',
          reporterImageUrl: context.userImageUrl('u1'),
          targetUserId: 'u5',
          handle: 'Lina Park',
          reason: 'Harassment',
          details: 'The reported chat message made another event member feel unsafe and should be reviewed by moderation.',
          eventId: 'a11a802ee0714a21db94ed4e',
          eventTitle: 'Alpine Weekend 2.0',
          eventStartAtIso: '2026-03-04T09:45:00.000Z',
          sourceType: 'chat',
          sourceId: 'c1-4',
          sourceText: 'I can take one extra seat from downtown pickup.',
          chatId: 'c1',
          messageId: 'c1-4',
          chatTitle: 'Driver Split - Alpine Weekend',
          chatMessages: context.chatMessages('u1', 'c1'),
          createdDate: '2026-04-25T11:12:00.000Z'
        },
        {
          id: 'admin-demo-report-event-kai-002',
          reporterUserId: 'u1',
          reporterName: 'Farkas Anna',
          reporterImageUrl: context.userImageUrl('u1'),
          targetUserId: 'u5',
          handle: 'Lina Park',
          reason: 'No-show / unsafe event behavior',
          details: 'The user repeatedly joined event plans and disrupted logistics without updating the host.',
          eventId: 'a11a802ee0714a21db94ed4e',
          eventTitle: 'Alpine Weekend 2.0',
          eventStartAtIso: '2026-03-04T09:45:00.000Z',
          sourceType: 'event',
          sourceId: 'a11a802ee0714a21db94ed4e',
          sourceText: 'Host reported repeated logistics disruption before Alpine Weekend 2.0.',
          createdDate: '2026-04-26T16:35:00.000Z'
        },
        {
          id: 'admin-demo-report-asset-kai-003',
          reporterUserId: 'u4',
          reporterName: 'Maya Stone',
          reporterImageUrl: context.userImageUrl('u4'),
          targetUserId: 'u5',
          handle: 'Lina Park',
          reason: 'Asset misuse',
          details: 'Asset owner asked moderation to review a supplies request before approving future resource sharing.',
          eventId: 'indoor-strategy-social-event',
          eventTitle: 'Indoor Strategy Social',
          eventStartAtIso: '2026-05-02T17:30:00.000Z',
          sourceType: 'asset',
          sourceId: 'f7b9be40d648a5448d018308',
          sourceText: 'Game Night Box request needs moderation review.',
          assetId: 'f7b9be40d648a5448d018308',
          assetType: 'Supplies',
          createdDate: '2026-04-27T09:20:00.000Z'
        }
      ],
      feedback: [
        {
          id: 'admin-demo-feedback-report-status-001',
          userId: 'u1',
          userName: 'Farkas Anna',
          category: 'UX improvement',
          subject: 'Need clearer report status',
          details: 'After reporting a user, I would like to see whether moderation has reviewed the report.',
          createdDate: '2026-04-24T13:20:00.000Z'
        },
        {
          id: 'admin-demo-feedback-event-warn-002',
          userId: 'u5',
          userName: 'Lina Park',
          category: 'Feature request',
          subject: 'Review event behavior faster',
          details: 'Hosts need a way to warn members before blocking them from future participation.',
          createdDate: '2026-04-23T18:05:00.000Z'
        }
      ]
    };
  }
}
