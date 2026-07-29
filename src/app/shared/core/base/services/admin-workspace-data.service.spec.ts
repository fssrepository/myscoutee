import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../../environments/environment';
import { HttpAdminWorkspaceService } from '../../http/services/admin-workspace.service';
import { LocalAdminWorkspaceService } from '../../local/source/services/admin-workspace.service';
import { ShareTokensService } from './share-tokens.service';
import { SessionService, type AppSession } from './session.service';
import { UsersService } from './users.service';
import { AdminWorkspaceDataService } from './admin-workspace-data.service';

describe('AdminWorkspaceDataService route boundary', () => {
  const originalActivitiesDataSource = environment.activitiesDataSource;
  const originalFirebaseLoginEnabled = environment.firebaseLoginEnabled;
  const startDemoSession = vi.fn();
  let currentSession: AppSession | null;

  beforeEach(() => {
    currentSession = null;
    startDemoSession.mockReset();
    TestBed.configureTestingModule({
      providers: [
        AdminWorkspaceDataService,
        { provide: HttpAdminWorkspaceService, useValue: {} },
        { provide: LocalAdminWorkspaceService, useValue: {} },
        { provide: ShareTokensService, useValue: {} },
        { provide: UsersService, useValue: {} },
        {
          provide: SessionService,
          useValue: {
            currentSession: () => currentSession,
            startDemoSession
          }
        }
      ]
    });
  });

  afterEach(() => {
    environment.activitiesDataSource = originalActivitiesDataSource;
    environment.firebaseLoginEnabled = originalFirebaseLoginEnabled;
    TestBed.resetTestingModule();
  });

  it('starts a Java-backed demo session in every HTTP selector build', () => {
    environment.activitiesDataSource = 'http';
    environment.firebaseLoginEnabled = false;

    const service = TestBed.inject(AdminWorkspaceDataService);
    service.prepareSelectedAdminSession('admin-demo');

    expect(service.shouldUseLocalAdminHelpSession).toBe(false);
    expect(startDemoSession).toHaveBeenCalledWith('admin-demo');
  });

  it('does not replace an authenticated Firebase session with a demo session', () => {
    environment.activitiesDataSource = 'http';
    environment.firebaseLoginEnabled = true;
    currentSession = {
      kind: 'firebase',
      profile: {
        id: 'firebase-admin',
        name: 'Admin',
        email: 'admin@example.com',
        initials: 'AD'
      }
    };

    TestBed.inject(AdminWorkspaceDataService).prepareSelectedAdminSession('cached-admin');

    expect(startDemoSession).not.toHaveBeenCalled();
  });

  it('keeps selector preparation browser-local only in an explicit local build', () => {
    environment.activitiesDataSource = 'local';
    environment.firebaseLoginEnabled = true;

    const service = TestBed.inject(AdminWorkspaceDataService);
    service.prepareSelectedAdminSession('admin-local');

    expect(service.shouldUseLocalAdminHelpSession).toBe(true);
    expect(startDemoSession).not.toHaveBeenCalled();
  });
});
