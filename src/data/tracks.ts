import notesFile from "./field-notes.json";
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
};

type RawTrack = Omit<CrateTrack, "fieldNote">;

type TrackFile = {
  playlists?: Record<string, RawTrack[]>;
};

const catalog = trackFile as TrackFile;
const notes = notesFile as Record<string, string>;

export function trackCount(playlistId: string): number {
  return (catalog.playlists?.[playlistId] ?? []).filter((track) => track.id?.trim()).length;
}

export function eachPlaylistTracks(): { playlistId: string; tracks: CrateTrack[] }[] {
  return Object.keys(catalog.playlists ?? {}).map((playlistId) => ({
    playlistId,
    tracks: tracksFor(playlistId),
  }));
}

export function tracksFor(playlistId: string): CrateTrack[] {
  return (catalog.playlists?.[playlistId] ?? []).flatMap((track) => {
    const id = track.id?.trim();
    if (!id) return [];
    const note = notes[id];
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
        fieldNote: typeof note === "string" ? note.trim() : "",
      },
    ];
  });
}
