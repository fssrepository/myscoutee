import { AppLocationService } from './app-location.service';

describe('AppLocationService session-owned persistence', () => {
  it('does not persist streamed coordinates for a demo session', () => {
    const service = Object.create(AppLocationService.prototype) as {
      pendingCoordinatesByUserId: Map<string, { latitude: number; longitude: number }>;
      syncingUserIds: Set<string>;
      sessionService: {
        currentSession: () => { kind: 'demo'; userId: string };
      };
      isLocalUserRouteEnabled: ReturnType<typeof vi.fn>;
      flushPendingLocationSync: ReturnType<typeof vi.fn>;
      queueLocationSyncForActiveUser: (
        userId: string,
        activeUser: { id: string; admin: boolean },
        coordinates: { latitude: number; longitude: number }
      ) => void;
    };
    service.pendingCoordinatesByUserId = new Map();
    service.syncingUserIds = new Set();
    service.sessionService = {
      currentSession: () => ({ kind: 'demo', userId: 'demo-member' })
    };
    service.isLocalUserRouteEnabled = vi.fn().mockReturnValue(false);
    service.flushPendingLocationSync = vi.fn();

    service.queueLocationSyncForActiveUser(
      'demo-member',
      { id: 'demo-member', admin: false },
      { latitude: 48.8566, longitude: 2.3522 }
    );

    expect(service.pendingCoordinatesByUserId.size).toBe(0);
    expect(service.flushPendingLocationSync).not.toHaveBeenCalled();
  });
});
