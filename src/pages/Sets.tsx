import { useMemo, useState } from "react";
import {
  beatportMatches,
  beatportSearchUrl,
  suggestSet,
  type SetPlan,
} from "../data/beatport";
import { paulPlaylists } from "../data/paul";
import { comparePlaylistNames, DUO_ID, playlists } from "../data/playlists";
import { tracksFor, type CrateTrack } from "../data/tracks";

const jezzCrates = [...playlists].sort((a, b) => comparePlaylistNames(a.name, b.name));
const paulCrates = [...paulPlaylists].sort((a, b) => comparePlaylistNames(a.name, b.name));

export default function SetsPage() {
  const [crateId, setCrateId] = useState(jezzCrates.some((playlist) => playlist.id === DUO_ID) ? DUO_ID : jezzCrates[0]?.id ?? paulCrates[0]?.id ?? "");
  const [plan, setPlan] = useState<SetPlan | null>(null);
  const tracks = useMemo(() => tracksIn(crateId), [crateId]);
  const runtime = tracks.reduce((sum, track) => sum + track.durationMs, 0);

  return (
    <section className="block">
      <div className="wrap">
        <p className="kicker">For the night</p>
        <h1 className="section-title">Set lists</h1>
        <p className="lede">
          A practice running order from one crate. Beatport opens a search for a licensed copy. Tempo
          and key show up only after Beatport confirms the track.
        </p>
        <label className="field set-crate">
          <span>Crate</span>
          <select
            value={crateId}
            onChange={(event) => {
              setCrateId(event.target.value);
              setPlan(null);
            }}
          >
            <optgroup label="Tall Paul">
              {paulCrates.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Jezz">
              {jezzCrates.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {plan?.steps.length ? (
          <button type="button" className="set-suggest is-quiet" onClick={() => setPlan(null)}>
            Crate order
          </button>
        ) : (
          <button type="button" className="set-suggest" onClick={() => setPlan(suggestSet(tracks))}>
            Suggest a set
          </button>
        )}
        {plan ? <Suggested plan={plan} /> : null}
        {plan?.steps.length ? null : (
          <>
            <h2 className="set-heading">
              Crate order
              <span>{heading(tracks.length, runtime)}</span>
            </h2>
            <TrackList tracks={tracks} />
          </>
        )}
      </div>
    </section>
  );
}

function Suggested({ plan }: { plan: SetPlan }) {
  const runtime = plan.steps.reduce((sum, step) => sum + step.track.durationMs, 0);
  if (plan.steps.length === 0) {
    return (
      <p className="set-empty">
        None of these tracks have a tempo and key yet, so there is no running order.
      </p>
    );
  }
  return (
    <>
      <h2 className="set-heading">
        Suggested set
        <span>{heading(plan.steps.length, runtime)}</span>
      </h2>
      <ol className="set-list">
        {plan.steps.map((step, index) => (
          <li key={`${step.track.id}-${index}`}>
            <TrackRow track={step.track} />
            <p className="set-reason">{step.reason}</p>
          </li>
        ))}
      </ol>
      {plan.held.length > 0 ? (
        <>
          <h2 className="set-heading">
            Not in this hour
            <span>{heading(plan.held.length, 0)}</span>
          </h2>
          <TrackList tracks={plan.held} />
        </>
      ) : null}
      {plan.unplaced.length > 0 ? (
        <>
          <h2 className="set-heading">
            Not enough to place
            <span>{heading(plan.unplaced.length, 0)}</span>
          </h2>
          <TrackList tracks={plan.unplaced} />
        </>
      ) : null}
    </>
  );
}

function TrackList({ tracks }: { tracks: CrateTrack[] }) {
  if (tracks.length === 0) return <p className="set-empty">This crate has no tracks.</p>;
  return (
    <ol className="set-list">
      {tracks.map((track, index) => (
        <li key={`${track.id}-${index}`}>
          <TrackRow track={track} />
        </li>
      ))}
    </ol>
  );
}

function TrackRow({ track }: { track: CrateTrack }) {
  const match = beatportMatches[track.id];
  const duration = formatDuration(track.durationMs);
  return (
    <article className="set-row">
      {track.artwork ? (
        <img className="set-art" src={track.artwork} alt="" />
      ) : (
        <span className="set-art" aria-hidden="true" />
      )}
      <div className="set-copy">
        <p className="set-title">{track.title}</p>
        <p className="set-meta">
          {track.artists}
          {duration ? ` · ${duration}` : ""}
          {match ? ` · ${formatBpm(match.bpm)} BPM · ${match.key}` : ""}
          {match?.genre ? ` · ${match.genre}` : ""}
        </p>
        <p className="set-links">
          <a href={beatportSearchUrl(track)} target="_blank" rel="noreferrer">
            Beatport
          </a>
          {match ? (
            <a href={match.url} target="_blank" rel="noreferrer">
              Licensed copy
            </a>
          ) : null}
        </p>
      </div>
    </article>
  );
}

function tracksIn(id: string): CrateTrack[] {
  const paul = paulPlaylists.find((playlist) => playlist.id === id);
  if (paul) return paul.tracks;
  return tracksFor(id);
}

function heading(count: number, durationMs: number): string {
  const tracks = `${count} ${count === 1 ? "track" : "tracks"}`;
  if (!durationMs) return tracks;
  return `${tracks} · ${formatTuneTime(durationMs)}`;
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
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

function formatBpm(bpm: number): string {
  return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1);
}
