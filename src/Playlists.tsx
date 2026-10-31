import { useRef, useState } from "react";
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
import { trackCount, tracksFor, type CrateTrack } from "./data/tracks";
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

export function Playlists({
  playlists: rows,
  profileUrl,
  nowVideoId,
  onPlayTrack,
}: {
  playlists: SpotifyPlaylist[];
  profileUrl: string;
  nowVideoId: string;
  onPlayTrack: (track: RadioTrack) => void;
}) {
  const [person, setPerson] = useState<Person>("jezz");
  const [menu, setMenu] = useState<PlaylistMenu>("chill");
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const duo = rows.find((playlist) => playlist.id === DUO_ID) ?? null;
  const jezzTrackTotal = rows.reduce((sum, playlist) => sum + trackCount(playlist.id), 0);
  const paulTrackTotal = 0;
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
          Jezz builds his crates on Spotify. Paul will build his on YouTube Music. Every track can
          open on either service.
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
              Paul and Jezz
            </button>
            <div className="playlist-menu person-menu" role="tablist" aria-label="Whose crates">
              <button
                type="button"
                role="tab"
                aria-selected={person === "jezz"}
                className={person === "jezz" ? "is-on" : ""}
                onClick={showJezz}
              >
                Jezz
                <span className="menu-count">{jezzTrackTotal}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={person === "paul"}
                className={person === "paul" ? "is-on" : ""}
                onClick={() => setPerson("paul")}
              >
                Paul
                <span className="menu-count">{paulTrackTotal}</span>
              </button>
            </div>
            {person === "paul" ? (
              <PaulCrates />
            ) : (
              <>
                {person === "jezz" ? (
                  <>
                    <div className="playlist-menu" role="tablist" aria-label="Playlist groups">
                      {playlistMenus.map((item) => {
                        const count = rows.filter((playlist) => inPlaylistMenu(playlist, item.id)).length;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="tab"
                            aria-selected={menu === item.id}
                            className={menu === item.id ? "is-on" : ""}
                            onClick={() => chooseMenu(item.id)}
                          >
                            {item.label}
                            <span className="menu-count">{count}</span>
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
                              <span className="plist-count">{trackCount(playlist.id)}</span>
                            </span>
                            {playlist.description ? (
                              <span className="plist-desc">{playlist.description}</span>
                            ) : null}
                          </button>
                          {open ? (
                            <CratePanel playlist={playlist} nowVideoId={nowVideoId} onPlayTrack={onPlayTrack} />
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
  onPlayTrack,
}: {
  playlist: SpotifyPlaylist;
  nowVideoId: string;
  onPlayTrack: (track: RadioTrack) => void;
}) {
  const tracks = tracksFor(playlist.id);

  function play(track: CrateTrack) {
    const videoId = youtubeVideoId(track.youtubeMusicUrl);
    if (!videoId) return;
    onPlayTrack({
      videoId,
      title: track.title,
      artists: track.artists,
      artwork: track.artwork,
      crate: playlist.name,
      durationMs: track.durationMs,
    });
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
              onPlay={() => play(track)}
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
  onPlay,
}: {
  track: CrateTrack;
  active: boolean;
  onPlay: () => void;
}) {
  const videoId = youtubeVideoId(track.youtubeMusicUrl);
  const duration = formatDuration(track.durationMs);
  return (
    <article className={active ? "track-tile is-on" : "track-tile"}>
      <button type="button" className="track-play" onClick={onPlay}>
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
      <div className="track-services">
        <a href={track.spotifyUrl} target="_blank" rel="noreferrer">
          Spotify
        </a>
        <span aria-disabled="true">Apple</span>
        {videoId ? (
          <button type="button" className={active ? "is-on" : ""} aria-pressed={active} onClick={onPlay}>
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
