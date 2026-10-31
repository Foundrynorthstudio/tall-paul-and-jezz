import { gigs } from "../data/gigs";

export default function SetsPage() {
  return (
    <section className="block">
      <div className="wrap">
        <p className="kicker">After the night</p>
        <h1 className="section-title">Set lists</h1>
        <p className="lede">
          House and techno. The tracklist goes up the morning after each show. Nothing is published
          before the night.
        </p>
        <div className="set-list">
          {gigs.map((gig) => (
            <details key={gig.id} className="set">
              <summary>
                <span className="set-date">
                  {gig.month} {gig.day}
                </span>
                <span className="set-city">{gig.city}</span>
                <span className="set-status">After the show</span>
              </summary>
              <p className="set-body">
                {gig.weekday} {gig.day} {gig.month} 2027, {gig.city}. The running order is written
                down once the set is done.
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
