import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { paulPlaylists, paulYoutubeUrl } from "./data/paul";
import {
  comparePlaylistNames,
  DUO_ID,
  DUO_NAME,
  DUO_WEEK_ID,
  JEZZ_WEEK_ID,
  inPlaylistMenu,
  latestVibe,
  playlistMenus,
  playlistNameKey,
  youtubeVideoId,
  type PlaylistMenu,
  type SpotifyPlaylist,
} from "./data/playlists";
import { beatportSearchUrl } from "./data/beatport";
import { playlistStats, tracksFor, type CrateTrack } from "./data/tracks";
import { weekFeature, type WeekFeature, type WeekSlot } from "./data/week";
import WaveformSeek from "./WaveformSeek";
import type { RadioTrack } from "./Radio";

type Person = "jezz" | "paul" | "duo";

function trackIndex(tracks: CrateTrack[], trackId: string): number {
  if (!trackId) return 0;
  const index = tracks.findIndex((track) => track.id === trackId);
  return index >= 0 ? index : 0;
}

function menuFor(playlist: SpotifyPlaylist): PlaylistMenu {
  const match = playlistMenus.find((item) => item.id !== "all" && inPlaylistMenu(playlist, item.id));
  return match?.id ?? "all";
}

function sortedMenu(rows: SpotifyPlaylist[], menu: PlaylistMenu): SpotifyPlaylist[] {
  return rows
    .filter((playlist) => inPlaylistMenu(playlist, menu))
    .sort((a, b) => comparePlaylistNames(b.name, a.name));
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
  onPlayTrack: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void;
}) {
  const [params] = useSearchParams();
  const crateId = params.get("crate") ?? "";
  const weekId = params.get("week") ?? "";
  const linkedTrackId = params.get("track") ?? "";
  const jezzDefaultId = latestVibe()?.id ?? "";
  const linkedPaul = paulPlaylists.some((playlist) => playlist.id === crateId);
  const linkedJezz = rows.find((playlist) => playlist.id === crateId) ?? null;
  const [person, setPerson] = useState<Person>(linkedPaul ? "paul" : "jezz");
  const [menu, setMenu] = useState<PlaylistMenu>(
    linkedJezz && crateId !== DUO_ID ? menuFor(linkedJezz) : "vibe",
  );
  const [activeId, setActiveId] = useState(
    weekId || !crateId || linkedPaul || crateId === DUO_WEEK_ID ? "" : crateId,
  );
  const [weekOpen, setWeekOpen] = useState<{ id: string; trackId: string } | null>(() => {
    if (weekId) return weekHeaderOpen(weekId);
    if (!crateId || crateId === DUO_WEEK_ID) return sharedWeekOpen(crateId === DUO_WEEK_ID ? linkedTrackId : "");
    return null;
  });
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef(false);
  const duo = rows.find((playlist) => playlist.id === DUO_ID) ?? null;
  const jezzStats = rows.reduce(
    (stats, playlist) => {
      const next = playlistStats(playlist.id);
      return { count: stats.count + next.count, durationMs: stats.durationMs + next.durationMs };
    },
    { count: 0, durationMs: 0 },
  );
  const paulStats = paulPlaylists.reduce(
    (stats, playlist) => ({
      count: stats.count + playlist.count,
      durationMs: stats.durationMs + playlist.durationMs,
    }),
    { count: 0, durationMs: 0 },
  );
  const needle = playlistNameKey(query);
  const grouped = person === "duo" && duo ? [duo] : sortedMenu(rows, menu);
  const visible =
    person === "jezz" && needle
      ? grouped.filter((playlist) => playlistNameKey(playlist.name).includes(needle))
      : grouped;

  useEffect(() => {
    if (!crateId) return;
    if (paulPlaylists.some((playlist) => playlist.id === crateId)) {
      setPerson("paul");
      return;
    }
    if (crateId === DUO_WEEK_ID) {
      setWeekOpen(sharedWeekOpen(linkedTrackId));
      setActiveId("");
      const frame = requestAnimationFrame(scrollWeekTile);
      return () => cancelAnimationFrame(frame);
    }
    const playlist = rows.find((row) => row.id === crateId);
    if (!playlist) return;
    setPerson("jezz");
    setMenu(menuFor(playlist));
    setQuery("");
    setActiveId(crateId);
    const frame = requestAnimationFrame(() => {
      document.querySelector(".playlist-list .crate.is-open")?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [crateId, rows, linkedTrackId]);

  useEffect(() => {
    if (weekId) {
      setWeekOpen(weekHeaderOpen(weekId));
      setActiveId("");
      const frame = requestAnimationFrame(scrollWeekTile);
      return () => cancelAnimationFrame(frame);
    }
    if (crateId) return;
    setWeekOpen((current) => (current?.id === DUO_WEEK_ID ? current : sharedWeekOpen()));
  }, [crateId, weekId]);

  useEffect(() => {
    if (!pendingScroll.current || !activeId) return;
    pendingScroll.current = false;
    const frame = requestAnimationFrame(() => {
      document.querySelector(".playlist-list .crate.is-open")?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeId, person, menu]);

  function openWeekPlaylist(id: string) {
    if (weekOpen?.id === id) {
      setWeekOpen(null);
      return;
    }
    const paul = paulPlaylists.find((item) => item.id === id);
    const playlist = paul
      ? { id: paul.id, name: paul.name, description: "", url: paul.url, owner: "Tall Paul" }
      : rows.find((row) => row.id === id);
    if (!playlist) return;
    const tracks = paul ? paul.tracks : tracksFor(id);
    const playing = tracks.find((track) => youtubeVideoId(track.youtubeMusicUrl) === nowVideoId);
    const featured = weekFeature().find((pick) => weekPlaylistId(pick) === id)?.track;
    const featuredVideo = featured ? youtubeVideoId(featured.youtubeMusicUrl) : null;
    const track =
      playing ??
      tracks.find(
        (item) => featured && (item.id === featured.id || youtubeVideoId(item.youtubeMusicUrl) === featuredVideo),
      ) ??
      tracks[0];
    if (!track) return;
    setWeekOpen({ id, trackId: track.id });
  }

  function chooseMenu(next: PlaylistMenu) {
    setPerson("jezz");
    setMenu(next);
    setQuery("");
    if (next === "vibe" && jezzDefaultId) {
      pendingScroll.current = true;
      setActiveId(jezzDefaultId);
    } else {
      setActiveId("");
    }
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
          This is where Tall Paul and Jezz curate the crates. Fifty tracks apiece, and the best rise to
          the top of the joint set. Tall Paul builds his on YouTube Music. Jezz builds his on Spotify.{" "}
          <a href={paulYoutubeUrl}>Tall Paul on YouTube</a>.
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
            <WeekPlaylists
              rows={rows}
              nowVideoId={nowVideoId}
              nowSeconds={nowSeconds}
              onSeek={onSeek}
              openId={weekOpen?.id ?? ""}
              openTrackId={weekOpen?.trackId ?? ""}
              onOpen={openWeekPlaylist}
              onPlayTrack={onPlayTrack}
            />
            <div
              className="playlist-menu person-menu"
              role="tablist"
              aria-label="Whose crates"
              onKeyDown={onTabKey}
            >
              <button
                type="button"
                role="tab"
                aria-selected={person === "paul"}
                className={person === "paul" ? "is-on" : ""}
                onClick={() => setPerson("paul")}
              >
                <span className="menu-label">Tall Paul</span>
                <span className="menu-meta">{headingStats(paulStats.count, paulStats.durationMs)}</span>
              </button>
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
            </div>
            {person === "paul" ? (
              <PaulCrates
                openId={linkedPaul ? crateId : ""}
                trackId={linkedPaul ? linkedTrackId : ""}
                nowVideoId={nowVideoId}
                nowSeconds={nowSeconds}
                onSeek={onSeek}
                onPlayTrack={onPlayTrack}
              />
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
                              trackId={playlist.id === crateId ? linkedTrackId : ""}
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

function scrollWeekTile() {
  const tile = document.querySelector(".week-half.is-open") ?? document.querySelector(".playlist-week .week-hero");
  if (!tile) return;
  const header = document.querySelector(".site-header")?.getBoundingClientRect().height ?? 0;
  const top = tile.getBoundingClientRect().top + window.scrollY - header - 12;
  window.scrollTo(0, Math.max(0, top));
}

function sharedWeekOpen(trackId = ""): { id: string; trackId: string } | null {
  const tracks = tracksFor(DUO_WEEK_ID);
  const linked = trackId ? tracks.find((track) => track.id === trackId) : null;
  const featured = weekFeature().find((pick) => pick.slot === "duo")?.track;
  const featuredVideo = featured ? youtubeVideoId(featured.youtubeMusicUrl) : null;
  const track =
    linked ??
    tracks.find(
      (item) => featured && (item.id === featured.id || youtubeVideoId(item.youtubeMusicUrl) === featuredVideo),
    ) ??
    tracks[0];
  return track ? { id: DUO_WEEK_ID, trackId: track.id } : null;
}

function weekHeaderOpen(id: string, trackId = ""): { id: string; trackId: string } | null {
  if (id === DUO_WEEK_ID) return sharedWeekOpen(trackId);
  const paul = paulPlaylists.find((playlist) => playlist.id === id);
  const tracks = paul ? paul.tracks : tracksFor(id);
  const linked = trackId ? tracks.find((track) => track.id === trackId) : null;
  const featured = weekFeature().find((pick) => weekPlaylistId(pick) === id)?.track;
  const featuredVideo = featured ? youtubeVideoId(featured.youtubeMusicUrl) : null;
  const track =
    linked ??
    tracks.find(
      (item) => featured && (item.id === featured.id || youtubeVideoId(item.youtubeMusicUrl) === featuredVideo),
    ) ??
    tracks[0];
  return track ? { id, trackId: track.id } : null;
}

function weekPlaylistId(pick: WeekFeature): string {
  if (pick.slot === "duo") return DUO_WEEK_ID;
  if (pick.slot === "jezz") return JEZZ_WEEK_ID;
  return paulWeekPlaylist()?.id ?? "";
}

function paulWeekPlaylist(): SpotifyPlaylist | null {
  const feature = weekFeature().find((pick) => pick.slot === "paul");
  const videoId = feature ? youtubeVideoId(feature.track.youtubeMusicUrl) : null;
  if (!videoId) return null;
  const found = paulPlaylists.find((playlist) =>
    playlist.tracks.some((track) => youtubeVideoId(track.youtubeMusicUrl) === videoId),
  );
  if (!found) return null;
  return { id: found.id, name: found.name, description: "", url: found.url, owner: "Tall Paul" };
}

function paulWeekTracks(): CrateTrack[] {
  return paulPlaylists.find((playlist) => playlist.id === paulWeekPlaylist()?.id)?.tracks ?? [];
}

function playlistTitle(playlist: { id: string; name: string }): string {
  return playlist.id === DUO_ID ? DUO_NAME : playlist.name;
}

function radioQueue(playlist: SpotifyPlaylist, tracks: CrateTrack[]): RadioTrack[] {
  return tracks.flatMap((track) => {
    const videoId = youtubeVideoId(track.youtubeMusicUrl);
    if (!videoId) return [];
    return [
      {
        videoId,
        title: track.title,
        artists: track.artists,
        artwork: track.artwork,
        crate: playlistTitle(playlist),
        playlistId: playlist.id,
        trackId: track.id,
        durationMs: track.durationMs,
      },
    ];
  });
}

function WeekPlaylists({
  rows,
  nowVideoId,
  nowSeconds,
  onSeek,
  openId,
  openTrackId,
  onOpen,
  onPlayTrack,
}: {
  rows: SpotifyPlaylist[];
  nowVideoId: string;
  nowSeconds: number;
  onSeek: (seconds: number) => void;
  openId: string;
  openTrackId: string;
  onOpen: (id: string) => void;
  onPlayTrack: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void;
}) {
  const picks = weekFeature();
  const hero = picks.find((pick) => pick.slot === "duo") ?? null;
  const rest = picks.filter((pick) => pick.slot !== "duo");
  const duo = rows.find((playlist) => playlist.id === DUO_WEEK_ID) ?? null;
  const jezzPlaylist = rows.find((playlist) => playlist.id === JEZZ_WEEK_ID) ?? null;

  function playlistFor(slot: WeekSlot): { playlist: SpotifyPlaylist; tracks?: CrateTrack[] } | null {
    if (slot === "duo" && duo) return { playlist: duo };
    if (slot === "jezz" && jezzPlaylist) return { playlist: jezzPlaylist };
    const paul = paulWeekPlaylist();
    if (slot === "paul" && paul) return { playlist: paul, tracks: paulWeekTracks() };
    return null;
  }

  const duoOpen = duo !== null && openId === duo.id;
  const [stripSlot, setStripSlot] = useState<HTMLDivElement | null>(null);
  const openSlot = rest.find((pick) => {
    const source = playlistFor(pick.slot);
    return source !== null && openId === source.playlist.id;
  })?.slot;

  return (
    <div className="playlist-week">
      {hero && duo && duoOpen ? (
        <SharedWeek
          pick={hero}
          playlist={duo}
          layout="hero"
          trackId={openTrackId}
          nowVideoId={nowVideoId}
          nowSeconds={nowSeconds}
          onSeek={onSeek}
          onOpen={onOpen}
          onPlayTrack={onPlayTrack}
        />
      ) : hero ? (
        <WeekPlaylistCard
          pick={hero}
          playlist={playlistFor(hero.slot)?.playlist ?? null}
          layout="hero"
          open={false}
          playing={isPlaying(hero, nowVideoId)}
          onOpen={onOpen}
          onPlayTrack={onPlayTrack}
        />
      ) : null}
      {rest.length > 0 ? (
        <div className={`week-pair${openSlot ? ` is-open is-${openSlot}` : ""}`}>
          {rest.map((pick) => {
            const source = playlistFor(pick.slot);
            const open = source !== null && openId === source.playlist.id;
            return (
              <div className={`week-half${open ? " is-open" : ""}`} key={pick.slot}>
                {open && source ? (
                  <SharedWeek
                    pick={pick}
                    playlist={source.playlist}
                    tracks={source.tracks}
                    layout="spot"
                    trackId={openTrackId}
                    nowVideoId={nowVideoId}
                    nowSeconds={nowSeconds}
                    onSeek={onSeek}
                    onOpen={onOpen}
                    onPlayTrack={onPlayTrack}
                    stripTarget={stripSlot}
                  />
                ) : (
                  <WeekPlaylistCard
                    pick={pick}
                    playlist={source?.playlist ?? null}
                    layout="spot"
                    open={false}
                    playing={isPlaying(pick, nowVideoId)}
                    onOpen={onOpen}
                    onPlayTrack={onPlayTrack}
                  />
                )}
              </div>
            );
          })}
          <div className="week-strip-slot" ref={setStripSlot} />
        </div>
      ) : null}
    </div>
  );
}

function isPlaying(pick: WeekFeature, nowVideoId: string): boolean {
  return nowVideoId !== "" && youtubeVideoId(pick.track.youtubeMusicUrl) === nowVideoId;
}

type WeekDeck = {
  track: CrateTrack;
  position: number;
  total: number;
  active: boolean;
  nowSeconds: number;
  onSeek: (seconds: number) => void;
  onPlay: (startSeconds?: number) => void;
  onPrevious: () => void;
  onNext: () => void;
};

function WeekPlaylistCard({
  pick,
  playlist,
  layout,
  open,
  playing,
  onOpen,
  onPlayTrack,
  deck,
}: {
  pick: WeekFeature;
  playlist: SpotifyPlaylist | null;
  layout: "hero" | "spot";
  open: boolean;
  playing: boolean;
  onOpen: (id: string) => void;
  onPlayTrack: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void;
  deck?: WeekDeck | null;
}) {
  const track = deck?.track ?? pick.track;
  const videoId = youtubeVideoId(track.youtubeMusicUrl);
  const duration = formatDuration(track.durationMs);
  const paul = playlist ? paulPlaylists.find((item) => item.id === playlist.id) : null;
  const counted = paul
    ? { count: paul.count, durationMs: paul.durationMs }
    : playlist
      ? playlistStats(playlist.id)
      : null;
  const stats = counted && counted.count > 0 ? counted : null;
  const artClass = layout === "hero" ? "week-hero-art" : "week-spot-art";
  const bodyClass = layout === "hero" ? "week-hero-copy" : "week-spot-body";

  function play(startSeconds?: number) {
    if (deck) {
      deck.onPlay(startSeconds);
      return;
    }
    if (!videoId) return;
    const source = paul ? paul.tracks : playlist ? tracksFor(playlist.id) : [];
    const queue = playlist ? radioQueue(playlist, source) : [];
    const radio = queue.find((item) => item.trackId === track.id) ?? {
      videoId,
      title: track.title,
      artists: track.artists,
      artwork: track.artwork,
      crate: pick.crate,
      playlistId: playlist?.id,
      trackId: track.id,
      durationMs: track.durationMs,
    };
    onPlayTrack(radio, startSeconds, queue);
  }

  const cover = track.artwork ? (
    <img className="week-cover" src={track.artwork} alt="" />
  ) : (
    <span className="week-cover" aria-hidden="true" />
  );

  return (
    <article className={`${layout === "hero" ? "week-hero" : "week-spot"}${open || playing ? " is-on" : ""}`}>
      {videoId ? (
        <button type="button" className={artClass} aria-label={`Play ${track.title}`} onClick={() => play()}>
          {cover}
        </button>
      ) : (
        <div className={artClass}>{cover}</div>
      )}
      <div className={bodyClass}>
        <p className="kicker">Track of the week</p>
        <h3 className="week-who">
          {pick.slot === "duo" ? (
            <>
              Tall Paul
              <br />
              <span className="and">and</span> Jezz
            </>
          ) : (
            pick.label
          )}
        </h3>
        {videoId ? (
          <button type="button" className="week-meta" onClick={() => play()}>
            <span className="track-title">{track.title}</span>
            {track.artists ? <span className="track-artists">{track.artists}</span> : null}
            {deck || !duration ? null : <span className="track-duration">{duration}</span>}
          </button>
        ) : (
          <p className="week-meta">
            <span className="track-title">{track.title}</span>
            {track.artists ? <span className="track-artists">{track.artists}</span> : null}
            {duration ? <span className="track-duration">{duration}</span> : null}
          </p>
        )}
        {deck ? (
          <div className="week-time-play">
            <WaveformSeek
              videoId={videoId || track.id}
              currentTime={deck.active ? deck.nowSeconds : 0}
              duration={track.durationMs > 0 ? track.durationMs / 1000 : 0}
              onSeek={(at) => {
                if (!videoId || !deck.active) return;
                deck.onSeek(at);
              }}
              notes={track.timedNotes}
              followPlayhead={deck.active}
            />
            <div className="crate-skip">
              <button type="button" onClick={deck.onPrevious} disabled={deck.position <= 1}>
                Previous
              </button>
              <p className="crate-count">
                {deck.position} / {deck.total}
              </p>
              <button type="button" onClick={deck.onNext} disabled={deck.position >= deck.total}>
                Next
              </button>
            </div>
          </div>
        ) : null}
        {open ? <ServiceRow track={track} active={playing} onPlay={() => play()} /> : null}
        {playlist && stats ? (
          <button
            type="button"
            className="week-playlist"
            aria-pressed={open}
            onClick={() => onOpen(playlist.id)}
          >
            {playlist.id === DUO_ID ? DUO_NAME : playlist.name}
            <span className="week-playlist-meta">{headingStats(stats.count, stats.durationMs)}</span>
          </button>
        ) : (
          <p className="week-playlist is-tbc">Playlist TBC</p>
        )}
      </div>
    </article>
  );
}

function SharedWeek({
  pick,
  playlist,
  tracks: givenTracks,
  layout,
  trackId,
  nowVideoId,
  nowSeconds,
  onSeek,
  onOpen,
  onPlayTrack,
  stripTarget = null,
}: {
  pick: WeekFeature;
  playlist: SpotifyPlaylist;
  tracks?: CrateTrack[];
  layout: "hero" | "spot";
  trackId: string;
  nowVideoId: string;
  nowSeconds: number;
  onSeek: (seconds: number) => void;
  onOpen: (id: string) => void;
  onPlayTrack: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void;
  stripTarget?: HTMLElement | null;
}) {
  const tracks = givenTracks ?? tracksFor(playlist.id);
  const deck = useCrateDeck(playlist, tracks, trackId, onPlayTrack);
  if (!deck.loaded) return null;
  const loaded = deck.loaded;
  const strip = (
    <div className="crate is-open week-crate">
      <div className="crate-panel week-drop">
        <TrackStrip
          tracks={tracks}
          page={deck.page}
          pageSize={deck.pageSize}
          selected={deck.safeIndex}
          onPage={deck.setPage}
          onPlay={deck.load}
        />
      </div>
    </div>
  );
  return (
    <>
      <WeekPlaylistCard
        pick={pick}
        playlist={playlist}
        layout={layout}
        open
        playing={isTrackOn(loaded, nowVideoId)}
        onOpen={onOpen}
        onPlayTrack={onPlayTrack}
        deck={{
          track: loaded,
          position: deck.safeIndex + 1,
          total: tracks.length,
          active: isTrackOn(loaded, nowVideoId),
          nowSeconds,
          onSeek,
          onPlay: (startSeconds) => deck.play(loaded, startSeconds),
          onPrevious: () => deck.show(deck.safeIndex - 1),
          onNext: () => deck.show(deck.safeIndex + 1),
        }}
      />
      {layout === "spot" ? (stripTarget ? createPortal(strip, stripTarget) : null) : strip}
    </>
  );
}

function PaulCrates({
  openId,
  trackId,
  nowVideoId,
  nowSeconds,
  onSeek,
  onPlayTrack,
}: {
  openId: string;
  trackId: string;
  nowVideoId: string;
  nowSeconds: number;
  onSeek: (seconds: number) => void;
  onPlayTrack: (track: RadioTrack) => void;
}) {
  const [activeId, setActiveId] = useState(openId);

  useEffect(() => {
    if (openId) setActiveId(openId);
  }, [openId]);

  useEffect(() => {
    if (!activeId) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector(".crate.is-open")?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeId]);

  if (paulPlaylists.length === 0) {
    return (
      <div className="paul-empty">
        <strong>Tall Paul on YouTube Music</strong>
        <p>Tall Paul’s YouTube Music crates will land here.</p>
      </div>
    );
  }
  return (
    <div className="playlist-list">
      {paulPlaylists.map((playlist) => {
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
                <span className="plist-count">{headingStats(playlist.count, playlist.durationMs)}</span>
              </span>
            </button>
            {open ? (
              <CratePanel
                playlist={{
                  id: playlist.id,
                  name: playlist.name,
                  description: "",
                  url: playlist.url,
                  owner: "Tall Paul",
                }}
                tracks={playlist.tracks}
                trackId={playlist.id === openId ? trackId : ""}
                openLabel="Open crate on YouTube"
                nowVideoId={nowVideoId}
                nowSeconds={nowSeconds}
                onSeek={onSeek}
                onPlayTrack={onPlayTrack}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function useCrateDeck(
  playlist: SpotifyPlaylist,
  tracks: CrateTrack[],
  trackId: string,
  onPlayTrack: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void,
) {
  const linkedIndex = trackIndex(tracks, trackId);
  const [loadedIndex, setLoadedIndex] = useState(linkedIndex);
  const onPlayRef = useRef(onPlayTrack);
  onPlayRef.current = onPlayTrack;
  const safeIndex = tracks[loadedIndex] ? loadedIndex : 0;
  const loaded = tracks[safeIndex] ?? null;

  useEffect(() => {
    if (!trackId) return;
    const index = tracks.findIndex((track) => track.id === trackId);
    if (index >= 0) setLoadedIndex(index);
    // The track list is a fresh array each render. Only the linked track should move the deck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, playlist.id]);

  function play(track: CrateTrack, startSeconds?: number) {
    const videoId = youtubeVideoId(track.youtubeMusicUrl);
    if (!videoId) return;
    const queue = tracks.flatMap((item) => {
      const id = youtubeVideoId(item.youtubeMusicUrl);
      return id
        ? [
            {
              videoId: id,
              title: item.title,
              artists: item.artists,
              artwork: item.artwork,
              crate: playlistTitle(playlist),
              playlistId: playlist.id,
              trackId: item.id,
              durationMs: item.durationMs,
            },
          ]
        : [];
    });
    const radio = queue.find((item) => item.trackId === track.id);
    if (radio) onPlayRef.current(radio, startSeconds, queue);
  }

  const pageSize = 10;
  const [page, setPage] = useState(0);
  const trackPage = Math.floor(safeIndex / pageSize);

  useEffect(() => {
    setPage(trackPage);
  }, [trackPage]);

  function show(index: number) {
    if (tracks[index]) setLoadedIndex(index);
  }

  function load(track: CrateTrack, index: number) {
    setLoadedIndex(index);
    play(track);
  }

  return { loaded, safeIndex, page, setPage, pageSize, show, load, play };
}

function CratePanel({
  playlist,
  tracks: givenTracks,
  trackId = "",
  openLabel = "Open crate on Spotify",
  nowVideoId,
  nowSeconds,
  onSeek,
  onPlayTrack,
}: {
  playlist: SpotifyPlaylist;
  tracks?: CrateTrack[];
  trackId?: string;
  openLabel?: string;
  nowVideoId: string;
  nowSeconds: number;
  onSeek: (seconds: number) => void;
  onPlayTrack: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void;
}) {
  const tracks = givenTracks ?? tracksFor(playlist.id);
  const deck = useCrateDeck(playlist, tracks, trackId, onPlayTrack);
  const { loaded, safeIndex, page, setPage, pageSize, show, load, play } = deck;

  if (!loaded) {
    return (
      <div className="crate-panel">
        <p className="plist-empty">No tracks loaded for this crate.</p>
      </div>
    );
  }

  return (
    <div className="crate-panel">
      <a className="track-crate-link" href={playlist.url}>
        {openLabel}
      </a>
      <div className="crate-board">
        <CrateHero
          track={loaded}
          playlist={playlist}
          position={safeIndex + 1}
          total={tracks.length}
          active={isTrackOn(loaded, nowVideoId)}
          nowSeconds={nowSeconds}
          onSeek={onSeek}
          onPlay={(startSeconds) => play(loaded, startSeconds)}
          onPrevious={() => show(safeIndex - 1)}
          onNext={() => show(safeIndex + 1)}
        />
        {tracks.length > 1 ? (
          <TrackStrip
            tracks={tracks}
            page={page}
            pageSize={pageSize}
            selected={safeIndex}
            onPage={setPage}
            onPlay={load}
          />
        ) : null}
      </div>
    </div>
  );
}

function isTrackOn(track: CrateTrack, nowVideoId: string): boolean {
  return nowVideoId !== "" && youtubeVideoId(track.youtubeMusicUrl) === nowVideoId;
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

function CrateHero({
  track,
  playlist,
  position,
  total,
  active,
  nowSeconds,
  onSeek,
  onPlay,
  onPrevious,
  onNext,
}: {
  track: CrateTrack;
  playlist: SpotifyPlaylist;
  position: number;
  total: number;
  active: boolean;
  nowSeconds: number;
  onSeek: (seconds: number) => void;
  onPlay: (startSeconds?: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const videoId = youtubeVideoId(track.youtubeMusicUrl);
  const seconds = track.durationMs > 0 ? track.durationMs / 1000 : 0;
  return (
    <article className={active ? "week-hero is-on" : "week-hero"}>
      <TrackArt className="week-hero-art" track={track} onPlay={videoId ? () => onPlay() : undefined} />
      <div className="week-hero-copy">
        <p className="kicker">{playlist.name}</p>
        <TrackMeta track={track} onPlay={videoId ? () => onPlay() : undefined} />
        <WaveformSeek
          videoId={videoId || track.id}
          currentTime={active ? nowSeconds : 0}
          duration={seconds}
          onSeek={(at) => {
            if (!videoId || !active) return;
            onSeek(at);
          }}
          notes={track.timedNotes}
          followPlayhead={active}
        />
        <div className="crate-skip">
          <button type="button" onClick={onPrevious} disabled={position <= 1}>
            Previous
          </button>
          <p className="crate-count">
            {position} / {total}
          </p>
          <button type="button" onClick={onNext} disabled={position >= total}>
            Next
          </button>
        </div>
        <ServiceRow track={track} active={active} onPlay={() => onPlay()} />
        {track.fieldNote ? (
          <div className="week-field">
            <h3>Notes</h3>
            <p>{track.fieldNote}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function TrackStrip({
  tracks,
  page,
  pageSize,
  selected,
  onPage,
  onPlay,
}: {
  tracks: CrateTrack[];
  page: number;
  pageSize: number;
  selected: number;
  onPage: (page: number) => void;
  onPlay: (track: CrateTrack, index: number) => void;
}) {
  const visible = Math.min(pageSize, tracks.length - page * pageSize);
  return (
    <div className="crate-strip">
      <button
        type="button"
        className="crate-scroll"
        aria-label="Show the previous covers"
        disabled={page === 0}
        onClick={() => onPage(Math.max(0, page - 1))}
      >
        Left
      </button>
      <div className="crate-run">
        {tracks.slice(page * pageSize, page * pageSize + pageSize).map((track, offset) => {
          const index = page * pageSize + offset;
          return (
            <CrateNode
              key={`${track.id}-${index}`}
              track={track}
              position={index + 1}
              total={tracks.length}
              active={index === selected}
              linked={offset !== visible - 1}
              onPlay={() => onPlay(track, index)}
            />
          );
        })}
      </div>
      <button
        type="button"
        className="crate-scroll"
        aria-label="Show the next covers"
        disabled={(page + 1) * pageSize >= tracks.length}
        onClick={() => onPage(Math.min(page + 1, Math.ceil(tracks.length / pageSize) - 1))}
      >
        Right
      </button>
    </div>
  );
}

function CrateNode({
  track,
  position,
  total,
  active,
  linked,
  onPlay,
}: {
  track: CrateTrack;
  position: number;
  total: number;
  active: boolean;
  linked: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "crate-node is-on" : "crate-node"}
      aria-label={`Play ${track.title}`}
      aria-current={active ? "true" : undefined}
      onClick={onPlay}
    >
      <span className="crate-node-slot">
        {track.artwork ? (
          <img className="crate-node-art" src={track.artwork} alt="" />
        ) : (
          <span className="crate-node-art" aria-hidden="true" />
        )}
        {linked ? <span className="crate-node-line" aria-hidden="true" /> : null}
      </span>
      <span className="crate-node-count">
        {position} / {total}
      </span>
    </button>
  );
}

function TrackArt({
  className,
  track,
  onPlay,
}: {
  className: string;
  track: CrateTrack;
  onPlay?: () => void;
}) {
  const cover = track.artwork ? (
    <img className="week-cover" src={track.artwork} alt="" />
  ) : (
    <span className="week-cover" aria-hidden="true" />
  );
  if (!onPlay) return <div className={className}>{cover}</div>;
  return (
    <button type="button" className={className} aria-label={`Play ${track.title}`} onClick={onPlay}>
      {cover}
    </button>
  );
}

function TrackMeta({ track, onPlay }: { track: CrateTrack; onPlay?: () => void }) {
  const duration = formatDuration(track.durationMs);
  const body = (
    <>
      <span className="track-title">{track.title}</span>
      {track.artists ? <span className="track-artists">{track.artists}</span> : null}
      {duration ? <span className="track-duration">{duration}</span> : null}
    </>
  );
  if (!onPlay) return <p className="week-meta">{body}</p>;
  return (
    <button type="button" className="week-meta" onClick={onPlay}>
      {body}
    </button>
  );
}

function ServiceRow({
  track,
  active,
  onPlay,
}: {
  track: CrateTrack;
  active: boolean;
  onPlay: () => void;
}) {
  const videoId = youtubeVideoId(track.youtubeMusicUrl);
  return (
    <div className="track-services">
      {track.spotifyUrl ? (
        <a href={track.spotifyUrl} target="_blank" rel="noreferrer">
          Spotify
        </a>
      ) : (
        <span aria-disabled="true">Spotify</span>
      )}
      <span aria-disabled="true">Apple</span>
      {videoId ? (
        <button type="button" className={active ? "is-on" : ""} aria-pressed={active} onClick={onPlay}>
          YouTube
        </button>
      ) : (
        <span aria-disabled="true">YouTube</span>
      )}
      <a href={beatportSearchUrl(track)} target="_blank" rel="noreferrer">
        Beatport
      </a>
    </div>
  );
}
