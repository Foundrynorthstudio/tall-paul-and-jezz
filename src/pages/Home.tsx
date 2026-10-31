import { playlists, spotifyProfileUrl, youtubeVideoId } from "../data/playlists";
import { weekPicks, type WeekPick } from "../data/week";
import type { CrateTrack } from "../data/tracks";
import { Playlists } from "../Playlists";
import type { RadioTrack } from "../Radio";

export default function Home({
  nowVideoId,
  nowSeconds,
  onSeek,
  onPlayTrack,
}: {
  nowVideoId: string;
  nowSeconds: number;
  onSeek: (seconds: number) => void;
  onPlayTrack: (track: RadioTrack, startSeconds?: number) => void;
}) {
  const picks = weekPicks();

  function play(pick: WeekPick) {
    const videoId = youtubeVideoId(pick.track.youtubeMusicUrl);
    if (!videoId) return;
    onPlayTrack({
      videoId,
      title: pick.track.title,
      artists: pick.track.artists,
      artwork: pick.track.artwork,
      crate: pick.crate,
      durationMs: pick.track.durationMs,
    });
  }

  return (
    <>
      <section className="hero">
        <div className="hero-stage wrap">
          <img
            className="hero-art"
            src="/brand/hero.jpg"
            alt="Tall Paul and Jezz, two silhouettes in headphones."
          />
          <div className="hero-copy">
            <h1 className="wordmark">
              <span>Tall</span>
              <span>Paul</span>
              <span className="and">And</span>
              <span>Jezz</span>
            </h1>
          </div>
        </div>
        {picks.length > 0 ? (
          <section className="week wrap" aria-label="Tracks of the week">
            <div className="week-picks">
              {picks.map((pick) => (
                <WeekCard
                  key={pick.person}
                  pick={pick}
                  active={
                    nowVideoId !== "" && youtubeVideoId(pick.track.youtubeMusicUrl) === nowVideoId
                  }
                  onPlay={() => play(pick)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </section>
      <Playlists
        playlists={playlists}
        profileUrl={spotifyProfileUrl}
        nowVideoId={nowVideoId}
        nowSeconds={nowSeconds}
        onSeek={onSeek}
        onPlayTrack={onPlayTrack}
      />
    </>
  );
}

function formatDuration(ms: number): string {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function WeekCard({
  pick,
  active,
  onPlay,
}: {
  pick: WeekPick;
  active: boolean;
  onPlay: () => void;
}) {
  const track: CrateTrack = pick.track;
  const videoId = youtubeVideoId(track.youtubeMusicUrl);
  const duration = formatDuration(track.durationMs);
  return (
    <div className="week-card">
      <p className="kicker">Track of the week</p>
      <p className="week-name">{pick.label}</p>
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
      </article>
    </div>
  );
}
