import { existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "src/data/playlists.json";

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
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function playlistId(value) {
  const trimmed = String(value ?? "").trim();
  const fromUrl = trimmed.match(/playlist[/:]([A-Za-z0-9]+)/);
  if (fromUrl) return fromUrl[1];
  if (/^[A-Za-z0-9]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

async function enrichExisting(current) {
  const next = [];
  for (const entry of current.playlists ?? []) {
    const id = playlistId(entry.id);
    if (!id) {
      console.warn(`Skipping unrecognised playlist value: ${entry.id}`);
      continue;
    }
    const url = `https://open.spotify.com/playlist/${id}`;
    const response = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
    );
    if (!response.ok) {
      console.warn(`oEmbed ${response.status} for ${id}; keeping the existing name.`);
      next.push({ ...entry, id, url: entry.url || url });
      continue;
    }
    const body = await response.json();
    next.push({
      id,
      name: plain(body.title) || entry.name || "Playlist",
      description: entry.description || "",
      url,
      owner: plain(body.author_name) || entry.owner || "Jezz",
    });
  }
  return {
    userId: current.userId || "",
    playlists: next,
  };
}

async function pullUser(userId, clientId, clientSecret) {
  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenResponse.ok) {
    throw new Error(`Spotify token request failed (${tokenResponse.status}). Check the app credentials.`);
  }
  const tokenBody = await tokenResponse.json();
  const playlists = [];
  let url = `https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists?limit=50`;
  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Spotify playlist request failed (${response.status}): ${detail}`);
    }
    const body = await response.json();
    for (const item of body.items ?? []) {
      if (!item?.id) continue;
      if (item.public === false) continue;
      if (item.owner?.id && item.owner.id !== userId) continue;
      playlists.push({
        id: item.id,
        name: plain(item.name) || "Playlist",
        description: plain(item.description),
        url: item.external_urls?.spotify || `https://open.spotify.com/playlist/${item.id}`,
        owner: plain(item.owner?.display_name) || "Jezz",
      });
    }
    url = body.next;
  }
  return { userId, playlists };
}

loadEnvFile();

const clientId = process.env.SPOTIFY_CLIENT_ID || "";
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
const current = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { userId: "", playlists: [] };
const userId = process.env.SPOTIFY_USER_ID || current.userId || "";

let catalog;
if (clientId && clientSecret && userId) {
  try {
    catalog = await pullUser(userId, clientId, clientSecret);
    console.log(`Pulled ${catalog.playlists.length} public playlists owned by ${userId}.`);
  } catch (error) {
    const reason = String(error.message ?? "failed").slice(0, 180);
    console.warn(`Spotify playlist list failed (${reason}). Refreshing the titles already on file.`);
    catalog = await enrichExisting(current);
    console.log(`Refreshed titles for ${catalog.playlists.length} playlists via Spotify oEmbed.`);
  }
} else if ((current.playlists ?? []).length > 0) {
  catalog = await enrichExisting(current);
  console.log(`Refreshed titles for ${catalog.playlists.length} playlists via Spotify oEmbed.`);
} else {
  console.error(
    [
      "Nothing to sync yet.",
      "",
      "Either paste Jezz's public playlist URLs into src/data/playlists.json",
      "or create a Spotify app and add this to .env:",
      "",
      "SPOTIFY_CLIENT_ID=",
      "SPOTIFY_CLIENT_SECRET=",
      "SPOTIFY_USER_ID=",
      "",
      "The user id is the last part of open.spotify.com/user/…",
      "Then run npm run spotify again. Only public playlists he owns are written.",
    ].join("\n"),
  );
  process.exit(1);
}

writeFileSync(OUT, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${OUT}`);
