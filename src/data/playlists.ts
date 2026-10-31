import catalog from "./playlists.json";

export type SpotifyPlaylist = {
  id: string;
  name: string;
  description: string;
  url: string;
  owner: string;
};

type RawPlaylist = {
  id: string;
  name?: string;
  description?: string;
  url?: string;
  owner?: string;
};

type Catalog = {
  userId?: string;
  playlists?: RawPlaylist[];
};

const raw = catalog as Catalog;

function playlistId(value: string): string | null {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/playlist[/:]([A-Za-z0-9]+)/);
  if (fromUrl) return fromUrl[1];
  if (/^[A-Za-z0-9]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

export const spotifyUserId = (raw.userId ?? "").trim();

export const playlists: SpotifyPlaylist[] = (raw.playlists ?? []).flatMap((entry) => {
  const id = playlistId(entry.id);
  if (!id) return [];
  return [
    {
      id,
      name: entry.name?.trim() || "Playlist",
      description: entry.description?.trim() || "",
      url: entry.url?.trim() || `https://open.spotify.com/playlist/${id}`,
      owner: entry.owner?.trim() || "Jezz",
    },
  ];
});

export const spotifyProfileUrl = spotifyUserId
  ? `https://open.spotify.com/user/${encodeURIComponent(spotifyUserId)}`
  : "";

export const playlistMenus = [
  { id: "chill", label: "Chill Vibe" },
  { id: "vibe", label: "Vibe" },
  { id: "harder", label: "Harder Faster" },
  { id: "hardest", label: "Hardest" },
  { id: "key", label: "Key Playlists" },
  { id: "other", label: "Other" },
  { id: "all", label: "All" },
] as const;

export type PlaylistMenu = (typeof playlistMenus)[number]["id"];

/** Chill Vibe 01, pinned by id so a title change cannot drop it. */
export const CHILL_ID = "5cjWLTYFiYh5rmrf6oN9F8";

/** Former House crates, pinned by id so a title change cannot drop them. */
export const VIBE_IDS = new Set([
  "7MWAESjCIBOHcoTN8vssCS",
  "3KXwJ9s9MVOBTPpsA7DV4o",
  "5Xm3z8swLCdGFf9YQQ9QS9",
  "2AcTPHSibhUEAr4VS3jHSi",
  "3iEKG9PZNkLBJ1j3WCrCj8",
  "2MntKZYM2CqECYk6fk58BB",
  "0yWF51vuYx4SGinnl6mcRj",
]);

/** Chill Vibe 01 and Vibe 01 stay on Key as well as their own menus. */
const VIBE_KEY_IDS = new Set([CHILL_ID, "7MWAESjCIBOHcoTN8vssCS"]);

export const HARDER_ID = "0cfpHzBak520bKWPZ0WC0g";

/** Techno and Techno 02, pinned by id so a title change cannot drop them. */
const HARDEST_IDS = new Set(["11jr4LwhvPyxIWoXuPZuGB", "1SIjBFgf2R23VJF9fn0zPz"]);

/** Shared site playlist, Jezz and Tall Paul. */
export const DUO_ID = "3edR4o6bZ40CIgM2BRZqmv";

const KEY_NAMES = new Set([
  "jezz and tall paul",
  "jezz harder faster 01",
  "dj list",
  "techno",
  "techno 02",
  "d&b",
  "disco 01",
  "beats 01",
  "game of the day",
  "synth chill",
  "nu indie",
  "vibes",
  "vibes 02",
  "shegra vibes",
  "americana",
  "daves picks",
  "dave's irish bangers",
  "matheo's banging beats",
  "classic indie",
  "indie",
  "indie pop",
  "buy",
  "radio tuned",
]);

export function playlistNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasTrackTiles(id: string): boolean {
  return VIBE_IDS.has(id) || id === CHILL_ID || id === HARDER_ID || id === DUO_ID;
}

export function spotifyTrackEmbed(id: string): string {
  return `https://open.spotify.com/embed/track/${id}?utm_source=generator`;
}

export function youtubeEmbed(videoId: string): string {
  return youtubePlaylistEmbed([videoId]);
}

/** One on-site player for a whole crate. `loop` restarts after the last video. */
export function youtubePlaylistEmbed(videoIds: string[], origin?: string): string {
  const ids = videoIds.filter(Boolean);
  const first = ids[0];
  if (!first) return "";
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    playsinline: "1",
    loop: "1",
    enablejsapi: "1",
    playlist: ids.join(","),
  });
  if (origin) params.set("origin", origin);
  return `https://www.youtube-nocookie.com/embed/${first}?${params}`;
}

export function youtubeVideoId(url: string | null): string | null {
  if (!url) return null;
  const watch = url.match(/[?&]v=([^&]+)/);
  if (watch) return watch[1];
  const short = url.match(/youtu\.be\/([^?]+)/);
  return short?.[1] ?? null;
}

export function inPlaylistMenu(
  playlist: { id: string; name: string },
  menu: PlaylistMenu,
): boolean {
  const key = playlistNameKey(playlist.name);
  const chill = playlist.id === CHILL_ID;
  const vibe = VIBE_IDS.has(playlist.id);
  const harder = playlist.id === HARDER_ID || key.includes("harder faster");
  const hardest = HARDEST_IDS.has(playlist.id);
  const featured = KEY_NAMES.has(key) || VIBE_KEY_IDS.has(playlist.id) || playlist.id === HARDER_ID;
  if (menu === "all") return true;
  if (menu === "chill") return chill;
  if (menu === "vibe") return vibe;
  if (menu === "harder") return harder;
  if (menu === "hardest") return hardest;
  if (menu === "key") return featured;
  return !chill && !vibe && !harder && !hardest && !featured;
}

export function comparePlaylistNames(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export function embedSrc(id: string): string {
  return `https://open.spotify.com/embed/playlist/${id}?utm_source=generator`;
}
