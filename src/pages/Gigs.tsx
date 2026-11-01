import { useState } from "react";
import { gigs, monthName, nextGig, type Gig } from "../data/gigs";
import { useStored, type TicketLine } from "../storage";
import { GigRow } from "./GigRow";

function linesFrom(stored: unknown): TicketLine[] {
  return Array.isArray(stored) ? stored.filter((line) => line && typeof line.gigId === "string") : [];
}

export default function GigsPage() {
  const [stored, setStored] = useStored<TicketLine[]>("tpj-tickets", []);
  const cart = linesFrom(stored);
  const [selectedId, setSelectedId] = useState(nextGig().id);
  const [qty, setQty] = useState(1);
  const selected = gigs.find((gig) => gig.id === selectedId) ?? gigs[0];

  function addTicket(gig: Gig) {
    const held = linesFrom(stored);
    setStored(
      held.some((line) => line.gigId === gig.id)
        ? held.map((line) =>
            line.gigId === gig.id ? { ...line, qty: Math.min(6, line.qty + qty) } : line,
          )
        : [...held, { gigId: gig.id, qty }],
    );
  }

  function changeQty(gigId: string, delta: number) {
    setStored(
      linesFrom(stored).flatMap((line) => {
        if (line.gigId !== gigId) return [line];
        const next = line.qty + delta;
        if (next < 1) return [];
        return [{ ...line, qty: Math.min(6, next) }];
      }),
    );
  }

  return (
    <section className="block">
      <div className="wrap">
        <p className="kicker">2027 tour</p>
        <h1 className="section-title">Gigs</h1>
        <p className="lede">
          A demo cart. Nothing is charged and no mail is sent. The hold stays in this browser.
        </p>
        <div className="bill-grid">
          <div className="gig-list">
            {gigs.map((gig) => (
              <GigRow
                key={gig.id}
                gig={gig}
                selected={gig.id === selected.id}
                onSelect={() => {
                  setSelectedId(gig.id);
                  setQty(1);
                }}
              />
            ))}
          </div>
          <form
            className="ticket"
            onSubmit={(event) => {
              event.preventDefault();
              addTicket(selected);
            }}
          >
            <p className="kicker">Ticket</p>
            <h2 className="ticket-city">{selected.city}</h2>
            <p className="ticket-when">
              {selected.weekday} {selected.day} {monthName(selected.month)} 2027
              <br />
              {selected.place}
            </p>
            <div className="field">
              <span id="ticket-qty">Tickets</span>
              <div className="qty-ctl" role="group" aria-labelledby="ticket-qty">
                <button type="button" onClick={() => setQty((current) => Math.max(1, current - 1))} aria-label="Fewer tickets">
                  −
                </button>
                <span>{qty}</span>
                <button type="button" onClick={() => setQty((current) => Math.min(6, current + 1))} aria-label="More tickets">
                  +
                </button>
              </div>
            </div>
            <button className="btn" type="submit">
              Add to cart
            </button>
          </form>
        </div>
        <div className="bag" aria-live="polite">
          <h3>Cart</h3>
          {cart.length === 0 ? (
            <p>Nothing in the cart.</p>
          ) : (
            cart.map((line) => {
              const gig = gigs.find((item) => item.id === line.gigId);
              if (!gig) return null;
              return (
                <div className="bag-line" key={line.gigId}>
                  <div>
                    <strong>{gig.city}</strong>
                    <span className="fine">
                      {gig.weekday} {gig.day} {monthName(gig.month)} · {line.qty}{" "}
                      {line.qty === 1 ? "ticket" : "tickets"}
                    </span>
                  </div>
                  <div className="qty-ctl">
                    <button type="button" onClick={() => changeQty(gig.id, -1)} aria-label={`Fewer tickets for ${gig.city}`}>
                      −
                    </button>
                    <span>{line.qty}</span>
                    <button type="button" onClick={() => changeQty(gig.id, 1)} aria-label={`More tickets for ${gig.city}`}>
                      +
                    </button>
                  </div>
                  <button className="text-btn" type="button" onClick={() => changeQty(gig.id, -line.qty)}>
                    Remove
                  </button>
                </div>
              );
            })
          )}
          <p className="fine">Held in this browser. Nothing is charged and no mail is sent.</p>
        </div>
      </div>
    </section>
  );
}
