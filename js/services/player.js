/**
 * PusztaPlay — Player Service
 * FEAT: HLS és MP4/MKV (progresszív) lejátszás szétválasztása
 *       destroy() hívható navigáció előtt a session leállításához
 */

let hlsInstance = null;
let currentVideo = null;
let progressTimer = null;

function clearPlayer() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
  if (hlsInstance) {
    hlsInstance.stopLoad();
    hlsInstance.detachMedia();
    hlsInstance.destroy();
    hlsInstance = null;
  }
  if (currentVideo) {
    currentVideo.pause();
    currentVideo.removeAttribute('src');
    currentVideo.load(); // abort pending network requests
  }
}

function isHlsUrl(url) {
  return /\.m3u8?(\?.*)?$/i.test(url);
}

export const playerService = {
  init(videoElement) {
    currentVideo = videoElement;
    return !!currentVideo;
  },

  async load(session) {
    if (!currentVideo) throw new Error('Nincs video elem.');
    if (!session?.streamUrl) throw new Error('Nincs stream URL.');

    clearPlayer();
    const url = session.streamUrl;
    const useHls = isHlsUrl(url);

    return new Promise((resolve, reject) => {
      const onReady = () => {
        currentVideo.play().catch(() => {});
        resolve(session);
      };

      if (useHls) {
        if (window.Hls && window.Hls.isSupported()) {
          hlsInstance = new window.Hls();
          hlsInstance.loadSource(url);
          hlsInstance.attachMedia(currentVideo);
          hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, onReady);
          hlsInstance.on(window.Hls.Events.ERROR, (_, data) => {
            if (data?.fatal) reject(new Error('HLS fatal error: ' + data.type));
          });
        } else if (currentVideo.canPlayType('application/vnd.apple.mpegurl')) {
          currentVideo.src = url;
          currentVideo.addEventListener('loadedmetadata', onReady, { once: true });
          currentVideo.addEventListener('error', () => reject(new Error('Native HLS error')), { once: true });
        } else {
          reject(new Error('A böngésző nem támogatja a HLS lejátszást.'));
        }
      } else {
        currentVideo.src = url;
        currentVideo.load();
        currentVideo.addEventListener('canplay', onReady, { once: true });
        currentVideo.addEventListener('error', () => {
          const code = currentVideo.error?.code;
          reject(new Error(`Videó betöltési hiba (kód: ${code}).`));
        }, { once: true });
      }
    });
  },

  play()  { currentVideo?.play?.().catch(() => {}); },
  pause() { currentVideo?.pause?.(); },

  setVolume(value) {
    if (currentVideo) currentVideo.volume = Math.min(1, Math.max(0, value));
  },

  /**
   * Seek a VOD / sorozat tartalomban adott másodpercre.
   * Live streameknél a backend úgyis ignorálja / felülírja az offsetet,
   * ezért ott nincs külön logika.
   */
  seek(seconds) {
    if (!currentVideo) return;
    if (!Number.isFinite(seconds) || seconds < 0) return;
    try {
      currentVideo.currentTime = seconds;
    } catch (_) {}
  },

  onProgress(cb) {
    if (!currentVideo) return;
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      const duration = currentVideo.duration;
      const current  = currentVideo.currentTime || 0;
      const ratio    = duration && Number.isFinite(duration) ? (current / duration) * 100 : 0;
      cb({ current, duration, ratio });
    }, 300);
  },

  /** Teljes leállítás + hálózati kérések megszakítása – hívd navigáció ELŐTT */
  destroy() {
    clearPlayer();
    currentVideo = null;
  }
};
