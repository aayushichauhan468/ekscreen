// Loads YouTube's IFrame API script exactly once and hands back the global `YT` object.

let loading: Promise<typeof YT> | null = null;

export function loadYouTubeApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT); // already loaded
  if (loading) return loading; // someone else is already loading it: share that promise

  loading = new Promise((resolve, reject) => {
    // YouTube's script calls this global function when it has finished loading.
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      loading = null; // allow a retry later (e.g. the network was down)
      reject(new Error("Could not load the YouTube player."));
    };
    document.head.appendChild(script);
  });
  return loading;
}