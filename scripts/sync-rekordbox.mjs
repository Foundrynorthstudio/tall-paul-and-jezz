import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { attachLibrary, findExport, parseCollection, readSaved } from "./rekordbox-lib.mjs";

const OUT = "src/data/rekordbox.json";
const TRACKS = "src/data/tracks.json";
const DUO_ID = "3edR4o6bZ40CIgM2BRZqmv";

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

function jointTracks() {
  const catalog = JSON.parse(readFileSync(TRACKS, "utf8"));
  return (catalog.playlists?.[DUO_ID] ?? []).flatMap((track) => {
    const id = String(track?.id ?? "").trim();
    const title = String(track?.title ?? "").trim();
    const artists = String(track?.artists ?? "").trim();
    return id && title && artists ? [{ id, title, artists }] : [];
  });
}

loadEnvFile();
const library = process.env.REKORDBOX_LIBRARY?.trim() || "";
if (!library || !existsSync(library)) {
  console.log("Rekordbox library is not mounted.");
  process.exit(0);
}

const xmlPath = findExport(library);
if (!xmlPath) {
  console.log("Rekordbox library has no collection export. Saved analysis was left as it is.");
  process.exit(0);
}

const xmlTracks = parseCollection(readFileSync(xmlPath, "utf8"));
if (xmlTracks.length === 0) {
  console.log("Rekordbox export has no tracks. Saved analysis was left as it is.");
  process.exit(0);
}

const { library: next, attached } = attachLibrary(readSaved(OUT), xmlTracks, jointTracks());
writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Rekordbox library attached: ${attached}`);
