/**
 * The "seat reservation" that lets you survive a page refresh.
 * Stored in sessionStorage on purpose: it survives a refresh of THIS tab, but a second tab
 * (or a friend's browser) gets its own identity, so you can test with several tabs.
 */
const KEY = "ekscreen:session";

export interface Session {
  roomId: string;
  token: string; // secret: proves you are this participant
  username: string;
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    return typeof s.roomId === "string" && typeof s.token === "string" && typeof s.username === "string"
      ? { roomId: s.roomId, token: s.token, username: s.username }
      : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* private mode / storage full: the app still works, it just can't survive a refresh */
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Remembers the last name you typed so you don't retype it (convenience only, no secrets). */
const NAME_KEY = "ekscreen:name";
export const loadName = (): string => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};
export const saveName = (name: string): void => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
};
