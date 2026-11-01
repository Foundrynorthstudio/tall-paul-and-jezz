import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import SetsPage from "./pages/Sets";
import "./index.css";

const NAV = [
  { href: "/playlists", label: "Playlists" },
  { href: "/week", label: "Tracks of the week" },
  { href: "/about", label: "About" },
  { href: "/sets/", label: "Set lists" },
  { href: "/gigs", label: "Gigs" },
  { href: "/merch", label: "Merch" },
];

export default function Desk() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("desk-page");
    return () => document.body.classList.remove("desk-page");
  }, []);

  return (
    <>
      <a className="skip" href="#set-order">
        Skip to the running order
      </a>
      <header className="site-header">
        <div className="wrap header-inner">
          <a className="brand" href="/">
            <img src="/brand/logo-header.jpg" alt="" />
            <span className="brand-name">
              Tall Paul
              <br />
              <span className="and">and</span> Jezz
            </span>
          </a>
          <div className="header-tools">
            <nav id="site-nav" className={menuOpen ? "nav-links is-open" : "nav-links"}>
              {NAV.map((item) => {
                const current = item.href === "/sets/";
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={current ? "is-on" : undefined}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
            <button
              className="menu-btn"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="site-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>
      <main>
        <SetsPage />
      </main>
      <footer className="site-footer">
        <div className="wrap footer-inner">
          <div>
            <p className="footer-name">Tall Paul and Jezz</p>
            <p className="footer-meta">
              House &amp; techno
              <span className="flag" aria-hidden="true" />
            </p>
          </div>
          <p className="footer-meta">
            <a href="/">tallpaulandjezz.com</a>
          </p>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Desk />
  </StrictMode>,
);
