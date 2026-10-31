import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { DUO_ID, playlists, youtubePlaylistEmbed, youtubeVideoId } from "./data/playlists";
import { eachPlaylistTracks, tracksFor } from "./data/tracks";
import { armPlayer, postToPlayer, widgetMessage } from "./Playlists";
import WaveformSeek from "./WaveformSeek";

export type RadioTrack = {
  videoId: string;
  title: string;
  artists: string;
  artwork: string | null;
  crate: string;
  durationMs: number;
};

type RadioMode = "latest" | "playlist" | "shuffle" | "track";

function duoItems(): RadioTrack[] {
  const crate = playlists.find((row) => row.id === DUO_ID)?.name ?? "Jezz and Tall Paul";
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
        durationMs: track.durationMs,
      },
    ];
  });
}

function latestFirst(items: RadioTrack[]): RadioTrack[] {
  if (items.length < 2) return items;
  return [items[items.length - 1], ...items.slice(0, -1)];
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
  onNow,
}: {
  soundOn: boolean;
  playTrack: MutableRefObject<(track: RadioTrack) => void>;
  onNow: (videoId: string) => void;
}) {
  const latestQueue = useMemo(() => latestFirst(duoItems()), []);
  const playlistQueue = useMemo(() => duoItems(), []);
  const [mode, setMode] = useState<RadioMode>("latest");
  const [queue, setQueue] = useState(latestQueue);
  const [nowId, setNowId] = useState(latestQueue[0]?.videoId ?? "");
  const [current, setCurrent] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const nowRef = useRef(nowId);
  const ignoreUntil = useRef(0);
  nowRef.current = nowId;
  const now = queue.find((item) => item.videoId === nowId) ?? queue[0] ?? null;
  const queueKey = `${mode}:${queue.map((item) => item.videoId).join(",")}`;

  playTrack.current = (track) => {
    if (!track.videoId || track.videoId === nowRef.current) return;
    setMode("track");
    setQueue([track]);
    setNowId(track.videoId);
    setCurrent(0);
  };

  useEffect(() => {
    onNow(nowId);
  }, [nowId, onNow]);

  useEffect(() => {
    setCurrent(0);
  }, [queueKey]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    function apply(target: HTMLIFrameElement) {
      armPlayer(target);
      postToPlayer(target, soundOn ? "unMute" : "mute");
      if (soundOn) postToPlayer(target, "playVideo");
    }
    apply(frame);
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://www.youtube-nocookie.com") return;
      if (event.source !== frame?.contentWindow) return;
      const data = widgetMessage(event.data);
      if (data?.event === "onReady") apply(frame);
      const info = data?.info;
      if (typeof info === "number" && Number.isFinite(info)) {
        if (Date.now() >= ignoreUntil.current) setCurrent(info);
        return;
      }
      if (!info || typeof info !== "object") return;
      const videoId = typeof info.videoData?.video_id === "string" ? info.videoData.video_id : null;
      if (videoId && videoId !== nowRef.current) setNowId(videoId);
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

  function load(next: RadioTrack[], nextMode: RadioMode) {
    setMode(nextMode);
    setQueue(next);
    setNowId(next[0]?.videoId ?? "");
    setCurrent(0);
  }

  function seek(seconds: number) {
    ignoreUntil.current = Date.now() + 700;
    setCurrent(seconds);
    postToPlayer(frameRef.current, "seekTo", [seconds, true]);
  }

  const kicker =
    mode === "shuffle"
      ? "Shuffle library"
      : mode === "playlist"
        ? "Playlist"
        : now?.videoId === latestQueue[0]?.videoId
          ? "Latest addition to the crate"
          : "On the radio";

  return (
    <div className="radio-dock">
      {now ? (
        <div className="radio-source">
          <div className="wrap header-radio">
            <iframe
              ref={frameRef}
              title={`${now.title} on YouTube`}
              src={youtubePlaylistEmbed(
                queue.map((item) => item.videoId),
                window.location.origin,
              )}
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              onLoad={() => {
                const frame = frameRef.current;
                if (!frame) return;
                armPlayer(frame);
                postToPlayer(frame, soundOn ? "unMute" : "mute");
                if (soundOn) postToPlayer(frame, "playVideo");
              }}
            />
            <div className="header-radio-copy">
              <p className="kicker header-radio-kicker">{kicker}</p>
              <p className="header-radio-title">{now.title}</p>
              <p className="header-radio-meta">
                {now.artists}
                {now.crate ? ` · ${now.crate}` : ""}
              </p>
            </div>
            <div className="radio-controls radio-actions">
              <button type="button" onClick={() => postToPlayer(frameRef.current, "previousVideo")}>
                Rewind
              </button>
              <button type="button" onClick={() => postToPlayer(frameRef.current, "nextVideo")}>
                Skip
              </button>
              <button
                type="button"
                className={mode === "playlist" ? "is-on" : ""}
                aria-pressed={mode === "playlist"}
                onClick={() =>
                  load(
                    mode === "playlist" ? latestQueue : playlistQueue,
                    mode === "playlist" ? "latest" : "playlist",
                  )
                }
              >
                Play playlist
              </button>
              <button
                type="button"
                className={mode === "shuffle" ? "is-on" : ""}
                aria-pressed={mode === "shuffle"}
                onClick={() =>
                  load(mode === "shuffle" ? latestQueue : libraryItems(), mode === "shuffle" ? "latest" : "shuffle")
                }
              >
                Shuffle library
              </button>
            </div>
            <WaveformSeek
              videoId={now.videoId}
              currentTime={current}
              duration={now.durationMs > 0 ? now.durationMs / 1000 : 0}
              onSeek={seek}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
