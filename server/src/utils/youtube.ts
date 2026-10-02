const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accepts a raw 11-character video ID or any common YouTube link
 * (watch?v=, youtu.be/, /embed/, /shorts/, /live/) and returns the video ID, or null.
 */
export function extractYouTubeId(input: string): string | null {
  const text = input.trim();
  if (VIDEO_ID.test(text)) return text;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  let candidate: string | null = null;

  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (["youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const [, kind, id] = url.pathname.split("/");
      if (["embed", "shorts", "live", "v"].includes(kind)) candidate = id ?? null;
    }
  }

  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}
