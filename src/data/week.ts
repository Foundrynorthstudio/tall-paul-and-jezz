import { playlists } from "./playlists";
import { eachPlaylistTracks, type CrateTrack } from "./tracks";

/** Spotify track ids. An empty id omits that card. */
export const weekTrackIds = {
  jezz: "7K4u8Fo2Govm3aCz6y8Lsw",
  paul: "0fOmDYu6WE8hKwMlYPZpal",
} as const;

export type WeekPerson = keyof typeof weekTrackIds;

const labels: Record<WeekPerson, string> = {
  jezz: "Jezz",
  paul: "Paul",
};

const order: WeekPerson[] = ["paul", "jezz"];

export type WeekPick = {
  person: WeekPerson;
  label: string;
  crate: string;
  track: CrateTrack;
};

export function weekPicks(): WeekPick[] {
  const found = new Map<string, { track: CrateTrack; playlistId: string }>();
  for (const { playlistId, tracks } of eachPlaylistTracks()) {
    for (const track of tracks) {
      if (!found.has(track.id)) found.set(track.id, { track, playlistId });
    }
  }
  return order.flatMap((person) => {
    const id = weekTrackIds[person].trim();
    const match = id ? found.get(id) : undefined;
    if (!match) return [];
    const crate = playlists.find((row) => row.id === match.playlistId)?.name ?? "";
    return [{ person, label: labels[person], crate, track: match.track }];
  });
}
