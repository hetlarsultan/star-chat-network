/** Shared chronological sort for chat messages (oldest → newest). */
export interface HasCreatedAt {
  created_at: string;
  id?: string;
}

export function sortByCreatedAt<T extends HasCreatedAt>(messages: T[]): T[] {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/** Append a message and return a freshly sorted, deduped list. */
export function appendSorted<T extends HasCreatedAt>(prev: T[], msg: T): T[] {
  if (msg.id && prev.some(m => m.id === msg.id)) return prev;
  return sortByCreatedAt([...prev, msg]);
}
