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

export const HARDER_ID = "0cfpHzBak520bKWPZ0WC0g";

/** Techno and Techno 02, pinned by id so a title change cannot drop them. */
const HARDEST_IDS = new Set(["11jr4LwhvPyxIWoXuPZuGB", "1SIjBFgf2R23VJF9fn0zPz"]);

/** Shared site playlist, shown as Tall Paul and Jezz. */
export const DUO_ID = "3edR4o6bZ40CIgM2BRZqmv";
export const DUO_NAME = "Tall Paul and Jezz";

/** Highest numbered Vibe crate, so a new Vibe 08 becomes the latest on its own. */
export function latestVibe(): SpotifyPlaylist | null {
  let best: SpotifyPlaylist | null = null;
  let bestNumber = -1;
  for (const playlist of playlists) {
    if (!VIBE_IDS.has(playlist.id)) continue;
    const match = playlist.name.match(/(\d+)/);
    const number = match ? Number(match[1]) : -1;
    if (number > bestNumber) {
      bestNumber = number;
      best = playlist;
    }
  }
  return best;
}

const KEY_NAMES = new Set([
  "shegra vibes",
  "dave's irish bangers",
  "beats for the car",
  "daves picks",
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

/** One on-site player for a whole crate. Looping is controlled from the radio. */
export function youtubePlaylistEmbed(videoIds: string[], origin?: string, muted = false): string {
  const ids = videoIds.filter(Boolean);
  const first = ids[0];
  if (!first) return "";
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    playsinline: "1",
    enablejsapi: "1",
    playlist: ids.join(","),
  });
  if (muted) params.set("mute", "1");
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
  const featured = KEY_NAMES.has(key);
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
