import raw from "./paul-playlists.json";
import type { CrateTrack } from "./tracks";

export const paulYoutubeUrl = "https://www.youtube.com/@paulrafferty1068";

export type PaulPlaylist = {
  id: string;
  name: string;
  url: string;
  count: number;
  durationMs: number;
  tracks: CrateTrack[];
};

type RawPaulTrack = {
  id?: string;
  title?: string;
  artists?: string;
  durationMs?: number;
  artwork?: string | null;
  youtubeMusicUrl?: string;
};

type RawPaul = {
  id?: string;
  name?: string;
  url?: string;
  tracks?: RawPaulTrack[];
};

function playlistId(entry: RawPaul): string {
  const id = entry.id?.trim() || "";
  if (id) return id;
  return entry.url?.match(/[?&]list=([^&]+)/)?.[1] ?? "";
}

function toTrack(entry: RawPaulTrack): CrateTrack | null {
  const id = entry.id?.trim() || "";
  const youtubeMusicUrl = entry.youtubeMusicUrl?.trim() || "";
  if (!id || !youtubeMusicUrl) return null;
  return {
    id,
    isrc: null,
    title: entry.title?.trim() || "Track",
    artists: entry.artists?.trim() || "",
    durationMs: Number(entry.durationMs) || 0,
    artwork: entry.artwork?.trim() || null,
    spotifyUrl: "",
    appleUrl: null,
    youtubeMusicUrl,
    fieldNote: "",
    timedNotes: [],
  };
}

export const paulPlaylists: PaulPlaylist[] = (raw as RawPaul[]).flatMap((entry) => {
  const id = playlistId(entry);
  const name = entry.name?.trim() || "";
  const url = entry.url?.trim() || "";
  if (!id || !name || !url) return [];
  const tracks = (entry.tracks ?? []).flatMap((track) => {
    const next = toTrack(track);
    return next ? [next] : [];
  });
  return [
    {
      id,
      name,
      url,
      count: tracks.length,
      durationMs: tracks.reduce((sum, track) => sum + track.durationMs, 0),
      tracks,
    },
  ];
});
