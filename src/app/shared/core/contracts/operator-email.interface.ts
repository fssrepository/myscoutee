export interface OperatorEmailProvider { id: string; label: string; icon: string; palette: string; }
export interface OperatorEmailConfiguration {
  revision: number; enabled: boolean; providerId: string; fromEmail: string; fromName: string;
  credentialConfigured: boolean; availableProviders: OperatorEmailProvider[];
}
export interface OperatorEmailSave {
  expectedRevision: number; enabled: boolean; providerId: string; fromEmail: string; fromName: string;
  credential: string; clearCredential: boolean;
}
