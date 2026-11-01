import { existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "src/data/beatport.json";
const TRACKS = "src/data/tracks.json";
const PAUL = "src/data/paul-playlists.json";

function loadEnvFile() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function safeDetail(text) {
  const token = process.env.BEATPORT_TOKEN || "";
  return (token ? text.replaceAll(token, "[token]") : text).slice(0, 180);
}

function catalogTracks() {
  const seen = new Set();
  const tracks = [];
  const spotify = readJson(TRACKS, { playlists: {} });
  for (const list of Object.values(spotify.playlists ?? {})) {
    for (const track of list ?? []) pushTrack(tracks, seen, track);
  }
  for (const playlist of readJson(PAUL, [])) {
    for (const track of playlist.tracks ?? []) pushTrack(tracks, seen, track);
  }
  return tracks;
}

function pushTrack(tracks, seen, track) {
  const id = String(track?.id ?? "").trim();
  const title = String(track?.title ?? "").trim();
  const artists = String(track?.artists ?? "").trim();
  if (!id || !title || seen.has(id)) return;
  seen.add(id);
  tracks.push({ id, title, artists, isrc: String(track?.isrc ?? "").trim() });
}

async function beatport(path, params) {
  const url = new URL(`https://api.beatport.com/v4/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.BEATPORT_TOKEN}`,
    },
  });
  const text = await response.text();
  if (response.status === 429) {
    const error = new Error("Beatport rate limit. Saved matches were left as they are.");
    error.quota = true;
    throw error;
  }
  if (response.status === 401 || response.status === 403) {
    const error = new Error(`Beatport refused the token (${response.status}). Saved matches were left as they are.`);
    error.auth = true;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`Beatport ${path} failed (${response.status}): ${safeDetail(text)}`);
  }
  return JSON.parse(text);
}

function rowsOf(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.tracks)) return body.tracks;
  return [];
}

function agrees(ours, theirs) {
  const title = norm(ours.title);
  const name = norm(theirs?.name || theirs?.title);
  if (!title || !name || name.length < 3) return false;
  if (title !== name && !title.includes(name) && !name.includes(title)) return false;
  const oursArtists = norm(ours.artists);
  const names = (Array.isArray(theirs?.artists) ? theirs.artists : [])
    .map((artist) => norm(typeof artist === "string" ? artist : artist?.name))
    .filter((artist) => artist.length >= 2);
  if (!oursArtists || names.length === 0) return false;
  return names.some((artist) => oursArtists.includes(artist) || artist.includes(oursArtists));
}

function keyOf(track) {
  const key = track?.key;
  if (typeof key === "string") return key.trim();
  if (key && typeof key === "object") {
    const number = key.camelot_number ?? key.camelotNumber;
    const letter = key.camelot_letter ?? key.camelotLetter;
    if (number && letter) return `${number}${letter}`;
    if (typeof key.name === "string") return key.name.trim();
  }
  if (typeof track?.key_name === "string") return track.key_name.trim();
  return "";
}

function genreOf(track) {
  if (typeof track?.genre === "string") return track.genre.trim();
  if (typeof track?.genre?.name === "string") return track.genre.name.trim();
  if (typeof track?.genres?.[0]?.name === "string") return track.genres[0].name.trim();
  return "";
}

function urlOf(track) {
  if (typeof track?.url === "string" && track.url.startsWith("http")) return track.url;
  const slug = String(track?.slug ?? "").trim();
  const id = track?.id;
  if (slug && id) return `https://www.beatport.com/track/${slug}/${id}`;
  return "";
}

function matchOf(ours, theirs) {
  if (!agrees(ours, theirs)) return null;
  const bpm = Number(theirs?.bpm);
  const key = keyOf(theirs);
  const url = urlOf(theirs);
  const beatportId = String(theirs?.id ?? "").trim();
  if (!beatportId || !url || !key || !(bpm > 0)) return null;
  return { beatportId, url, bpm, key, genre: genreOf(theirs) };
}

async function findMatch(track) {
  if (track.isrc) {
    const byIsrc = await beatport("catalog/tracks/", { isrc: track.isrc, per_page: "5" });
    for (const row of rowsOf(byIsrc)) {
      const match = matchOf(track, row);
      if (match) return match;
    }
  }
  const query = [track.artists, track.title].filter(Boolean).join(" ");
  const found = await beatport("catalog/search/", { q: query, type: "tracks", per_page: "5" });
  for (const row of rowsOf(found)) {
    const match = matchOf(track, row);
    if (match) return match;
  }
  return null;
}

loadEnvFile();

if (!process.env.BEATPORT_TOKEN) {
  console.log("No BEATPORT_TOKEN. Saved Beatport matches were left as they are.");
  process.exit(0);
}

const saved = readJson(OUT, {});
const next = saved && typeof saved === "object" && !Array.isArray(saved) ? { ...saved } : {};

try {
  let confirmed = 0;
  for (const track of catalogTracks()) {
    const match = await findMatch(track);
    if (!match) continue;
    next[track.id] = match;
    confirmed += 1;
  }
  writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Confirmed ${confirmed} Beatport matches.`);
} catch (error) {
  if (error.quota) {
    writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);
    console.warn(error.message);
    process.exit(0);
  }
  console.error(error.message);
  process.exit(1);
}
