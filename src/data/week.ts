import { playlists } from "./playlists";
import { eachPlaylistTracks, type CrateTrack } from "./tracks";

/** Spotify track ids. An empty id omits that card. */
export const weekTrackIds = {
  jezz: "7K4u8Fo2Govm3aCz6y8Lsw",
  paul: "0fOmDYu6WE8hKwMlYPZpal",
} as const;

/** Jezz and Paul track of the week. The radio opens on this. */
export const duoWeekTrackId = "6PHbD1AEcL1eCsQz3om9CJ";

export type WeekPerson = keyof typeof weekTrackIds;
export type WeekSlot = "duo" | WeekPerson;

const labels: Record<WeekSlot, string> = {
  duo: "Jezz and Paul",
  jezz: "Jezz",
  paul: "Paul",
};

const order: WeekPerson[] = ["paul", "jezz"];

const pageOrder: { slot: WeekSlot; id: string }[] = [
  { slot: "duo", id: duoWeekTrackId },
  { slot: "paul", id: weekTrackIds.paul },
  { slot: "jezz", id: weekTrackIds.jezz },
];

/** Written later. An empty note hides the paragraph and keeps the heading. */
export const weekNotes: Record<WeekSlot, string> = {
  duo: "",
  paul: "",
  jezz: "",
};

/** A real listen-through link replaces Coming soon. No invented URL. */
export const weekPodcasts: Record<WeekSlot, string | null> = {
  duo: null,
  paul: null,
  jezz: null,
};

export type WeekPick = {
  person: WeekPerson;
  label: string;
  crate: string;
  track: CrateTrack;
};

export type WeekFeature = {
  slot: WeekSlot;
  label: string;
  crate: string;
  track: CrateTrack;
  note: string;
  podcastUrl: string | null;
};

function catalog(): Map<string, { track: CrateTrack; playlistId: string }> {
  const found = new Map<string, { track: CrateTrack; playlistId: string }>();
  for (const { playlistId, tracks } of eachPlaylistTracks()) {
    for (const track of tracks) {
      if (!found.has(track.id)) found.set(track.id, { track, playlistId });
    }
  }
  return found;
}

function pickFrom(
  found: Map<string, { track: CrateTrack; playlistId: string }>,
  slot: WeekSlot,
  id: string,
): WeekFeature | null {
  const match = id.trim() ? found.get(id.trim()) : undefined;
  if (!match) return null;
  const crate = playlists.find((row) => row.id === match.playlistId)?.name ?? "";
  return {
    slot,
    label: labels[slot],
    crate,
    track: match.track,
    note: weekNotes[slot].trim(),
    podcastUrl: weekPodcasts[slot],
  };
}

export function weekPicks(): WeekPick[] {
  const found = catalog();
  return order.flatMap((person) => {
    const feature = pickFrom(found, person, weekTrackIds[person]);
    if (!feature) return [];
    return [{ person, label: feature.label, crate: feature.crate, track: feature.track }];
  });
}

export function weekFeature(): WeekFeature[] {
  const found = catalog();
  return pageOrder.flatMap((item) => {
    const feature = pickFrom(found, item.slot, item.id);
    return feature ? [feature] : [];
  });
}
