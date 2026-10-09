import { signal } from '@angular/core';

const unavailable = signal(false);
let readiness: boolean | null = null;
export const backendUnavailable = unavailable.asReadonly();

// Connectivity indication only: business/auth failures still mean a reachable
// server. This never disables actions, retries writes or changes sessions.
export function reportBackendStatus(status: number): void {
  unavailable.set(readiness === false || [0, 502, 503, 504].includes(status));
}

export function reportBackendReadiness(ready: boolean): void {
  readiness = ready;
  unavailable.set(!ready);
}
