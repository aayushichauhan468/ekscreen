// Everything about invite links lives here: build a link, read the room code back out of the
// address bar, and clean up whatever the user types or pastes into the "Room code" box.

const CODE_LENGTH = 6; // must match ROOM_CODE_LENGTH on the server

/** Keep only letters/numbers, uppercase them, cut to 6. "gc-qt jt" -> "GCQTJT". */
function clean(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, CODE_LENGTH);
}

/**
 * Turns anything the user gives us into a room code.
 *  - A pasted invite link ("http://localhost:5173/?room=GCQTJT") -> reads the ?room= value -> "GCQTJT".
 *  - A plain code (with or without spaces/lowercase)             -> cleaned -> "GCQTJT".
 *  - A link that has no ?room= in it                             -> "" (better empty than a wrong code).
 * The old code just stripped punctuation from the whole link, which made "HTTPLO" - that was the bug.
 */
export function extractRoomCode(raw: string): string {
  const text = raw.trim();
  if (/[:/?=]/.test(text)) {
    const match = text.match(/[?&]room=([a-zA-Z0-9]+)/i);
    return match ? clean(match[1]) : "";
  }
  return clean(text);
}

/** Room code in the current address bar (?room=ABC123), or null if there is none. */
export function roomFromUrl(): string | null {
  const code = clean(new URLSearchParams(window.location.search).get("room") ?? "");
  return code.length === CODE_LENGTH ? code : null;
}

/** Put the room code in the address bar (no page reload), or remove it when null. */
export function setRoomInUrl(roomId: string | null): void {
  const url = new URL(window.location.href);
  if (roomId) url.searchParams.set("room", roomId);
  else url.searchParams.delete("room");
  window.history.replaceState(null, "", url.toString());
}

/** The shareable link for a room, e.g. http://localhost:5173/?room=GCQTJT */
export function inviteLink(roomId: string): string {
  return `${window.location.origin}/?room=${roomId}`;
}