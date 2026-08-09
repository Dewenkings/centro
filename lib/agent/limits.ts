export const MAX_PARTICIPANTS = 4;
export const MAX_CANDIDATES = 5;

export function limitParticipants<T>(items: T[]): T[] {
  return items.slice(0, MAX_PARTICIPANTS);
}

export function limitCandidates<T>(items: T[]): T[] {
  return items.slice(0, MAX_CANDIDATES);
}
