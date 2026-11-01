import { existsSync, readFileSync, writeFileSync } from "node:fs";

const HANDLE = "paulrafferty1068";
const OUT = "src/data/paul-playlists.json";

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

function comparePlaylistNames(a, b) {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

function isoDuration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value ?? ""));
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function artwork(thumbnails) {
  const shot =
    thumbnails?.maxres ||
    thumbnails?.standard ||
    thumbnails?.high ||
    thumbnails?.medium ||
    thumbnails?.default;
  const url = shot?.url?.trim() || "";
  return url || null;
}

function channelName(value) {
  return String(value ?? "")
    .replace(/ - Topic$/, "")
    .trim();
}

async function tracksForPlaylist(playlistId) {
  const items = [];
  let pageToken = "";
  do {
    const page = await youtube("playlistItems", {
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of page.items ?? []) {
      const id = String(item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId ?? "").trim();
      const title = String(item.snippet?.title ?? "").trim();
      if (!id || !title || title === "Deleted video" || title === "Private video") continue;
      items.push({
        id,
        title,
        artists: channelName(item.snippet?.videoOwnerChannelTitle),
        artwork: artwork(item.snippet?.thumbnails),
      });
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);

  const details = new Map();
  for (let index = 0; index < items.length; index += 50) {
    const ids = items
      .slice(index, index + 50)
      .map((item) => item.id)
      .join(",");
    if (!ids) continue;
    const page = await youtube("videos", { part: "contentDetails,snippet", id: ids, maxResults: "50" });
    for (const video of page.items ?? []) details.set(video.id, video);
  }

  return items.map((item) => {
    const video = details.get(item.id);
    const artists = channelName(video?.snippet?.channelTitle) || item.artists;
    return {
      id: item.id,
      title: String(video?.snippet?.title ?? item.title).trim() || item.title,
      artists,
      durationMs: isoDuration(video?.contentDetails?.duration),
      artwork: artwork(video?.snippet?.thumbnails) || item.artwork,
      youtubeMusicUrl: `https://www.youtube.com/watch?v=${item.id}`,
    };
  });
}

function safeDetail(text) {
  const key = process.env.YOUTUBE_API_KEY || "";
  return (key ? text.replaceAll(key, "[key]") : text).slice(0, 180);
}

function isQuota(status, body) {
  if (status === 429) return true;
  const text = body.toLowerCase();
  return text.includes("quota") || text.includes("dailylimitexceeded") || text.includes("ratelimitexceeded");
}

async function youtube(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY);
  const response = await fetch(url);
  const text = await response.text();
  if (isQuota(response.status, text)) {
    const error = new Error("YouTube quota reached. Paul's saved playlists were left as they are.");
    error.quota = true;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`YouTube ${path} failed (${response.status}): ${safeDetail(text)}`);
  }
  return JSON.parse(text);
}

loadEnvFile();

if (!process.env.YOUTUBE_API_KEY) {
  console.error("No YOUTUBE_API_KEY. Paul's saved playlists were left as they are.");
  process.exit(1);
}

try {
  const channel = await youtube("channels", { part: "id", forHandle: HANDLE });
  const channelId = channel.items?.[0]?.id;
  if (!channelId) {
    console.error(`No YouTube channel for @${HANDLE}. Paul's saved playlists were left as they are.`);
    process.exit(1);
  }
  const playlists = [];
  let pageToken = "";
  do {
    const page = await youtube("playlists", {
      part: "snippet,contentDetails",
      channelId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of page.items ?? []) {
      const id = String(item.id ?? "").trim();
      const name = String(item.snippet?.title ?? "").trim();
      if (!id || !name) continue;
      const tracks = await tracksForPlaylist(id);
      playlists.push({
        id,
        name,
        url: `https://www.youtube.com/playlist?list=${id}`,
        count: tracks.length,
        tracks,
      });
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  playlists.sort((a, b) => comparePlaylistNames(a.name, b.name));
  writeFileSync(OUT, `${JSON.stringify(playlists, null, 2)}\n`);
  const tracks = playlists.reduce((sum, playlist) => sum + playlist.tracks.length, 0);
  console.log(`Wrote ${playlists.length} public playlists (${tracks} tracks) for @${HANDLE}.`);
} catch (error) {
  if (error.quota) {
    console.warn(error.message);
    process.exit(0);
  }
  console.error(error.message);
  process.exit(1);
}
