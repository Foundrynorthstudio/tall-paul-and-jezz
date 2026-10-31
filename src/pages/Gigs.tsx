import { gigs } from "../data/gigs";
import { GigRow } from "./GigRow";

export default function GigsPage() {
  return (
    <section className="block">
      <div className="wrap">
        <p className="kicker">2027 tour</p>
        <h1 className="section-title">Gigs</h1>
        <p className="lede">Venue comes with the ticket link. Pick a city to hold tickets.</p>
        <div className="gig-list">
          {gigs.map((gig) => (
            <GigRow key={gig.id} gig={gig} selected={false} />
          ))}
        </div>
      </div>
    </section>
  );
}
