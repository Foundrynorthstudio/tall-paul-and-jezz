import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { sign } from "node:crypto";

const OUT = "src/data/tracks.json";
const PLAYLISTS_IN = "src/data/playlists.json";

function playlistIds() {
  if (!existsSync(PLAYLISTS_IN)) return [];
  const catalog = JSON.parse(readFileSync(PLAYLISTS_IN, "utf8"));
  const ids = [];
  const seen = new Set();
  for (const entry of catalog.playlists ?? []) {
    const id = String(entry?.id ?? "").trim();
    if (!/^[A-Za-z0-9]+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

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

function plain(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function largestImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const sorted = [...images].sort(
    (a, b) => (b.maxWidth || b.width || 0) - (a.maxWidth || a.width || 0),
  );
  return sorted[0]?.url || null;
}

function emptyTrack(id, title, artists, durationMs) {
  return {
    id,
    isrc: null,
    title: title || "Track",
    artists: artists || "",
    durationMs: Number(durationMs) || 0,
    artwork: null,
    spotifyUrl: `https://open.spotify.com/track/${id}`,
    appleUrl: null,
    youtubeMusicUrl: null,
  };
}

async function fetchText(url) {
  let wait = 2000;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : wait;
      await new Promise((resolve) => setTimeout(resolve, delay));
      wait = Math.min(wait * 2, 20000);
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} for ${url}`);
    return response.text();
  }
  throw new Error(`429 for ${url}`);
}

async function embedJson(url) {
  const html = await fetchText(url);
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/,
  );
  if (!match) throw new Error(`No embed data for ${url}`);
  return JSON.parse(match[1]);
}

async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return out;
}

async function spotifyToken(clientId, clientSecret) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error(`Spotify token request failed (${response.status}).`);
  }
  const body = await response.json();
  return body.access_token;
}

async function tracksFromApi(playlistId, token) {
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&market=GB`;
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Spotify tracks failed (${response.status}): ${detail}`);
    }
    const body = await response.json();
    for (const item of body.items ?? []) {
      const track = item?.track;
      if (!track || track.type !== "track" || !track.id) continue;
      const row = emptyTrack(
        track.id,
        plain(track.name),
        (track.artists ?? []).map((artist) => plain(artist.name)).filter(Boolean).join(", "),
        track.duration_ms,
      );
      row.isrc = plain(track.external_ids?.isrc) || null;
      row.artwork = largestImage(track.album?.images);
      row.spotifyUrl = track.external_urls?.spotify || row.spotifyUrl;
      tracks.push(row);
    }
    url = body.next;
  }
  return tracks;
}

async function tracksFromEmbed(playlistId) {
  const json = await embedJson(`https://open.spotify.com/embed/playlist/${playlistId}`);
  const entity = json?.props?.pageProps?.state?.data?.entity;
  const tracks = [];
  for (const item of entity?.trackList ?? []) {
    if (item?.entityType !== "track") continue;
    const uri = String(item.uri ?? "");
    if (!uri.startsWith("spotify:track:")) continue;
    const id = uri.slice("spotify:track:".length);
    if (!/^[A-Za-z0-9]+$/.test(id)) continue;
    tracks.push(emptyTrack(id, plain(item.title), plain(item.subtitle), item.duration));
  }
  return tracks;
}

async function artworkFor(trackId) {
  const json = await embedJson(`https://open.spotify.com/embed/track/${trackId}`);
  const entity = json?.props?.pageProps?.state?.data?.entity;
  return largestImage(entity?.visualIdentity?.image);
}

function appleDeveloperToken() {
  const teamId = process.env.APPLE_TEAM_ID || "";
  const keyId = process.env.APPLE_KEY_ID || "";
  let privateKey = process.env.APPLE_PRIVATE_KEY || "";
  if (!teamId || !keyId || !privateKey) return null;
  privateKey = privateKey.replace(/\\n/g, "\n");
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: teamId, iat: now, exp: now + 60 * 60 * 12 }),
  ).toString("base64url");
  const signature = sign("SHA256", Buffer.from(`${header}.${payload}`), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

async function appleUrlsFor(token, isrcs) {
  const found = new Map();
  const unique = [...new Set(isrcs.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 20) {
    const batch = unique.slice(index, index + 20);
    const url = `https://api.music.apple.com/v1/catalog/gb/songs?filter[isrc]=${batch
      .map((isrc) => encodeURIComponent(isrc))
      .join(",")}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const detail = await response.text();
      console.warn(`Apple Music lookup failed (${response.status}): ${detail.slice(0, 240)}`);
      break;
    }
    const body = await response.json();
    for (const song of body.data ?? []) {
      const isrc = song.attributes?.isrc;
      const songUrl = song.attributes?.url;
      if (isrc && songUrl && !found.has(isrc)) found.set(isrc, songUrl);
    }
  }
  return found;
}

let catalogOpen = true;

async function enrichFromCatalog(tracks, token) {
  if (!catalogOpen) return;
  for (const track of tracks) {
    if (!catalogOpen) return;
    let response = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      response = await fetch(`https://api.spotify.com/v1/tracks/${track.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status !== 429) break;
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 * attempt;
      if (waitSeconds > 60) {
        catalogOpen = false;
        console.warn(
          `Spotify track lookup is rate limited for ${Math.round(waitSeconds / 60)} minutes. Leaving the remaining covers for the next sync.`,
        );
        return;
      }
      console.warn(`Spotify track lookup rate limited. Waiting ${Math.round(waitSeconds)}s.`);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    }
    if (!response?.ok) {
      console.warn(
        `Spotify track lookup failed (${response?.status ?? "no response"}). Covers stay as the embed left them.`,
      );
      continue;
    }
    const full = await response.json();
    track.isrc = plain(full.external_ids?.isrc) || track.isrc;
    track.artwork = largestImage(full.album?.images) || track.artwork;
    track.spotifyUrl = full.external_urls?.spotify || track.spotifyUrl;
    if (full.duration_ms) track.durationMs = full.duration_ms;
    if (full.name) track.title = plain(full.name);
    const artists = (full.artists ?? []).map((artist) => plain(artist.name)).filter(Boolean).join(", ");
    if (artists) track.artists = artists;
  }
}

async function youtubeMusicUrl(apiKey, artists, title) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoCategoryId", "10");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("q", `${artists} ${title}`.trim());
  url.searchParams.set("key", apiKey);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch(url);
    if (response.status === 429) {
      const detail = await response.text();
      if (detail.includes("per day")) {
        const error = new Error(`YouTube daily cap: ${detail.slice(0, 180)}`);
        error.stop = true;
        throw error;
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 70000;
      console.warn(`YouTube rate limit. Waiting ${Math.round(delay / 1000)}s.`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(`YouTube search failed (${response.status}): ${detail.slice(0, 240)}`);
      error.stop = response.status === 400 || response.status === 403;
      throw error;
    }
    const body = await response.json();
    const videoId = body.items?.[0]?.id?.videoId;
    return videoId ? `https://music.youtube.com/watch?v=${videoId}` : null;
  }
  throw new Error("YouTube rate limit persisted.");
}

loadEnvFile();

const clientId = process.env.SPOTIFY_CLIENT_ID || "";
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
const youtubeKey = process.env.YOUTUBE_API_KEY || "";
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { playlists: {} };
const priorById = new Map();
for (const rows of Object.values(previous.playlists ?? {})) {
  for (const row of rows ?? []) {
    if (row?.id && !priorById.has(row.id)) priorById.set(row.id, row);
  }
}

let apiToken = "";
if (clientId && clientSecret) {
  apiToken = await spotifyToken(clientId, clientSecret);
  console.log("Using the Spotify Web API for tracks, artwork, and ISRC.");
} else {
  console.log(
    "No SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET. Reading public embeds. ISRC stays empty until those keys are in .env.",
  );
}

let appleToken = null;
try {
  appleToken = appleDeveloperToken();
} catch (error) {
  console.warn(`Apple Music token could not be signed: ${error.message}`);
}
if (!appleToken) {
  console.log(
    "No Apple Music key (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY). Apple links stay unresolved.",
  );
}

if (!youtubeKey) {
  console.log("No YOUTUBE_API_KEY. YouTube Music links stay unresolved.");
}

const playlists = {};
const artworkCache = new Map();
const playlistIdList = playlistIds();
console.log(`Syncing ${playlistIdList.length} public playlists.`);

function keepSaved(playlistId, saved) {
  const kept = Array.isArray(saved) ? saved : [];
  playlists[playlistId] = kept.map((row) => ({ ...row }));
  return kept.length;
}

for (const playlistId of playlistIdList) {
  const saved = previous.playlists?.[playlistId];
  const savedCount = Array.isArray(saved) ? saved.length : 0;
  if (!apiToken && savedCount > 0) {
    keepSaved(playlistId, saved);
    console.log(`${playlistId}: kept ${savedCount} saved tracks`);
    continue;
  }
  try {
    const tracks = apiToken
      ? await tracksFromApi(playlistId, apiToken)
      : await tracksFromEmbed(playlistId);
    console.log(`${playlistId}: ${tracks.length} tracks`);
    playlists[playlistId] = tracks;
  } catch (error) {
    const reason = String(error.message ?? "failed").slice(0, 180);
    try {
      const tracks = await tracksFromEmbed(playlistId);
      if (tracks.length < savedCount) {
        keepSaved(playlistId, saved);
        console.warn(
          `${playlistId}: embed has ${tracks.length} tracks, saved crate has ${savedCount}. Keeping the saved crate.`,
        );
        continue;
      }
      if (apiToken) {
        for (const track of tracks) {
          const prior = priorById.get(track.id);
          if (!track.artwork && prior?.artwork) track.artwork = prior.artwork;
          if (!track.isrc && prior?.isrc) track.isrc = prior.isrc;
        }
        const missing = tracks.filter((track) => !track.artwork || !track.isrc);
        if (missing.length > 0) await enrichFromCatalog(missing, apiToken);
      }
      console.log(`${playlistId}: ${tracks.length} tracks from the public embed.`);
      playlists[playlistId] = tracks;
    } catch (embedError) {
      keepSaved(playlistId, saved);
      console.warn(
        `Playlist ${playlistId} failed (${reason}). Embed failed (${embedError.message}). Keeping ${savedCount} saved tracks.`,
      );
    }
  }
}

if (!apiToken) {
  const missing = [];
  const queued = new Set();
  for (const tracks of Object.values(playlists)) {
    for (const track of tracks) {
      const prior = priorById.get(track.id);
      if (track.artwork || prior?.artwork) {
        track.artwork = track.artwork || prior.artwork;
        artworkCache.set(track.id, track.artwork);
      } else if (!artworkCache.has(track.id) && !queued.has(track.id)) {
        queued.add(track.id);
        missing.push(track.id);
      }
    }
  }
  console.log(`Fetching album art for ${missing.length} tracks.`);
  let done = 0;
  await pool(missing, 2, async (trackId) => {
    try {
      artworkCache.set(trackId, await artworkFor(trackId));
    } catch (error) {
      console.warn(`Artwork failed for ${trackId}: ${error.message}`);
      artworkCache.set(trackId, null);
    }
    done += 1;
    if (done % 50 === 0 || done === missing.length) {
      console.log(`Artwork ${done}/${missing.length}`);
    }
  });
  for (const tracks of Object.values(playlists)) {
    for (const track of tracks) {
      if (!track.artwork) track.artwork = artworkCache.get(track.id) ?? null;
    }
  }
}

const isrcs = [];
for (const tracks of Object.values(playlists)) {
  for (const track of tracks) {
    if (track.isrc) isrcs.push(track.isrc);
  }
}

let appleByIsrc = new Map();
if (appleToken && isrcs.length > 0) {
  appleByIsrc = await appleUrlsFor(appleToken, isrcs);
  console.log(`Apple Music matched ${appleByIsrc.size} recordings.`);
} else if (appleToken) {
  console.log("Apple Music key is set, but these tracks have no ISRC to look up.");
}

function writeTracks() {
  writeFileSync(OUT, `${JSON.stringify({ playlists }, null, 2)}\n`);
}

const youtubeCache = new Map();
for (const rows of Object.values(previous.playlists ?? {})) {
  for (const row of rows ?? []) {
    if (row?.id && row.youtubeMusicUrl && !youtubeCache.has(row.id)) {
      youtubeCache.set(row.id, row.youtubeMusicUrl);
    }
  }
}

for (const tracks of Object.values(playlists)) {
  for (const track of tracks) {
    const prior = priorById.get(track.id);
    if (!track.artwork && prior?.artwork) track.artwork = prior.artwork;
    if (!track.isrc && prior?.isrc) track.isrc = prior.isrc;
    if (track.isrc && appleByIsrc.has(track.isrc)) {
      track.appleUrl = appleByIsrc.get(track.isrc);
    } else if (appleToken && track.isrc) {
      track.appleUrl = null;
    } else if (prior?.appleUrl) {
      track.appleUrl = prior.appleUrl;
    }
    const savedYoutube = youtubeCache.get(track.id) || prior?.youtubeMusicUrl || null;
    if (savedYoutube) {
      youtubeCache.set(track.id, savedYoutube);
      track.youtubeMusicUrl = savedYoutube;
    }
  }
}

writeTracks();
console.log(`Wrote ${OUT} before YouTube search.`);

let youtubeOpen = Boolean(youtubeKey);
let youtubeFound = 0;
if (youtubeKey) {
  for (const tracks of Object.values(playlists)) {
    for (const track of tracks) {
      const cached = youtubeCache.get(track.id);
      if (cached) {
        track.youtubeMusicUrl = cached;
        continue;
      }
      if (track.youtubeMusicUrl) continue;
      if (!youtubeOpen) continue;
      try {
        const url = await youtubeMusicUrl(youtubeKey, track.artists, track.title);
        if (url) {
          youtubeCache.set(track.id, url);
          track.youtubeMusicUrl = url;
          youtubeFound += 1;
          if (youtubeFound % 20 === 0) {
            writeTracks();
            console.log(`YouTube links saved: ${youtubeFound}`);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.warn(error.message);
        const kept = youtubeCache.get(track.id) || null;
        if (kept) track.youtubeMusicUrl = kept;
        if (error.stop) {
          youtubeOpen = false;
          console.warn("Stopping YouTube lookups after that error. Earlier matches are kept.");
        }
      }
    }
  }
}

writeTracks();
console.log(`Wrote ${OUT}`);
