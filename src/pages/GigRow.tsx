import { Link } from "react-router-dom";
import type { Gig } from "../data/gigs";

export function GigRow({ gig, selected }: { gig: Gig; selected: boolean }) {
  return (
    <Link
      to={`/tickets/${gig.id}`}
      className={selected ? "gig is-on" : "gig"}
      aria-current={selected ? "page" : undefined}
    >
      <span className="gig-date">
        {gig.month} {gig.day}
      </span>
      <span className="gig-mark" aria-hidden="true" />
      <span>
        <span className="gig-city">{gig.city}</span>
        <span className="gig-place">
          {gig.weekday}, {gig.place}
        </span>
      </span>
    </Link>
  );
}
