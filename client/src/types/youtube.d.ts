// Minimal typings for the parts of the YouTube IFrame API we use.
// Written by hand so we don't have to install @types/youtube (saves disk space).
export {};

declare global {
  namespace YT {
    interface PlayerEvent { target: Player }
    interface OnStateChangeEvent { target: Player; data: number }
    interface PlayerOptions {
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: PlayerEvent) => void;
        onStateChange?: (e: OnStateChangeEvent) => void;
      };
    }
    class Player {
      constructor(element: HTMLElement, options: PlayerOptions);
      loadVideoById(args: { videoId: string; startSeconds?: number }): void;
      cueVideoById(args: { videoId: string; startSeconds?: number }): void;
      playVideo(): void;
      pauseVideo(): void;
      stopVideo(): void;
      seekTo(seconds: number, allowSeekAhead: boolean): void;
      getCurrentTime(): number;
      getDuration(): number;
      getPlayerState(): number;
      setVolume(volume: number): void;
      mute(): void;
      unMute(): void;
      destroy(): void;
    }
  }

  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}