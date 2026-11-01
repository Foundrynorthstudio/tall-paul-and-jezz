import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Link } from "react-router-dom";
import { DUO_ID, DUO_NAME, playlists, youtubePlaylistEmbed, youtubeVideoId } from "./data/playlists";
import { eachPlaylistTracks, trackById, tracksFor } from "./data/tracks";
import { duoWeekTrackId } from "./data/week";
import { armPlayer, postToPlayer, widgetMessage } from "./Playlists";
import WaveformSeek from "./WaveformSeek";

export type RadioTrack = {
  videoId: string;
  title: string;
  artists: string;
  artwork: string | null;
  crate: string;
  playlistId?: string;
  trackId?: string;
  durationMs: number;
};

type RadioMode = "latest" | "playlist" | "shuffle" | "track";
type LoopMode = "off" | "song" | "playlist";

function duoItems(): RadioTrack[] {
  const crate = DUO_NAME;
  return tracksFor(DUO_ID).flatMap((track) => {
    const videoId = youtubeVideoId(track.youtubeMusicUrl);
    if (!videoId) return [];
    return [
      {
        videoId,
        title: track.title,
        artists: track.artists,
        artwork: track.artwork,
        crate,
        playlistId: DUO_ID,
        trackId: track.id,
        durationMs: track.durationMs,
      },
    ];
  });
}

function weekFirst(items: RadioTrack[]): RadioTrack[] {
  const videoId = youtubeVideoId(trackById(duoWeekTrackId)?.youtubeMusicUrl ?? null);
  if (!videoId) return items;
  const index = items.findIndex((item) => item.videoId === videoId);
  if (index <= 0) return items;
  return [items[index], ...items.filter((_, itemIndex) => itemIndex !== index)];
}

function holdVolume(frame: HTMLIFrameElement | null, on: boolean) {
  if (!frame) return;
  if (on) {
    postToPlayer(frame, "unMute");
    postToPlayer(frame, "setVolume", [100]);
    return;
  }
  postToPlayer(frame, "mute");
}

function libraryItems(): RadioTrack[] {
  const seen = new Set<string>();
  const items: RadioTrack[] = [];
  for (const { playlistId, tracks } of eachPlaylistTracks()) {
    const crate = playlists.find((row) => row.id === playlistId)?.name ?? "Library";
    for (const track of tracks) {
      const videoId = youtubeVideoId(track.youtubeMusicUrl);
      if (!videoId || seen.has(videoId)) continue;
      seen.add(videoId);
      items.push({
        videoId,
        title: track.title,
        artists: track.artists,
        artwork: track.artwork,
        crate,
        playlistId,
        trackId: track.id,
        durationMs: track.durationMs,
      });
    }
  }
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

export default function Radio({
  soundOn,
  playTrack,
  seekTo,
  applySound,
  onNow,
  onTime,
}: {
  soundOn: boolean;
  playTrack: MutableRefObject<(track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void>;
  seekTo: MutableRefObject<(seconds: number) => void>;
  applySound: MutableRefObject<(on: boolean) => void>;
  onNow: (videoId: string) => void;
  onTime: (seconds: number) => void;
}) {
  const latestQueue = useMemo(() => weekFirst(duoItems()), []);
  const [mode, setMode] = useState<RadioMode>("latest");
  const [queue, setQueue] = useState(latestQueue);
  const [startAt, setStartAt] = useState(0);
  const [nowId, setNowId] = useState(latestQueue[0]?.videoId ?? "");
  const [current, setCurrent] = useState(0);
  const [loop, setLoop] = useState<LoopMode>("off");
  const frameRef = useRef<HTMLIFrameElement>(null);
  const picksRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef(nowId);
  const ignoreUntil = useRef(0);
  const pendingStart = useRef<number | null>(null);
  const armStart = useRef<number | null>(null);
  const loopRef = useRef(loop);
  const queueRef = useRef(latestQueue);
  const loopSongRef = useRef("");
  const goToRef = useRef<(index: number) => void>(() => {});
  nowRef.current = nowId;
  loopRef.current = loop;
  const now = queue.find((item) => item.videoId === nowId) ?? queue[0] ?? null;
  const embedQueue = startAt > 0 ? [...queue.slice(startAt), ...queue.slice(0, startAt)] : queue;
  const queueKey = `${mode}:${embedQueue.map((item) => item.videoId).join(",")}`;
  const place = queue.findIndex((item) => item.videoId === now?.videoId);
  const position = place < 0 ? 1 : place + 1;
  queueRef.current = queue;
  const weekQueue = latestQueue.map((item) => item.videoId).join(",");
  const onWeek =
    queue.map((item) => item.videoId).join(",") === weekQueue && now?.videoId === latestQueue[0]?.videoId;

  playTrack.current = (track, startSeconds, playlist) => {
    if (!track.videoId) return;
    const items = playlist && playlist.length > 0 ? playlist : [track];
    const index = items.findIndex((item) => item.videoId === track.videoId);
    const safeIndex = index < 0 ? 0 : index;
    const start = Math.max(0, startSeconds ?? 0);
    const sameList =
      items.length === queue.length && items.every((item, itemIndex) => queue[itemIndex]?.videoId === item.videoId);
    if (sameList && track.videoId === nowRef.current) {
      if (startSeconds != null) seek(start);
      return;
    }
    pendingStart.current = start;
    armStart.current = start;
    ignoreUntil.current = Date.now() + 1500;
    if (!sameList) setQueue(items);
    setStartAt(safeIndex);
    setNowId(items[safeIndex]?.videoId ?? track.videoId);
    setCurrent(start);
    setMode(items.length > 1 ? "playlist" : "track");
    if (loopRef.current === "song") loopSongRef.current = items[safeIndex]?.videoId ?? track.videoId;
  };

  function goTo(index: number) {
    const items = queueRef.current;
    if (items.length === 0) return;
    const next = Math.max(0, Math.min(items.length - 1, index));
    const item = items[next];
    if (!item) return;
    if (loopRef.current === "song") loopSongRef.current = item.videoId;
    if (next === place) {
      replay();
      return;
    }
    ignoreUntil.current = Date.now() + 1500;
    setNowId(item.videoId);
    setCurrent(0);
    if (next === startAt) {
      postToPlayer(frameRef.current, "playVideoAt", [0]);
      return;
    }
    pendingStart.current = 0;
    armStart.current = null;
    setStartAt(next);
  }

  goToRef.current = goTo;

  function step(delta: number) {
    const count = queue.length;
    if (count === 0 || place < 0) return;
    const next = place + delta;
    if (loop === "playlist") {
      goTo((next + count) % count);
      return;
    }
    if (next < 0 || next >= count) return;
    goTo(next);
  }

  function replay() {
    ignoreUntil.current = Date.now() + 700;
    setCurrent(0);
    const frame = frameRef.current;
    postToPlayer(frame, "seekTo", [0, true]);
    postToPlayer(frame, "playVideo");
  }

  function cycleLoop() {
    const next: LoopMode = loop === "off" ? "song" : loop === "song" ? "playlist" : "off";
    if (next === "song") loopSongRef.current = nowRef.current;
    setLoop(next);
    postToPlayer(frameRef.current, "setLoop", [next === "playlist"]);
  }

  useEffect(() => {
    onNow(nowId);
  }, [nowId, onNow]);

  useEffect(() => {
    onTime(current);
  }, [current, onTime]);

  useEffect(() => {
    const start = pendingStart.current ?? 0;
    pendingStart.current = null;
    setCurrent(start);
  }, [queueKey]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    function apply(target: HTMLIFrameElement, ready = false) {
      armPlayer(target);
      holdVolume(target, soundOn);
      postToPlayer(target, "playVideo");
      if (ready && armStart.current != null && armStart.current > 0.25) {
        ignoreUntil.current = Date.now() + 1200;
        postToPlayer(target, "seekTo", [armStart.current, true]);
        armStart.current = null;
      }
    }
    apply(frame);
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://www.youtube-nocookie.com") return;
      if (event.source !== frame?.contentWindow) return;
      const data = widgetMessage(event.data);
      if (data?.event === "onReady") apply(frame, true);
      const info = data?.info;
      if (data?.event === "onStateChange" && soundOn) holdVolume(frame, true);
      if (data?.event === "onStateChange" && info === 0) {
        if (loopRef.current === "song") {
          ignoreUntil.current = Date.now() + 700;
          postToPlayer(frame, "seekTo", [0, true]);
          postToPlayer(frame, "playVideo");
        } else if (loopRef.current === "playlist") {
          const items = queueRef.current;
          const at = items.findIndex((item) => item.videoId === nowRef.current);
          if (at < 0 || at >= items.length - 1) goToRef.current(0);
        }
      }
      if (typeof info === "number" && Number.isFinite(info)) {
        if (data?.event !== "onStateChange" && Date.now() >= ignoreUntil.current) setCurrent(info);
        return;
      }
      if (!info || typeof info !== "object") return;
      const videoId = typeof info.videoData?.video_id === "string" ? info.videoData.video_id : null;
      if (videoId && videoId !== nowRef.current) {
        if (loopRef.current === "song" && loopSongRef.current && videoId !== loopSongRef.current) {
          postToPlayer(frame, "loadVideoById", [loopSongRef.current, 0]);
          return;
        }
        setNowId(videoId);
      }
      if (typeof info.currentTime === "number" && Date.now() >= ignoreUntil.current) {
        setCurrent(info.currentTime);
      }
    }
    window.addEventListener("message", onMessage);
    const videoTimer = window.setInterval(() => postToPlayer(frame, "getVideoData"), 1000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(videoTimer);
    };
  }, [soundOn, queueKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      postToPlayer(frameRef.current, "getCurrentTime");
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const currentPick = picksRef.current?.querySelector<HTMLElement>(".is-on");
    const box = picksRef.current;
    if (!currentPick || !box) return;
    const left = currentPick.offsetLeft - box.clientWidth / 2 + currentPick.offsetWidth / 2;
    box.scrollTo({ left: Math.max(0, left) });
  }, [place, queueKey]);

  function load(next: RadioTrack[], nextMode: RadioMode) {
    pendingStart.current = null;
    armStart.current = null;
    setMode(nextMode);
    setQueue(next);
    setStartAt(0);
    setNowId(next[0]?.videoId ?? "");
    setCurrent(0);
  }

  function seek(seconds: number) {
    ignoreUntil.current = Date.now() + 700;
    setCurrent(seconds);
    postToPlayer(frameRef.current, "seekTo", [seconds, true]);
  }

  seekTo.current = seek;

  applySound.current = (on) => {
    const frame = frameRef.current;
    if (!frame) return;
    armPlayer(frame);
    holdVolume(frame, on);
    postToPlayer(frame, "playVideo");
  };

  const kicker = mode === "shuffle" ? "Shuffle library" : onWeek ? "Track of the week" : "On the radio";
  const playlistLabel = mode === "shuffle" ? "Shuffle library" : now?.crate || DUO_NAME;
  const trackHref =
    now?.playlistId && now.trackId
      ? `/playlists?crate=${encodeURIComponent(now.playlistId)}&track=${encodeURIComponent(now.trackId)}`
      : "";

  return (
    <div className="radio-dock">
      {now ? (
        <div className="radio-source">
          <div className="wrap header-radio">
            <iframe
              ref={frameRef}
              title={`${now.title} on YouTube`}
              src={youtubePlaylistEmbed(
                embedQueue.map((item) => item.videoId),
                window.location.origin,
              )}
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              onLoad={() => {
                const frame = frameRef.current;
                if (!frame) return;
                armPlayer(frame);
                holdVolume(frame, soundOn);
                postToPlayer(frame, "playVideo");
              }}
            />
            <div className="header-radio-copy">
              <p className="playlist-player">
                Playlist:{" "}
                {playlistLabel === DUO_NAME ? (
                  <>
                    Tall Paul <span className="and">and</span> Jezz
                  </>
                ) : (
                  playlistLabel
                )}
              </p>
              <p className="kicker header-radio-kicker">{kicker}</p>
              <p className="header-radio-title">
                {trackHref ? <Link to={trackHref}>{now.title}</Link> : now.title}
              </p>
              <p className="header-radio-meta">
                {trackHref ? (
                  <Link to={trackHref}>
                    {now.artists}
                    {now.crate ? ` · ${now.crate}` : ""}
                  </Link>
                ) : (
                  <>
                    {now.artists}
                    {now.crate ? ` · ${now.crate}` : ""}
                  </>
                )}
              </p>
            </div>
            <div className="header-radio-wave">
              <div className="header-radio-wave-main">
                <WaveformSeek
                  videoId={now.videoId}
                  currentTime={current}
                  duration={now.durationMs > 0 ? now.durationMs / 1000 : 0}
                  onSeek={seek}
                />
                <p className="radio-count">
                  {position} / {queue.length}
                </p>
              </div>
              <div className="radio-picks" ref={picksRef} role="group" aria-label="Tracks in this playlist">
                {queue.map((item, index) => (
                  <button
                    key={`${item.trackId ?? item.videoId}-${index}`}
                    type="button"
                    className={index === place ? "is-on" : ""}
                    aria-current={index === place ? "true" : undefined}
                    aria-label={`Play ${index + 1}, ${item.title}`}
                    onClick={() => goTo(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
            <div className="radio-controls radio-actions">
              <button type="button" onClick={() => step(-1)} disabled={place <= 0 && loop !== "playlist"}>
                Previous
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={place < 0 || (place >= queue.length - 1 && loop !== "playlist")}
              >
                Next
              </button>
              <button type="button" onClick={replay}>
                <ReplayIcon />
                Replay
              </button>
              <button
                type="button"
                className={loop !== "off" ? "is-on" : ""}
                aria-pressed={loop !== "off"}
                aria-label={
                  loop === "song" ? "Looping this song" : loop === "playlist" ? "Looping this playlist" : "Loop off"
                }
                onClick={cycleLoop}
              >
                <LoopIcon />
                {loop === "song" ? "Loop song" : loop === "playlist" ? "Loop playlist" : "Loop"}
              </button>
              <button
                type="button"
                className={mode === "shuffle" ? "is-on radio-shuffle" : "radio-shuffle"}
                aria-pressed={mode === "shuffle"}
                onClick={() =>
                  load(mode === "shuffle" ? latestQueue : libraryItems(), mode === "shuffle" ? "latest" : "shuffle")
                }
              >
                Shuffle library
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReplayIcon() {
  return (
    <svg className="radio-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5V2L7 6l5 4V7a5 5 0 1 1-4.6 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg className="radio-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M17 7H8a4 4 0 0 0 0 8h1M7 17h9a4 4 0 0 0 0-8h-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M14 4l3 3-3 3M10 20l-3-3 3-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
