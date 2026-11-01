import notesFile from "./field-notes.json";
import { DUO_WEEK_ID, JEZZ_WEEK_ID } from "./playlists";
import trackFile from "./tracks.json";

/** Spotify track id. Later likes and comments key on this, not on a service URL. */
export type CrateTrack = {
  id: string;
  isrc: string | null;
  title: string;
  artists: string;
  durationMs: number;
  artwork: string | null;
  spotifyUrl: string;
  appleUrl: string | null;
  youtubeMusicUrl: string | null;
  fieldNote: string;
  timedNotes: TimedNote[];
};

export type TimedNote = { at: number; text: string };

type RawTrack = Omit<CrateTrack, "fieldNote" | "timedNotes">;

type TrackFile = {
  playlists?: Record<string, RawTrack[]>;
};

type RawNote = string | { at?: unknown; text?: unknown }[];

const catalog = trackFile as TrackFile;
const notes = notesFile as Record<string, RawNote>;

function readNotes(note: RawNote | undefined): { fieldNote: string; timedNotes: TimedNote[] } {
  if (typeof note === "string") return { fieldNote: note.trim(), timedNotes: [] };
  if (!Array.isArray(note)) return { fieldNote: "", timedNotes: [] };
  const timedNotes = note.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const at = Number(item.at);
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!Number.isFinite(at) || at < 0 || !text) return [];
    return [{ at, text }];
  });
  return { fieldNote: "", timedNotes };
}

export function trackCount(playlistId: string): number {
  return playlistStats(playlistId).count;
}

export function playlistStats(playlistId: string): { count: number; durationMs: number } {
  return (catalog.playlists?.[playlistId] ?? []).reduce(
    (stats, track) => {
      if (!track.id?.trim()) return stats;
      return {
        count: stats.count + 1,
        durationMs: stats.durationMs + (Number(track.durationMs) || 0),
      };
    },
    { count: 0, durationMs: 0 },
  );
}

export function eachPlaylistTracks(): { playlistId: string; tracks: CrateTrack[] }[] {
  return Object.keys(catalog.playlists ?? {}).map((playlistId) => ({
    playlistId,
    tracks: tracksFor(playlistId),
  }));
}

export function trackById(id: string): CrateTrack | undefined {
  const wanted = id.trim();
  if (!wanted) return undefined;
  for (const { tracks } of eachPlaylistTracks()) {
    const found = tracks.find((track) => track.id === wanted);
    if (found) return found;
  }
  return undefined;
}

const newestFirst = new Set<string>([DUO_WEEK_ID, JEZZ_WEEK_ID]);

export function tracksFor(playlistId: string): CrateTrack[] {
  const rows = (catalog.playlists?.[playlistId] ?? []).flatMap((track) => {
    const id = track.id?.trim();
    if (!id) return [];
    const { fieldNote, timedNotes } = readNotes(notes[id]);
    return [
      {
        id,
        isrc: track.isrc?.trim() || null,
        title: track.title?.trim() || "Track",
        artists: track.artists?.trim() || "",
        durationMs: Number(track.durationMs) || 0,
        artwork: track.artwork?.trim() || null,
        spotifyUrl: track.spotifyUrl?.trim() || `https://open.spotify.com/track/${id}`,
        appleUrl: track.appleUrl?.trim() || null,
        youtubeMusicUrl: track.youtubeMusicUrl?.trim() || null,
        fieldNote,
        timedNotes,
      },
    ];
  });
  return newestFirst.has(playlistId) ? rows.reverse() : rows;
}
