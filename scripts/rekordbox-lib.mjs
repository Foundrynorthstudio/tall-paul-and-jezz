import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function localPath(location) {
  const value = String(location ?? "").trim();
  if (!value) return "";
  if (!value.startsWith("file:")) return value;
  try {
    return decodeURIComponent(new URL(value).pathname);
  } catch {
    return "";
  }
}

export function bpmOf(value) {
  const bpm = Number(value);
  if (!Number.isFinite(bpm) || bpm <= 0) return 0;
  return Math.round(bpm * 100) / 100;
}

function attrsOf(source) {
  const out = {};
  const pattern = /([A-Za-z0-9_:-]+)="([^"]*)"/g;
  for (const match of source.matchAll(pattern)) out[match[1]] = decodeXml(match[2]);
  return out;
}

function decodeXml(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function cuesOf(body) {
  const cues = [];
  for (const match of body.matchAll(/<POSITION_MARK\b([^>]*?)\/?>/g)) {
    const attrs = attrsOf(match[1]);
    const startSec = Number(attrs.Start);
    if (!Number.isFinite(startSec) || startSec < 0) continue;
    const num = Number(attrs.Num);
    const hot = attrs.Type === "4" || (Number.isInteger(num) && num >= 0);
    cues.push({
      name: attrs.Name?.trim() || "",
      kind: hot ? "hot" : "memory",
      startSec,
      num: Number.isInteger(num) ? num : -1,
    });
  }
  return cues;
}

function gridOf(body) {
  const grid = [];
  for (const match of body.matchAll(/<TEMPO\b([^>]*?)\/?>/g)) {
    const attrs = attrsOf(match[1]);
    const startSec = Number(attrs.Inizio);
    const bpm = bpmOf(attrs.Bpm);
    if (!Number.isFinite(startSec) || startSec < 0 || !(bpm > 0)) continue;
    grid.push({ startSec, bpm, meter: attrs.Metro?.trim() || "" });
  }
  return grid;
}

export function parseCollection(xml) {
  const tracks = [];
  const pattern = /<TRACK\b([^>]*?)(?:\/>|>([\s\S]*?)<\/TRACK>)/g;
  for (const match of xml.matchAll(pattern)) {
    const attrs = attrsOf(match[1]);
    const title = attrs.Name?.trim() || "";
    const artist = attrs.Artist?.trim() || "";
    if (!title || !artist) continue;
    const body = match[2] || "";
    tracks.push({
      title,
      artist,
      bpm: bpmOf(attrs.AverageBpm),
      tonality: attrs.Tonality?.trim() || "",
      genre: attrs.Genre?.trim() || "",
      location: attrs.Location?.trim() || "",
      cues: cuesOf(body),
      grid: gridOf(body),
    });
  }
  return tracks;
}

export function findExport(library) {
  if (!library || !existsSync(library)) return "";
  if (statSync(library).isFile()) return library.toLowerCase().endsWith(".xml") ? library : "";
  const files = readdirSync(library)
    .filter((name) => name.toLowerCase().endsWith(".xml"))
    .map((name) => join(library, name));
  const exports = files.filter((file) => head(file).includes("DJ_PLAYLISTS"));
  exports.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return exports[0] || "";
}

function head(file) {
  const handle = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(4096);
    const read = readSync(handle, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, read).toString("utf8");
  } finally {
    closeSync(handle);
  }
}

export function fileReady(location) {
  const path = localPath(location);
  return Boolean(path) && existsSync(path) && statSync(path).isFile();
}

function blank() {
  return { bpm: 0, tonality: "", genre: "", location: "", cues: [], grid: [] };
}

function fill(previous, incoming) {
  return {
    bpm: incoming.bpm > 0 ? incoming.bpm : previous.bpm,
    tonality: incoming.tonality || previous.tonality,
    genre: incoming.genre || previous.genre,
    location: incoming.location || previous.location,
    cues: incoming.cues.length ? incoming.cues : previous.cues,
    grid: incoming.grid.length ? incoming.grid : previous.grid,
  };
}

function compact(row) {
  const out = {};
  if (row.bpm > 0) out.bpm = row.bpm;
  if (row.tonality) out.tonality = row.tonality;
  if (row.genre) out.genre = row.genre;
  if (row.location) out.location = row.location;
  if (row.cues.length) out.cues = row.cues.map(compactCue);
  if (row.grid.length) out.grid = row.grid.map(compactGrid);
  return out;
}

function compactCue(cue) {
  const out = { kind: cue.kind, startSec: cue.startSec };
  if (cue.name) out.name = cue.name;
  if (Number.isInteger(cue.num)) out.num = cue.num;
  return out;
}

function compactGrid(mark) {
  const out = { startSec: mark.startSec, bpm: mark.bpm };
  if (mark.meter) out.meter = mark.meter;
  return out;
}

export function attachLibrary(previous, xmlTracks, jointTracks) {
  const next = { ...previous };
  let attached = 0;
  for (const track of jointTracks) {
    const title = norm(track.title);
    const artists = norm(track.artists);
    if (!title || !artists) continue;
    const hits = xmlTracks.filter(
      (row) => norm(row.title) === title && norm(row.artist) === artists && fileReady(row.location),
    );
    if (hits.length === 0) continue;
    hits.sort((a, b) => Number(b.bpm > 0) - Number(a.bpm > 0));
    const merged = compact(fill(previous[track.id] || blank(), hits[0]));
    if (Object.keys(merged).length === 0) continue;
    next[track.id] = merged;
    attached += 1;
  }
  return { library: next, attached };
}

export function readSaved(path) {
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}
