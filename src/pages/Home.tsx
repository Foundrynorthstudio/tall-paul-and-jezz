import { Link } from "react-router-dom";
import { paulYoutubeUrl } from "../data/paul";
import { playlists, youtubeVideoId } from "../data/playlists";
import { weekTrackIds } from "../data/week";
import { trackById, eachPlaylistTracks, tracksFor, type CrateTrack } from "../data/tracks";
import type { RadioTrack } from "../Radio";
import { WeekBoard } from "./Week";

export default function Home({
  nowVideoId,
  onPlayTrack,
}: {
  nowVideoId: string;
  onPlayTrack: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void;
}) {
  return (
    <>
      <section className="hero">
        <div className="hero-lockup wrap">
          <div className="hero-stage">
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
          <p className="hero-line">
            <span>Helping you</span>
            <span>cut mad</span>
            <span className="hit">
              shape
              <span className="mark">
                s<span className="copy">©</span>
              </span>
              .
            </span>
          </p>
          <Link className="hero-cta" to="/playlists">
            Playlists
          </Link>
        </div>
        <section className="week wrap" aria-label="Tracks of the week">
          <WeekBoard nowVideoId={nowVideoId} onPlayTrack={onPlayTrack} />
        </section>
      </section>
    </>
  );
}

export function About({
  profileUrl,
  nowVideoId,
  onPlayTrack,
}: {
  profileUrl: string;
  nowVideoId: string;
  onPlayTrack: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void;
}) {
  const ten = jezzTopTen();
  const listed = ten.filter((track): track is CrateTrack => track !== null);
  const runtimeMs = listed.reduce((sum, track) => sum + track.durationMs, 0);
  return (
    <section className="block" id="about" aria-labelledby="about-title">
      <div className="wrap">
        <p className="kicker">About us</p>
        <h2 className="section-title" id="about-title">
          About
        </h2>
        <article className="about-group">
          <img src="/brand/hero.jpg" alt="Tall Paul and Jezz, two silhouettes in headphones." />
          <div className="about-copy">
            <p className="kicker">Group</p>
            <h3 className="profile-name">
              Tall Paul <span className="and">and</span> Jezz
            </h3>
            <p>
              House and techno. Tall Paul and Jezz curate the crates. Fifty tracks apiece, and the best
              rise to the top of the joint set.
            </p>
          </div>
        </article>
        <div className="about-pair">
          <div className="about-col">
            <article className="profile">
              <div className="profile-frame">
                <img src="/brand/about-paul.jpg" alt="Tall Paul, silhouette with headphones around his neck." />
              </div>
              <div className="profile-body">
                <p className="kicker">Tall Paul</p>
                <h3 className="profile-name">Tall Paul</h3>
                <p>Tall Paul builds his crates on YouTube Music.</p>
                <a className="profile-link" href={paulYoutubeUrl}>
                  Tall Paul on YouTube
                </a>
              </div>
            </article>
          </div>
          <div className="about-col">
            <article className="profile">
              <div className="profile-frame">
                <img src="/brand/about-jezz.jpg" alt="Jezz, silhouette with headphones on and glasses." />
              </div>
              <div className="profile-body">
                <p className="kicker">Jezz</p>
                <h3 className="profile-name">Jezz</h3>
                <p>Jezz builds his crates on Spotify.</p>
                <p>
                  For me it&apos;s all about cutting mad shapes on the dance floor whilst being on the right side of
                  f*cked. I enjoy it myself, I enjoy it even more with friends. I listen to music to
                  build playlists. Repeat, over and over, learn the track - the favourites become
                  memorised. Doom doom doom doom....Always with a big night out in mind when
                  listening. Glasgow is where I went clubbing as a student, and where I met Tall
                  Paul....doom doom doom doom
                </p>
                {profileUrl ? (
                  <a className="profile-link" href={profileUrl}>
                    Jezz on Spotify
                  </a>
                ) : null}
              </div>
            </article>
            {ten.length > 0 ? (
              <div className="jezz-top">
                <h3 className="profile-name">Top 10</h3>
                <p className="top-runtime">
                  {listed.length} {listed.length === 1 ? "track" : "tracks"}
                  {runtimeMs ? ` · ${formatTuneTime(runtimeMs)}` : ""}
                </p>
                <ol className="top-grid">
                  {ten.map((track, index) =>
                    track ? (
                      <TopCell
                        key={track.id}
                        track={track}
                        rank={index + 1}
                        active={nowVideoId !== "" && youtubeVideoId(track.youtubeMusicUrl) === nowVideoId}
                        onPlay={onPlayTrack}
                      />
                    ) : (
                      <ComingSoon key={`soon-${index + 1}`} rank={index + 1} />
                    ),
                  )}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

const CHANGE_ID = "6dMZduF6Qs2WiSzQs7gqk5";
const RIP_IT_UP_ID = "0rivtQllV53TOaMlPIkKsx";
const NEVER_B_MINE_ID = "0bp1n629hFdAlF6CMl4WnD";
const CRAVE_YOU_ID = "5mdzg7ZwebXNb90LPRusAs";
const FLYING_AWAY_ID = "0GxkWCaowNJxbaCdrcAPFe";
const HEAVEN_ID = "030VTvfbjjn3Lnrif6tLcy";

const SPACE_COWBOY: CrateTrack = {
  id: "4SauVG68Oqmznmm04IQ0rm",
  isrc: "GBBBL9500001",
  title: "Space Cowboy (Classic Radio)",
  artists: "Jamiroquai, David Morales",
  durationMs: 243913,
  artwork: "https://i.scdn.co/image/ab67616d00001e02449878b23d93b2772906f48c",
  spotifyUrl: "https://open.spotify.com/track/4SauVG68Oqmznmm04IQ0rm",
  appleUrl: null,
  youtubeMusicUrl: "https://music.youtube.com/watch?v=IV8ujbsIJgk",
  fieldNote: "",
  timedNotes: [],
};

const BE_YOUR_GIRL: CrateTrack = {
  id: "3zp3Mq8krAb1067UL94zJq",
  isrc: null,
  title: "BE YOUR GIRL - KAYTRANADA REMIX",
  artists: "Teedra Moses, KAYTRANADA",
  durationMs: 268087,
  artwork: "https://i.scdn.co/image/ab67616d0000b2732c540a9b80a0a61d1541d6ab",
  spotifyUrl: "https://open.spotify.com/track/3zp3Mq8krAb1067UL94zJq",
  appleUrl: null,
  youtubeMusicUrl: "https://music.youtube.com/watch?v=2OooRsERqyY",
  fieldNote: "",
  timedNotes: [],
};

const PRADA: CrateTrack = {
  id: "59NraMJsLaMCVtwXTSia8i",
  isrc: "GBCEN2300147",
  title: "Prada",
  artists: "cassö, RAYE, D-Block Europe",
  durationMs: 132359,
  artwork: "https://i.scdn.co/image/ab67616d0000b273e4b7dccdfd54375ded9ccc5c",
  spotifyUrl: "https://open.spotify.com/track/59NraMJsLaMCVtwXTSia8i",
  appleUrl: null,
  youtubeMusicUrl: "https://music.youtube.com/watch?v=zFMYL0XQ3lA",
  fieldNote: "",
  timedNotes: [],
};

function playlistIdForTrack(id: string): string {
  for (const { playlistId, tracks } of eachPlaylistTracks()) {
    if (tracks.some((track) => track.id === id)) return playlistId;
  }
  return "";
}

function jezzTopTen(): (CrateTrack | null)[] {
  const crave = trackById(CRAVE_YOU_ID);
  const slots: (CrateTrack | null)[] = [
    trackById(weekTrackIds.jezz) ?? null,
    SPACE_COWBOY,
    trackById(BE_YOUR_GIRL.id) ?? BE_YOUR_GIRL,
    trackById(CHANGE_ID) ?? null,
    trackById(RIP_IT_UP_ID) ?? null,
    trackById(NEVER_B_MINE_ID) ?? null,
    crave
      ? {
          ...crave,
          artwork:
            crave.artwork ??
            "https://i.scdn.co/image/ab67616d0000b273bb0ba14641d1c0b6b61a5234",
        }
      : null,
    PRADA,
    trackById(FLYING_AWAY_ID) ?? null,
    trackById(HEAVEN_ID) ?? null,
  ];
  while (slots.length < 10) slots.push(null);
  return slots;
}

function ComingSoon({ rank }: { rank: number }) {
  return (
    <li>
      <div className="top-cell is-soon">
        <span className="top-cover" aria-hidden="true" />
        <span className="top-rank">{rank}</span>
        <span className="track-title">Coming soon</span>
      </div>
    </li>
  );
}

function TopCell({
  track,
  rank,
  active,
  onPlay,
}: {
  track: CrateTrack;
  rank: number;
  active: boolean;
  onPlay: (track: RadioTrack, startSeconds?: number, queue?: RadioTrack[]) => void;
}) {
  const videoId = youtubeVideoId(track.youtubeMusicUrl);
  const copy = (
    <>
      {track.artwork ? (
        <img src={track.artwork} alt="" />
      ) : (
        <span className="top-cover" aria-hidden="true" />
      )}
      <span className="top-rank">{rank}</span>
      <span className="track-title">{track.title}</span>
      {track.artists ? <span className="track-artists">{track.artists}</span> : null}
    </>
  );
  if (!videoId) {
    return (
      <li>
        <a className="top-cell" href={track.spotifyUrl} target="_blank" rel="noreferrer">
          {copy}
        </a>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        className={active ? "top-cell is-on" : "top-cell"}
        aria-pressed={active}
        onClick={() => {
          const playlistId = playlistIdForTrack(track.id);
          const playlist = playlists.find((row) => row.id === playlistId);
          const queue = (playlist ? tracksFor(playlist.id) : []).flatMap((item) => {
            const id = youtubeVideoId(item.youtubeMusicUrl);
            if (!id) return [];
            return [
              {
                videoId: id,
                title: item.title,
                artists: item.artists,
                artwork: item.artwork,
                crate: playlist?.name ?? "Top 10",
                playlistId: playlist?.id,
                trackId: item.id,
                durationMs: item.durationMs,
              },
            ];
          });
          const radio = queue.find((item) => item.trackId === track.id) ?? {
            videoId,
            title: track.title,
            artists: track.artists,
            artwork: track.artwork,
            crate: playlist?.name ?? "Top 10",
            playlistId,
            trackId: track.id,
            durationMs: track.durationMs,
          };
          onPlay(radio, undefined, queue);
        }}
      >
        {copy}
      </button>
    </li>
  );
}

function formatTuneTime(ms: number): string {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

