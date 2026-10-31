import { useRef, useState, type KeyboardEvent } from "react";
import { paulPlaylists } from "./data/paul";
import {
  comparePlaylistNames,
  DUO_ID,
  inPlaylistMenu,
  playlistMenus,
  playlistNameKey,
  youtubeVideoId,
  type PlaylistMenu,
  type SpotifyPlaylist,
} from "./data/playlists";
import { playlistStats, tracksFor, type CrateTrack } from "./data/tracks";
import WaveformSeek from "./WaveformSeek";
import type { RadioTrack } from "./Radio";

type Person = "jezz" | "paul" | "duo";

function sortedMenu(rows: SpotifyPlaylist[], menu: PlaylistMenu): SpotifyPlaylist[] {
  return rows
    .filter((playlist) => inPlaylistMenu(playlist, menu))
    .sort((a, b) => comparePlaylistNames(a.name, b.name));
}

function formatDuration(ms: number): string {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatTuneTime(ms: number): string {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function headingStats(count: number, durationMs: number): string {
  const tracks = `${count} ${count === 1 ? "track" : "tracks"}`;
  if (!durationMs) return tracks;
  return `${tracks} · ${formatTuneTime(durationMs)}`;
}

function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
  const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : event.key === "ArrowRight" || event.key === "ArrowDown"
          ? (index + 1) % tabs.length
          : (index - 1 + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}

export function Playlists({
  playlists: rows,
  profileUrl,
  nowVideoId,
  nowSeconds,
  onSeek,
  onPlayTrack,
}: {
  playlists: SpotifyPlaylist[];
  profileUrl: string;
  nowVideoId: string;
  nowSeconds: number;
  onSeek: (seconds: number) => void;
  onPlayTrack: (track: RadioTrack, startSeconds?: number) => void;
}) {
  const [person, setPerson] = useState<Person>("jezz");
  const [menu, setMenu] = useState<PlaylistMenu>("chill");
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const duo = rows.find((playlist) => playlist.id === DUO_ID) ?? null;
  const duoStats = duo ? playlistStats(duo.id) : { count: 0, durationMs: 0 };
  const jezzStats = rows.reduce(
    (stats, playlist) => {
      const next = playlistStats(playlist.id);
      return { count: stats.count + next.count, durationMs: stats.durationMs + next.durationMs };
    },
    { count: 0, durationMs: 0 },
  );
  const paulStats = { count: 0, durationMs: 0 };
  const needle = playlistNameKey(query);
  const grouped = person === "duo" && duo ? [duo] : sortedMenu(rows, menu);
  const visible =
    person === "jezz" && needle
      ? grouped.filter((playlist) => playlistNameKey(playlist.name).includes(needle))
      : grouped;

  function chooseMenu(next: PlaylistMenu) {
    setPerson("jezz");
    setMenu(next);
    setQuery("");
    setActiveId("");
    listRef.current?.scrollTo({ top: 0 });
  }

  function showJezz() {
    setPerson("jezz");
    const inMenu = sortedMenu(rows, menu);
    if (!inMenu.some((playlist) => playlist.id === activeId)) setActiveId("");
  }

  return (
    <section className="block" id="playlists">
      <div className="wrap">
        <p className="kicker">Crates</p>
        <h2 className="section-title">Playlists</h2>
        <p className="lede">
          This is where Jezz and Paul curate the crates. Fifty tracks apiece, and the best rise to
          the top of the joint set. Jezz builds his on Spotify. Paul builds his on YouTube Music.
          {profileUrl ? (
            <>
              {" "}
              <a href={profileUrl}>Jezz on Spotify</a>.
            </>
          ) : null}
        </p>
        {rows.length === 0 ? (
          <div className="player">
            <div className="player-empty">
              <div>
                <strong>No crate loaded</strong>
                <span>Public playlists show up here once the Spotify profile is connected.</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={person === "duo" ? "duo-line is-on" : "duo-line"}
              aria-pressed={person === "duo"}
              onClick={() => {
                setPerson("duo");
                setActiveId(DUO_ID);
              }}
            >
              <span className="duo-name">Paul and Jezz</span>
              <span className="duo-meta">Joint set · {headingStats(duoStats.count, duoStats.durationMs)}</span>
            </button>
            <div
              className="playlist-menu person-menu"
              role="tablist"
              aria-label="Whose crates"
              onKeyDown={onTabKey}
            >
              <button
                type="button"
                role="tab"
                aria-selected={person === "jezz"}
                className={person === "jezz" ? "is-on" : ""}
                onClick={showJezz}
              >
                <span className="menu-label">Jezz</span>
                <span className="menu-meta">{headingStats(jezzStats.count, jezzStats.durationMs)}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={person === "paul"}
                className={person === "paul" ? "is-on" : ""}
                onClick={() => setPerson("paul")}
              >
                <span className="menu-label">Paul</span>
                <span className="menu-meta">{headingStats(paulStats.count, paulStats.durationMs)}</span>
              </button>
            </div>
            {person === "paul" ? (
              <PaulCrates />
            ) : (
              <>
                {person === "jezz" ? (
                  <>
                    <div className="playlist-menu" role="tablist" aria-label="Playlist groups" onKeyDown={onTabKey}>
                      {playlistMenus.map((item) => {
                        const crates = rows.filter((playlist) => inPlaylistMenu(playlist, item.id)).length;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={menu === item.id}
                            className={menu === item.id ? "is-on" : ""}
                            onClick={() => chooseMenu(item.id)}
                          >
                            <span className="menu-label">{item.label}</span>
                            <span className="menu-meta">
                              {crates} {crates === 1 ? "playlist" : "playlists"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <label className="field crate-search">
                      <span>Find a crate</span>
                      <input
                        type="search"
                        value={query}
                        placeholder="Vibe, techno, Jezz…"
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                  </>
                ) : null}
                <div className="playlist-list" ref={listRef}>
                  {visible.length === 0 ? (
                    <p className="plist-empty">Nothing under that name.</p>
                  ) : (
                    visible.map((playlist) => {
                      const open = playlist.id === activeId;
                      const stats = playlistStats(playlist.id);
                      return (
                        <div key={playlist.id} className={open ? "crate is-open" : "crate"}>
                          <button
                            type="button"
                            className={open ? "plist is-on" : "plist"}
                            aria-expanded={open}
                            onClick={() => setActiveId(open ? "" : playlist.id)}
                          >
                            <span className="plist-line">
                              <span className="plist-name">{playlist.name}</span>
                              <span className="plist-count">{headingStats(stats.count, stats.durationMs)}</span>
                            </span>
                            {playlist.description ? (
                              <span className="plist-desc">{playlist.description}</span>
                            ) : null}
                          </button>
                          {open ? (
                            <CratePanel
                              playlist={playlist}
                              nowVideoId={nowVideoId}
                              nowSeconds={nowSeconds}
                              onSeek={onSeek}
                              onPlayTrack={onPlayTrack}
                            />
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function PaulCrates() {
  if (paulPlaylists.length === 0) {
    return (
      <div className="paul-empty">
        <strong>Paul on YouTube Music</strong>
        <p>Paul’s YouTube Music crates will land here.</p>
      </div>
    );
  }
  return (
    <div className="playlist-list">
      {paulPlaylists.map((playlist) => (
        <a key={playlist.url} className="plist paul-link" href={playlist.url}>
          <span className="plist-line">
            <span className="plist-name">{playlist.name}</span>
            <span className="plist-count">0</span>
          </span>
        </a>
      ))}
    </div>
  );
}

function CratePanel({
  playlist,
  nowVideoId,
  nowSeconds,
  onSeek,
  onPlayTrack,
}: {
  playlist: SpotifyPlaylist;
  nowVideoId: string;
  nowSeconds: number;
  onSeek: (seconds: number) => void;
  onPlayTrack: (track: RadioTrack, startSeconds?: number) => void;
}) {
  const tracks = tracksFor(playlist.id);

  function radioTrack(track: CrateTrack, videoId: string): RadioTrack {
    return {
      videoId,
      title: track.title,
      artists: track.artists,
      artwork: track.artwork,
      crate: playlist.name,
      durationMs: track.durationMs,
    };
  }

  function play(track: CrateTrack, startSeconds?: number) {
    const videoId = youtubeVideoId(track.youtubeMusicUrl);
    if (!videoId) return;
    onPlayTrack(radioTrack(track, videoId), startSeconds);
  }

  return (
    <div className="crate-panel">
      <a className="track-crate-link" href={playlist.url}>
        Open crate on Spotify
      </a>
      {tracks.length === 0 ? (
        <p className="plist-empty">No tracks loaded for this crate.</p>
      ) : (
        <div className="crate-tracks">
          {tracks.map((track, index) => (
            <TrackTile
              key={`${track.id}-${index}`}
              track={track}
              active={nowVideoId !== "" && youtubeVideoId(track.youtubeMusicUrl) === nowVideoId}
              nowSeconds={nowSeconds}
              onSeek={onSeek}
              onPlay={(startSeconds) => play(track, startSeconds)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function postToPlayer(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  frame?.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args, channel: "widget" }),
    "https://www.youtube-nocookie.com",
  );
}

export function armPlayer(frame: HTMLIFrameElement | null) {
  frame?.contentWindow?.postMessage(
    JSON.stringify({ event: "listening", channel: "widget" }),
    "https://www.youtube-nocookie.com",
  );
}

export function widgetMessage(data: unknown): {
  event?: string;
  info?: number | { playerState?: number; currentTime?: number; videoData?: { video_id?: string } };
} | null {
  const parsed = typeof data === "string" ? parseWidget(data) : data;
  if (!parsed || typeof parsed !== "object") return null;
  return parsed as {
    event?: string;
    info?: number | { playerState?: number; currentTime?: number; videoData?: { video_id?: string } };
  };
}

function parseWidget(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function TrackTile({
  track,
  active,
  nowSeconds,
  onSeek,
  onPlay,
}: {
  track: CrateTrack;
  active: boolean;
  nowSeconds: number;
  onSeek: (seconds: number) => void;
  onPlay: (startSeconds?: number) => void;
}) {
  const videoId = youtubeVideoId(track.youtubeMusicUrl);
  const duration = formatDuration(track.durationMs);
  const seconds = track.durationMs > 0 ? track.durationMs / 1000 : 0;
  return (
    <article className={active ? "track-tile is-on" : "track-tile"}>
      <button type="button" className="track-play" onClick={() => onPlay()}>
        {track.artwork ? (
          <img className="track-cover" src={track.artwork} alt="" />
        ) : (
          <span className="track-cover" aria-hidden="true" />
        )}
        <span className="track-copy">
          <span className="track-title">{track.title}</span>
          {track.artists ? <span className="track-artists">{track.artists}</span> : null}
          {duration ? <span className="track-duration">{duration}</span> : null}
        </span>
      </button>
      <WaveformSeek
        videoId={videoId || track.id}
        currentTime={active ? nowSeconds : 0}
        duration={seconds}
        onSeek={(at) => {
          if (!videoId) return;
          if (active) onSeek(at);
          else onPlay(at);
        }}
        notes={track.timedNotes}
        followPlayhead={active}
      />
      <div className="track-services">
        <a href={track.spotifyUrl} target="_blank" rel="noreferrer">
          Spotify
        </a>
        <span aria-disabled="true">Apple</span>
        {videoId ? (
          <button type="button" className={active ? "is-on" : ""} aria-pressed={active} onClick={() => onPlay()}>
            YouTube
          </button>
        ) : (
          <span aria-disabled="true">YouTube</span>
        )}
      </div>
      {track.fieldNote ? <p className="track-note">{track.fieldNote}</p> : null}
    </article>
  );
}
