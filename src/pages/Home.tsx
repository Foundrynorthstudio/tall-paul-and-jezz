import { Link } from "react-router-dom";
import { monthName, nextGig } from "../data/gigs";
import { playlists, spotifyProfileUrl } from "../data/playlists";
import { Playlists } from "../Playlists";
import type { RadioTrack } from "../Radio";

export default function Home({
  nowVideoId,
  onPlayTrack,
}: {
  nowVideoId: string;
  onPlayTrack: (track: RadioTrack) => void;
}) {
  const upcoming = nextGig();

  return (
    <>
      <section className="hero">
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
            <p className="tour-label">2027 tour</p>
          </div>
        </div>
        <div className="wrap hero-foot">
          <p className="kicker">House &amp; techno</p>
          <p className="lede">
            Ten dates, from {upcoming.city} on {upcoming.weekday} {Number(upcoming.day)}{" "}
            {monthName(upcoming.month)} through Bulawayo in November. Tickets and info live on this
            site.
          </p>
          <div className="hero-actions">
            <Link className="btn" to="/gigs">
              See the dates
            </Link>
            <Link className="btn btn-ghost" to={`/tickets/${upcoming.id}`}>
              {upcoming.city} tickets
            </Link>
          </div>
        </div>
      </section>
      <Playlists
        playlists={playlists}
        profileUrl={spotifyProfileUrl}
        nowVideoId={nowVideoId}
        onPlayTrack={onPlayTrack}
      />
    </>
  );
}
