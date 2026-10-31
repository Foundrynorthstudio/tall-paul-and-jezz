import raw from "./paul-playlists.json";

export type PaulPlaylist = {
  name: string;
  url: string;
};

type RawPaul = {
  name?: string;
  url?: string;
};

export const paulPlaylists: PaulPlaylist[] = (raw as RawPaul[]).flatMap((entry) => {
  const name = entry.name?.trim() || "";
  const url = entry.url?.trim() || "";
  if (!name || !url) return [];
  return [{ name, url }];
});
