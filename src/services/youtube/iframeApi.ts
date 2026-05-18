declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let loadPromise: Promise<any> | null = null;

export function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(timer);
        resolve(window.YT);
        return;
      }

      if (Date.now() - startedAt > 15000) {
        window.clearInterval(timer);
        reject(new Error('YouTube player failed to load.'));
      }
    }, 100);
  });

  return loadPromise;
}
