import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import GigsPage from "./pages/Gigs";
import Home, { About } from "./pages/Home";
import { playlists, spotifyProfileUrl } from "./data/playlists";
import { Playlists } from "./Playlists";
import MerchPage from "./pages/Merch";
import SetsPage from "./pages/Sets";
import TicketsPage from "./pages/Tickets";
import Radio, { type RadioTrack } from "./Radio";
import { useStored, type BagLine } from "./storage";

const NAV = [
  { to: "/gigs", label: "Gigs" },
  { to: "/tickets", label: "Tickets" },
  { to: "/playlists", label: "Playlists" },
  { to: "/about", label: "About" },
  { to: "/sets", label: "Set lists" },
  { to: "/merch", label: "Merch" },
] as const;

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bag, setBag] = useStored<BagLine[]>("tpj-bag", []);
  const [soundOn, setSoundOn] = useState(true);
  const [nowVideoId, setNowVideoId] = useState("");
  const [nowSeconds, setNowSeconds] = useState(0);
  const playTrack = useRef<(track: RadioTrack, startSeconds?: number) => void>(() => {});
  const seekTo = useRef<(seconds: number) => void>(() => {});
  const { pathname, hash } = useLocation();
  const bagCount = bag.reduce((sum, line) => sum + line.qty, 0);

  useEffect(() => {
    setMenuOpen(false);
    if (hash) {
      const id = hash.slice(1);
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <>
      <Link className="skip" to="/playlists">
        Skip to playlists
      </Link>
      <header className="site-header" id="top">
        <div className="wrap header-inner">
          <Link className="brand" to="/" onClick={() => setMenuOpen(false)}>
            <img src="/brand/logo-mark.jpg" alt="" />
            <span className="brand-name">
              Tall Paul
              <br />
              <span className="and">and</span> Jezz
            </span>
          </Link>
          <div className="header-tools">
            <nav id="site-nav" className={menuOpen ? "nav-links is-open" : "nav-links"}>
              {NAV.map((item) => {
                const current =
                  pathname === item.to || (item.to === "/tickets" && pathname.startsWith("/tickets"));
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={current ? "is-on" : undefined}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                    {item.to === "/merch" && bagCount > 0 ? ` (${bagCount})` : ""}
                  </Link>
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
            <button
              type="button"
              className={soundOn ? "sound-btn is-on" : "sound-btn"}
              aria-pressed={soundOn}
              onClick={() => setSoundOn((on) => !on)}
            >
              {soundOn ? "Sound on" : "Sound off"}
            </button>
          </div>
        </div>
        <Radio
          soundOn={soundOn}
          playTrack={playTrack}
          seekTo={seekTo}
          onNow={setNowVideoId}
          onTime={setNowSeconds}
        />
      </header>

      <main>
        <Routes>
          <Route
            path="/"
            element={
              <Home
                nowVideoId={nowVideoId}
                onPlayTrack={(track, startSeconds) => playTrack.current(track, startSeconds)}
              />
            }
          />
          <Route
            path="/playlists"
            element={
              <Playlists
                playlists={playlists}
                profileUrl={spotifyProfileUrl}
                nowVideoId={nowVideoId}
                nowSeconds={nowSeconds}
                onSeek={(seconds) => seekTo.current(seconds)}
                onPlayTrack={(track, startSeconds) => playTrack.current(track, startSeconds)}
              />
            }
          />
          <Route
            path="/about"
            element={
              <About
                profileUrl={spotifyProfileUrl}
                nowVideoId={nowVideoId}
                onPlayTrack={(track, startSeconds) => playTrack.current(track, startSeconds)}
              />
            }
          />
          <Route path="/gigs" element={<GigsPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:city" element={<Navigate to="/tickets" replace />} />
          <Route path="/sets" element={<SetsPage />} />
          <Route path="/merch" element={<MerchPage bag={bag} setBag={setBag} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
            <Link to="/">tallpaulandjezz.com</Link>
          </p>
        </div>
      </footer>
    </>
  );
}
