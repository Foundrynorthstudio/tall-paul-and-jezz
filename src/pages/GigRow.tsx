import type { Gig } from "../data/gigs";

export function GigRow({ gig, selected, onSelect }: { gig: Gig; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={selected ? "gig is-on" : "gig"}
      aria-pressed={selected}
      onClick={onSelect}
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
    </button>
  );
}
