import { camelotCode, type PlayingAnalysis } from "./beatport";
import raw from "./rekordbox.json";

export type RekordboxCue = {
  name: string;
  kind: "memory" | "hot";
  startSec: number;
  num: number;
};

export type RekordboxGridMark = {
  startSec: number;
  bpm: number;
  meter: string;
};

export type RekordboxTrack = {
  bpm: number;
  tonality: string;
  genre: string;
  location: string;
  cues: RekordboxCue[];
  grid: RekordboxGridMark[];
};

type RawCue = {
  name?: string;
  kind?: string;
  startSec?: number;
  num?: number;
};

type RawGrid = {
  startSec?: number;
  bpm?: number;
  meter?: string;
};

type RawRow = {
  bpm?: number;
  tonality?: string;
  genre?: string;
  location?: string;
  cues?: RawCue[];
  grid?: RawGrid[];
};

function readCue(entry: RawCue | undefined): RekordboxCue | null {
  const startSec = Number(entry?.startSec);
  if (!Number.isFinite(startSec) || startSec < 0) return null;
  const kind = entry?.kind === "hot" ? "hot" : "memory";
  const num = Number(entry?.num);
  return {
    name: entry?.name?.trim() || "",
    kind,
    startSec,
    num: Number.isInteger(num) ? num : -1,
  };
}

function readGrid(entry: RawGrid | undefined): RekordboxGridMark | null {
  const startSec = Number(entry?.startSec);
  const bpm = Number(entry?.bpm);
  if (!Number.isFinite(startSec) || startSec < 0 || !(bpm > 0)) return null;
  return { startSec, bpm, meter: entry?.meter?.trim() || "" };
}

function readRow(entry: RawRow | undefined): RekordboxTrack | null {
  if (!entry) return null;
  const bpm = Number(entry.bpm);
  const cues = (entry.cues ?? []).flatMap((cue) => {
    const read = readCue(cue);
    return read ? [read] : [];
  });
  const grid = (entry.grid ?? []).flatMap((mark) => {
    const read = readGrid(mark);
    return read ? [read] : [];
  });
  const row: RekordboxTrack = {
    bpm: bpm > 0 ? bpm : 0,
    tonality: entry.tonality?.trim() || "",
    genre: entry.genre?.trim() || "",
    location: entry.location?.trim() || "",
    cues,
    grid,
  };
  if (!row.bpm && !row.tonality && !row.genre && !row.location && row.cues.length === 0 && row.grid.length === 0) {
    return null;
  }
  return row;
}

export const rekordboxLibrary: Record<string, RekordboxTrack> = Object.fromEntries(
  Object.entries(raw as Record<string, RawRow>).flatMap(([id, entry]) => {
    const row = readRow(entry);
    return row ? [[id, row]] : [];
  }),
);

export function playingAnalysis(): Record<string, PlayingAnalysis> {
  const analysis: Record<string, PlayingAnalysis> = {};
  for (const [id, row] of Object.entries(rekordboxLibrary)) {
    const key = camelotCode(row.tonality);
    if (!(row.bpm > 0) || !key) continue;
    analysis[id] = { bpm: row.bpm, key, genre: row.genre };
  }
  return analysis;
}

export function displayKey(tonality: string): string {
  return camelotCode(tonality) || tonality.trim();
}

export function libraryPath(location: string): string {
  const value = location.trim();
  if (!value) return "";
  if (!value.startsWith("file:")) return value;
  try {
    return decodeURIComponent(new URL(value).pathname);
  } catch {
    return "";
  }
}

export function rekordboxPlaylist(
  name: string,
  rows: { location: string; artists: string; title: string; durationMs: number }[],
): string {
  const lines = ["#EXTM3U", `#PLAYLIST:${name.replace(/[\r\n]/g, " ").trim() || "Set"}`];
  for (const row of rows) {
    const path = libraryPath(row.location);
    if (!path) continue;
    const seconds = row.durationMs > 0 ? Math.round(row.durationMs / 1000) : -1;
    const label = [row.artists, row.title].filter(Boolean).join(" - ") || "Track";
    lines.push(`#EXTINF:${seconds},${label.replace(/[\r\n]/g, " ")}`);
    lines.push(path);
  }
  return `${lines.join("\n")}\n`;
}
