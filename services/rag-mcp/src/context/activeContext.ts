const activeClientsByProfile = new Map<string, string>();

export function setActiveClient(actorProfile: string, clientId: string): void {
  activeClientsByProfile.set(normalizeProfile(actorProfile), clientId.trim());
}

export function getActiveClient(actorProfile: string): string | undefined {
  return activeClientsByProfile.get(normalizeProfile(actorProfile));
}

export function clearActiveContexts(): void {
  activeClientsByProfile.clear();
}

export function listActiveContexts(): Record<string, string> {
  return Object.fromEntries(activeClientsByProfile.entries());
}

function normalizeProfile(actorProfile: string): string {
  return actorProfile.trim() || 'default';
}

