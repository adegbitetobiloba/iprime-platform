import { useEffect, useRef, useState } from "react";

// Embedded YouTube (privacy-enhanced domain) or Vimeo player. Reports the position every few seconds, resumes from startAt,
// and offers playback speed buttons. onProgress(positionSec, durationSec) is throttled here; the server clamps what it receives.
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const REPORT_MS = 5000;

const loaded = {};
function loadScript(src, ready) {
  if (ready()) return Promise.resolve();
  if (loaded[src]) return loaded[src];
  loaded[src] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { delete loaded[src]; reject(new Error("video script failed")); };
    document.head.appendChild(s);
  });
  return loaded[src];
}
const ytReady = () => new Promise((resolve, reject) => {
  if (window.YT && window.YT.Player) return resolve();
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
  loadScript("https://www.youtube.com/iframe_api", () => false).catch(reject);
});

export default function VideoPlayer({ video, startAt = 0, onProgress }) {
  const holder = useRef(null);
  const player = useRef(null);
  const cb = useRef(onProgress);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  cb.current = onProgress;

  useEffect(() => {
    let dead = false;
    let timer = null;
    let last = { pos: 0, dur: 0 };
    const report = () => { if (last.dur > 0 && cb.current) cb.current(last.pos, last.dur); };
    const onHide = () => { if (document.visibilityState === "hidden") report(); };
    document.addEventListener("visibilitychange", onHide);

    async function start() {
      try {
        if (video.provider === "youtube") {
          await ytReady();
          if (dead) return;
          const el = document.createElement("div");
          holder.current.appendChild(el);
          player.current = new window.YT.Player(el, {
            host: "https://www.youtube-nocookie.com",
            videoId: video.videoId,
            playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: Math.floor(startAt) },
            events: {
              onReady: (e) => { last.dur = e.target.getDuration() || 0; },
              onStateChange: (e) => {
                const p = e.target;
                last.dur = p.getDuration() || last.dur;
                if (e.data === 1 && !timer) timer = setInterval(() => { last.pos = p.getCurrentTime() || 0; report(); }, REPORT_MS); // playing
                if (e.data !== 1 && timer) { clearInterval(timer); timer = null; last.pos = p.getCurrentTime() || last.pos; report(); }
              },
              onError: () => setFailed(true),
            },
          });
        } else {
          await loadScript("https://player.vimeo.com/api/player.js", () => !!window.Vimeo);
          if (dead) return;
          const iframe = document.createElement("iframe");
          iframe.src = `https://player.vimeo.com/video/${video.videoId}?dnt=1`;
          iframe.allow = "autoplay; fullscreen; picture-in-picture";
          iframe.title = "Lesson video";
          holder.current.appendChild(iframe);
          const p = new window.Vimeo.Player(iframe);
          player.current = p;
          p.getDuration().then((d) => { last.dur = d || 0; if (startAt > 0) p.setCurrentTime(startAt).catch(() => {}); });
          let lastSent = 0;
          p.on("timeupdate", (d) => { last.pos = d.seconds; last.dur = d.duration || last.dur; if (Date.now() - lastSent > REPORT_MS) { lastSent = Date.now(); report(); } });
          p.on("pause", report);
          p.on("ended", () => { last.pos = last.dur; report(); });
        }
      } catch {
        if (!dead) setFailed(true);
      }
    }
    start();

    return () => {
      dead = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      try { if (player.current && player.current.getCurrentTime && video.provider === "youtube") { last.pos = player.current.getCurrentTime() || last.pos; } } catch { /* player already gone */ }
      report();
      try { if (player.current && player.current.destroy) player.current.destroy(); } catch { /* ignore */ }
      if (holder.current) holder.current.innerHTML = "";
      player.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.provider, video.videoId]);

  const changeSpeed = (s) => {
    setSpeed(s);
    const p = player.current;
    if (!p) return;
    try { if (video.provider === "youtube") p.setPlaybackRate(s); else p.setPlaybackRate(s); } catch { /* not ready yet */ }
  };

  if (failed) {
    const href = video.provider === "youtube" ? `https://www.youtube.com/watch?v=${video.videoId}` : `https://vimeo.com/${video.videoId}`;
    return <p className="alert alert-error" role="alert">The video could not load here. <a href={href} target="_blank" rel="noopener noreferrer">Open it in a new tab</a> (your progress will not be tracked there).</p>;
  }
  return (
    <div>
      <div className="lib-video" ref={holder} />
      <div className="lib-speed" role="group" aria-label="Playback speed">
        <span>Speed</span>
        {SPEEDS.map((s) => <button key={s} type="button" aria-pressed={speed === s} onClick={() => changeSpeed(s)}>{s}x</button>)}
      </div>
    </div>
  );
}
