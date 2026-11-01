import raw from "./beatport.json";
import type { CrateTrack } from "./tracks";

export type BeatportMatch = {
  beatportId: string;
  url: string;
  bpm: number;
  key: string;
  genre: string;
};

type RawMatch = {
  beatportId?: string;
  url?: string;
  bpm?: number;
  key?: string;
  genre?: string;
};

type Camelot = { number: number; letter: "A" | "B" };

const MAJOR: Record<string, string> = {
  c: "8B",
  g: "9B",
  d: "10B",
  a: "11B",
  e: "12B",
  b: "1B",
  "f#": "2B",
  gb: "2B",
  "c#": "3B",
  db: "3B",
  "g#": "4B",
  ab: "4B",
  "d#": "5B",
  eb: "5B",
  "a#": "6B",
  bb: "6B",
  f: "7B",
};

const MINOR: Record<string, string> = {
  "g#": "1A",
  ab: "1A",
  "d#": "2A",
  eb: "2A",
  "a#": "3A",
  bb: "3A",
  f: "4A",
  c: "5A",
  g: "6A",
  d: "7A",
  a: "8A",
  e: "9A",
  b: "10A",
  "f#": "11A",
  gb: "11A",
  "c#": "12A",
  db: "12A",
};

const HOUR_MS = 60 * 60 * 1000;

export const beatportMatches: Record<string, BeatportMatch> = Object.fromEntries(
  Object.entries(raw as Record<string, RawMatch>).flatMap(([id, entry]) => {
    const match = readMatch(entry);
    return match ? [[id, match]] : [];
  }),
);

export function beatportSearchUrl(track: CrateTrack): string {
  const query = [track.artists, track.title].filter(Boolean).join(" ");
  return `https://www.beatport.com/search?q=${encodeURIComponent(query)}`;
}

export type SetStep = {
  track: CrateTrack;
  reason: string;
};

export type SetPlan = {
  steps: SetStep[];
  unplaced: CrateTrack[];
  held: CrateTrack[];
};

export function suggestSet(tracks: CrateTrack[]): SetPlan {
  const unplaced: CrateTrack[] = [];
  const ready: { track: CrateTrack; camelot: Camelot; bpm: number; genre: string }[] = [];
  for (const track of tracks) {
    const match = beatportMatches[track.id];
    const camelot = match ? camelotOf(match.key) : null;
    if (!match || !camelot || !(match.bpm > 0)) {
      unplaced.push(track);
      continue;
    }
    ready.push({ track, camelot, bpm: match.bpm, genre: match.genre });
  }
  if (ready.length === 0) return { steps: [], unplaced, held: [] };

  const steps: SetStep[] = [{ track: ready[0].track, reason: "Opens the set" }];
  let cursor = ready[0];
  const remaining = ready.slice(1);
  let played = cursor.track.durationMs;

  while (remaining.length > 0 && played < HOUR_MS) {
    let best = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const distance = wheelDistance(cursor.camelot, candidate.camelot);
      const tempo = Math.abs(candidate.bpm - cursor.bpm);
      if (distance > 1 || tempo > 6) continue;
      const genre = cursor.genre && candidate.genre && cursor.genre === candidate.genre ? 0 : 1;
      const score = distance * 20 + tempo + genre;
      if (score < bestScore) {
        best = index;
        bestScore = score;
      }
    }
    if (best < 0) break;
    const next = remaining.splice(best, 1)[0];
    steps.push({ track: next.track, reason: stepReason(cursor, next) });
    played += next.track.durationMs;
    cursor = next;
  }

  return { steps, unplaced, held: remaining.map((item) => item.track) };
}

function readMatch(entry: RawMatch | undefined): BeatportMatch | null {
  const beatportId = entry?.beatportId?.trim() || "";
  const url = entry?.url?.trim() || "";
  const key = entry?.key?.trim() || "";
  const bpm = Number(entry?.bpm);
  if (!beatportId || !url || !key || !(bpm > 0)) return null;
  return { beatportId, url, bpm, key, genre: entry?.genre?.trim() || "" };
}

function camelotOf(key: string): Camelot | null {
  const direct = /^(\d{1,2})\s*([ab])$/i.exec(key.trim());
  if (direct) {
    const number = Number(direct[1]);
    const letter = direct[2].toUpperCase();
    if (number >= 1 && number <= 12 && (letter === "A" || letter === "B")) return { number, letter };
    return null;
  }
  const text = key
    .trim()
    .toLowerCase()
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/\s+/g, " ");
  const match = /^([a-g](?:#|b)?) (minor|min|major|maj)$|^([a-g](?:#|b)?)(m|min)$/.exec(text);
  if (!match) return null;
  const note = match[1] || match[3];
  const quality = match[2] || match[4];
  const minor = quality === "minor" || quality === "min" || quality === "m";
  const code = (minor ? MINOR : MAJOR)[note];
  if (!code) return null;
  return { number: Number(code.slice(0, -1)), letter: code.endsWith("A") ? "A" : "B" };
}

function wheelDistance(from: Camelot, to: Camelot): number {
  if (from.number === to.number) return from.letter === to.letter ? 0 : 1;
  if (from.letter !== to.letter) return 99;
  const gap = Math.abs(from.number - to.number);
  return Math.min(gap, 12 - gap);
}

function stepReason(
  from: { camelot: Camelot; bpm: number; genre: string },
  to: { camelot: Camelot; bpm: number; genre: string },
): string {
  const parts = [wheelDistance(from.camelot, to.camelot) === 0 ? "Same key" : "One step on the wheel"];
  const tempo = to.bpm - from.bpm;
  if (Math.abs(tempo) < 0.5) parts.push("same tempo");
  else parts.push(tempo > 0 ? `tempo up ${Math.round(tempo)}` : `tempo down ${Math.round(Math.abs(tempo))}`);
  if (from.genre && from.genre === to.genre) parts.push("same genre");
  return parts.join(", ");
}
