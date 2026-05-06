export type AuthMode = 'selector' | 'firebase';

export interface FirebaseAuthProfile {
  id: string;
  name: string;
  email: string;
  initials: string;
  imageUrl?: string;
}

export interface EntryConsentState {
  version: string;
  accepted: boolean;
  acceptedAtIso: string;
}

export interface EntryConsentAuditRecord {
  tsIso: string;
  action: 'accepted' | 'rejected';
  version: string;
  source: 'entry';
  userAgent: string;
}
