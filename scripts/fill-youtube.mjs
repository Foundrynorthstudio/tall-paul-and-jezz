import { readFileSync, writeFileSync } from "node:fs";

const OUT = "src/data/tracks.json";
const data = JSON.parse(readFileSync(OUT, "utf8"));

function save() {
  writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
}

const byTrackId = new Map();
for (const rows of Object.values(data.playlists)) {
  for (const row of rows) {
    if (!row?.id) continue;
    const list = byTrackId.get(row.id) ?? [];
    list.push(row);
    byTrackId.set(row.id, list);
  }
}

for (const rows of byTrackId.values()) {
  const saved = rows.find((row) => row.youtubeMusicUrl)?.youtubeMusicUrl;
  if (!saved) continue;
  for (const row of rows) {
    if (!row.youtubeMusicUrl) row.youtubeMusicUrl = saved;
  }
}

const pending = [];
for (const rows of byTrackId.values()) {
  if (rows.some((row) => row.youtubeMusicUrl)) continue;
  pending.push(rows[0]);
}

console.log("looking up", pending.length, "tracks");

async function firstVideo(query) {
  const response = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept-Language": "en-GB,en",
      },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error(String(response.status));
  const html = await response.text();
  const marker = "ytInitialData";
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("no results page");
  const jsonStart = html.indexOf("{", start);
  const jsonEnd = html.indexOf(";</script>", jsonStart);
  const parsed = JSON.parse(html.slice(jsonStart, jsonEnd));
  const sections =
    parsed.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
      ?.contents ?? [];
  for (const section of sections) {
    for (const item of section.itemSectionRenderer?.contents ?? []) {
      const id = item.videoRenderer?.videoId;
      if (id) return id;
    }
  }
  return null;
}

let found = 0;
let failed = 0;
for (const row of pending) {
  const query = `${row.artists} ${row.title}`.trim();
  let id = null;
  let error = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      id = await firstVideo(query);
      error = null;
      break;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "failed";
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  if (id) {
    const url = `https://music.youtube.com/watch?v=${id}`;
    for (const copy of byTrackId.get(row.id) ?? [row]) {
      if (!copy.youtubeMusicUrl) copy.youtubeMusicUrl = url;
    }
    found += 1;
    save();
    console.log(found, row.title, id);
  } else if (error) {
    failed += 1;
    console.warn("failed", row.title, error);
  } else {
    failed += 1;
    console.log("none", row.title);
  }
  await new Promise((resolve) => setTimeout(resolve, 700));
}

save();
console.log("saved", found, "failed", failed);
