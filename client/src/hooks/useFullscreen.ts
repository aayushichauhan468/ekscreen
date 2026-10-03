import { useCallback, useEffect, useState, type RefObject } from "react";

/** Safari (iPad / older macOS) only has the prefixed versions of the Fullscreen API. */
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

/**
 * Fullscreen for ONE element (we pass the box that holds the video AND our overlays).
 * We fullscreen that box, not YouTube's iframe, so our click shield, the floating reactions and the
 * "Join the screening" button all keep working. (YouTube's own fullscreen button is disabled: fs: 0.)
 * `supported` is false on iPhones (Safari only allows fullscreen for a bare <video>), so the caller hides the button.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const doc = document as FsDocument;
  const supported = !!(document.fullscreenEnabled || (doc as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // The browser also leaves fullscreen by itself (Esc key), so listen instead of trusting our own button.
  useEffect(() => {
    const sync = () => setIsFullscreen((doc.fullscreenElement ?? doc.webkitFullscreenElement) === ref.current);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [doc, ref]);

  const toggle = useCallback(async () => {
    const el = ref.current as FsElement | null;
    if (!el) return;
    try {
      if ((doc.fullscreenElement ?? doc.webkitFullscreenElement) === el) {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else {
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      /* the browser refused (e.g. not triggered by a click): nothing to do */
    }
  }, [doc, ref]);

  return { supported, isFullscreen, toggle };
}
