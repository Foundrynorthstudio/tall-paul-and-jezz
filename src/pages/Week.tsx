import { Link } from "react-router-dom";
import { beatportSearchUrl } from "../data/beatport";
import { paulPlaylists } from "../data/paul";
import { DUO_NAME, DUO_WEEK_ID, JEZZ_WEEK_ID, playlists, youtubeVideoId } from "../data/playlists";
import { tracksFor, type CrateTrack } from "../data/tracks";
import { weekFeature, type WeekFeature } from "../data/week";
import type { RadioTrack } from "../Radio";

export default function WeekPage({
  nowVideoId,
  onPlayTrack,
}: {
  nowVideoId: string;
  onPlayTrack: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void;
}) {
  return (
    <section className="block" aria-labelledby="week-title">
      <div className="wrap">
        <WeekBoard nowVideoId={nowVideoId} onPlayTrack={onPlayTrack} heading="h1" />
      </div>
    </section>
  );
}

function playlistFor(pick: WeekFeature): { id: string; name: string; tracks: CrateTrack[] } | null {
  const weekId = pick.slot === "duo" ? DUO_WEEK_ID : pick.slot === "jezz" ? JEZZ_WEEK_ID : "";
  if (weekId) {
    const playlist = playlists.find((row) => row.id === weekId);
    return playlist ? { id: playlist.id, name: playlist.name, tracks: tracksFor(playlist.id) } : null;
  }
  const videoId = youtubeVideoId(pick.track.youtubeMusicUrl);
  const paul = paulPlaylists.find((playlist) =>
    playlist.tracks.some((track) => youtubeVideoId(track.youtubeMusicUrl) === videoId),
  );
  return paul ? { id: paul.id, name: paul.name, tracks: paul.tracks } : null;
}

function queueFor(playlist: { id: string; name: string; tracks: CrateTrack[] }): RadioTrack[] {
  return playlist.tracks.flatMap((track) => {
    const videoId = youtubeVideoId(track.youtubeMusicUrl);
    if (!videoId) return [];
    return [
      {
        videoId,
        title: track.title,
        artists: track.artists,
        artwork: track.artwork,
        crate: playlist.name,
        playlistId: playlist.id,
        trackId: track.id,
        durationMs: track.durationMs,
      },
    ];
  });
}

export function WeekBoard({
  nowVideoId,
  onPlayTrack,
  heading = "h2",
}: {
  nowVideoId: string;
  onPlayTrack: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void;
  heading?: "h1" | "h2";
}) {
  const picks = weekFeature();
  const hero = picks.find((pick) => pick.slot === "duo") ?? null;
  const rest = picks.filter((pick) => pick.slot !== "duo");
  const Title = heading;

  function play(pick: WeekFeature) {
    const videoId = youtubeVideoId(pick.track.youtubeMusicUrl);
    if (!videoId) return;
    const playlist = playlistFor(pick);
    const queue = playlist ? queueFor(playlist) : [];
    const radio = queue.find((item) => item.trackId === pick.track.id || item.videoId === videoId) ?? {
      videoId,
      title: pick.track.title,
      artists: pick.track.artists,
      artwork: pick.track.artwork,
      crate: playlist?.name ?? pick.crate,
      playlistId: playlist?.id,
      trackId: pick.track.id,
      durationMs: pick.track.durationMs,
    };
    onPlayTrack(radio, undefined, queue);
  }

  if (!hero && rest.length === 0) return null;

  return (
    <>
      <p className="kicker">This week</p>
      <Title className="section-title" id={heading === "h1" ? "week-title" : undefined}>
        Tracks of the week
      </Title>
      {hero ? (
        <WeekHero pick={hero} active={isOn(hero, nowVideoId)} onPlay={() => play(hero)} />
      ) : null}
      {rest.length > 0 ? (
        <div className="week-pair">
          {rest.map((pick) => (
            <WeekSpot
              key={pick.slot}
              pick={pick}
              active={isOn(pick, nowVideoId)}
              onPlay={() => play(pick)}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function isOn(pick: WeekFeature, nowVideoId: string): boolean {
  return nowVideoId !== "" && youtubeVideoId(pick.track.youtubeMusicUrl) === nowVideoId;
}

function WeekHero({
  pick,
  active,
  onPlay,
}: {
  pick: WeekFeature;
  active: boolean;
  onPlay: () => void;
}) {
  return (
    <article className={active ? "week-hero is-on" : "week-hero"}>
      <button type="button" className="week-hero-art" aria-label={`Play ${pick.track.title}`} onClick={onPlay}>
        <Cover artwork={pick.track.artwork} />
      </button>
      <div className="week-hero-copy">
        <PickBody pick={pick} active={active} onPlay={onPlay} />
      </div>
    </article>
  );
}

function WeekSpot({
  pick,
  active,
  onPlay,
}: {
  pick: WeekFeature;
  active: boolean;
  onPlay: () => void;
}) {
  return (
    <article className={active ? "week-spot is-on" : "week-spot"}>
      <button type="button" className="week-spot-art" aria-label={`Play ${pick.track.title}`} onClick={onPlay}>
        <Cover artwork={pick.track.artwork} />
      </button>
      <div className="week-spot-body">
        <PickBody pick={pick} active={active} onPlay={onPlay} />
      </div>
    </article>
  );
}

function PickBody({
  pick,
  active,
  onPlay,
}: {
  pick: WeekFeature;
  active: boolean;
  onPlay: () => void;
}) {
  const { track } = pick;
  const videoId = youtubeVideoId(track.youtubeMusicUrl);
  const duration = formatDuration(track.durationMs);
  return (
    <>
      <p className="kicker">Track of the week</p>
      <h2 className="week-who">
        {pick.slot === "duo" ? (
          <>
            Tall Paul
            <br />
            <span className="and">and</span> Jezz
          </>
        ) : (
          pick.label
        )}
      </h2>
      <button type="button" className="week-meta" onClick={onPlay}>
        <span className="track-title">{track.title}</span>
        {track.artists ? <span className="track-artists">{track.artists}</span> : null}
        {duration ? <span className="track-duration">{duration}</span> : null}
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
        <a href={beatportSearchUrl(track)} target="_blank" rel="noreferrer">
          Beatport
        </a>
      </div>
      <PlaylistButton slot={pick.slot} />
      <div className="week-field">
        <h3>Notes</h3>
        {pick.note ? <p>{pick.note}</p> : null}
      </div>
      <div className="week-field">
        <h3>Listen-through with Tall Paul</h3>
        {pick.podcastUrl ? (
          <a href={pick.podcastUrl} target="_blank" rel="noreferrer">
            Listen
          </a>
        ) : (
          <p className="week-soon">Coming soon</p>
        )}
      </div>
    </>
  );
}

function PlaylistButton({ slot }: { slot: WeekFeature["slot"] }) {
  const pick = weekFeature().find((item) => item.slot === slot);
  const playlist = pick ? playlistFor(pick) : null;
  if (!playlist) return <p className="week-playlist is-tbc">Playlist TBC</p>;
  return (
    <Link className="week-playlist" to={`/playlists?week=${playlist.id}`}>
      {slot === "duo" ? DUO_NAME : playlist.name}
    </Link>
  );
}

function Cover({ artwork }: { artwork: string | null }) {
  if (!artwork) return <span className="week-cover" aria-hidden="true" />;
  return <img className="week-cover" src={artwork} alt="" />;
}

function formatDuration(ms: number): string {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
