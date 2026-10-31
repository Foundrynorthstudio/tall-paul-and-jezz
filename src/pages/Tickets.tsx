import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import { gigs, nextGig, type Gig } from "../data/gigs";
import { useStored, type TicketHold } from "../storage";
import { GigRow } from "./GigRow";

function blankDraft(): TicketHold {
  return { name: "", email: "", qty: 1 };
}

export default function TicketsPage() {
  const { city } = useParams();
  const gig = gigs.find((row) => row.id === city);
  if (!gig) return <Navigate to={`/tickets/${nextGig().id}`} replace />;
  return <TicketScreen gig={gig} />;
}

function TicketScreen({ gig }: { gig: Gig }) {
  const [holds, setHolds] = useStored<Record<string, TicketHold>>("tpj-tickets", {});
  const [drafts, setDrafts] = useState<Record<string, TicketHold>>({});
  const [formError, setFormError] = useState("");
  const draft = drafts[gig.id] ?? holds[gig.id] ?? blankDraft();
  const hold = holds[gig.id];

  useEffect(() => {
    setFormError("");
  }, [gig.id]);

  function updateDraft(patch: Partial<TicketHold>) {
    setDrafts((current) => ({
      ...current,
      [gig.id]: { ...draft, ...patch },
    }));
    setFormError("");
  }

  function submitTicket(event: FormEvent) {
    event.preventDefault();
    const name = draft.name.trim();
    const email = draft.email.trim();
    if (!name) {
      setFormError("Add a name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Add an email address.");
      return;
    }
    setHolds((current) => ({
      ...current,
      [gig.id]: { name, email, qty: draft.qty },
    }));
    setFormError("");
  }

  function editHold() {
    setHolds((current) => {
      const next = { ...current };
      delete next[gig.id];
      return next;
    });
  }

  return (
    <section className="block">
      <div className="wrap page-stack">
        <div>
          <p className="kicker">Desk</p>
          <h1 className="section-title">Tickets</h1>
          <p className="lede">Venue comes with the ticket link. Pick a city to hold tickets.</p>
        </div>
        <div className="gig-list">
          {gigs.map((row) => (
            <GigRow key={row.id} gig={row} selected={row.id === gig.id} />
          ))}
        </div>
        <TicketDesk
          gig={gig}
          draft={draft}
          hold={hold}
          error={formError}
          onChange={updateDraft}
          onSubmit={submitTicket}
          onEdit={editHold}
        />
      </div>
    </section>
  );
}

function TicketDesk({
  gig,
  draft,
  hold,
  error,
  onChange,
  onSubmit,
  onEdit,
}: {
  gig: Gig;
  draft: TicketHold;
  hold: TicketHold | undefined;
  error: string;
  onChange: (patch: Partial<TicketHold>) => void;
  onSubmit: (event: FormEvent) => void;
  onEdit: () => void;
}) {
  return (
    <div className="ticket">
      <p className="ticket-city">{gig.city}</p>
      <p className="ticket-when">
        {gig.weekday} {gig.day} {gig.month} 2027 · {gig.place}
      </p>
      {hold ? (
        <div>
          <p className="hold-name" role="status">
            {hold.name} is marked down for {hold.qty} {hold.qty === 1 ? "ticket" : "tickets"}.
          </p>
          <p className="fine">
            Saved in this browser for {hold.email}. Nothing has been charged, and no mail has been
            sent. This holds the name until the desk can send a real link.
          </p>
          <div className="hero-actions">
            <button className="btn" type="button" onClick={onEdit}>
              Edit request
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              value={draft.name}
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={draft.email}
              onChange={(event) => onChange({ email: event.target.value })}
            />
          </label>
          <div className="field">
            <span className="qty-label" id="qty-label">
              How many
            </span>
            <div className="choice-row" role="group" aria-labelledby="qty-label">
              {[1, 2, 3, 4].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  className={draft.qty === qty ? "is-on" : ""}
                  aria-pressed={draft.qty === qty}
                  onClick={() => onChange({ qty })}
                >
                  {qty}
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="btn" type="submit">
            Request tickets
          </button>
          <p className="fine">
            No payment on this page. The request stays in this browser until the desk can mail a
            real link.
          </p>
        </form>
      )}
    </div>
  );
}
