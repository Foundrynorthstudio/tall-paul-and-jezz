import { useMemo, useState } from "react";
import {
  beatportMatches,
  beatportSearchUrl,
  harmonicNote,
  suggestSet,
} from "../data/beatport";
import { paulPlaylists } from "../data/paul";
import { comparePlaylistNames, DUO_ID, DUO_NAME, playlists } from "../data/playlists";
import {
  displayKey,
  libraryPath,
  playingAnalysis,
  rekordboxLibrary,
  rekordboxPlaylist,
  type RekordboxTrack,
} from "../data/rekordbox";
import { tracksFor, type CrateTrack } from "../data/tracks";
import { useStored } from "../storage";

type SetMark = {
  kind: "cue" | "marker";
  name: string;
  startSec: number;
};

type Slot = {
  id: string;
  marks: SetMark[];
};

type SavedSet = {
  id: string;
  name: string;
  trackIds: string[];
  marks: SetMark[][];
  openerId: string;
  closerId: string;
  targetMinutes: 60 | 90;
};

type PoolTrack = {
  track: CrateTrack;
  crates: string[];
};

const analysis = playingAnalysis();
const jezzCrates = [...playlists].sort((a, b) => comparePlaylistNames(a.name, b.name));
const paulCrates = [...paulPlaylists].sort((a, b) => comparePlaylistNames(a.name, b.name));

export default function SetsPage() {
  const catalog = useMemo(() => buildCatalog(), []);
  const joint = useMemo(() => tracksFor(DUO_ID), []);
  const [stored, setStored] = useStored<unknown>("tpj-sets", []);
  const saved = useMemo(() => setsFrom(stored), [stored]);
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState("");
  const [order, setOrder] = useState<Slot[]>([]);
  const [openerId, setOpenerId] = useState("");
  const [closerId, setCloserId] = useState("");
  const [targetMinutes, setTargetMinutes] = useState<60 | 90>(60);
  const [held, setHeld] = useState<CrateTrack[]>([]);
  const [unplaced, setUnplaced] = useState<CrateTrack[]>([]);
  const [suggestNote, setSuggestNote] = useState("");
  const [notice, setNotice] = useState("");
  const [crateId, setCrateId] = useState(otherCrates()[0]?.id ?? "");
  const [dragIndex, setDragIndex] = useState(-1);

  const placed = order.filter((item) => catalog.has(item.id));
  const rows = placed.map((item) => catalog.get(item.id)!);
  const runtime = rows.reduce((sum, entry) => sum + entry.track.durationMs, 0);
  const targetMs = targetMinutes * 60 * 1000;
  const warnings = duplicateWarnings(rows);
  const crateTracks = tracksIn(crateId).filter((track) => catalog.has(track.id));

  function editOrder(next: Slot[]) {
    setOrder(next);
    setHeld([]);
    setUnplaced([]);
    setSuggestNote("");
    setNotice("");
  }

  function addTrack(id: string) {
    if (!catalog.has(id)) return;
    editOrder([...order, { id, marks: [] }]);
  }

  function suggest() {
    const plan = suggestSet(joint, analysis, { openerId, targetMs });
    if (plan.steps.length === 0) {
      setHeld([]);
      setUnplaced(plan.unplaced.filter((track) => !order.some((item) => item.id === track.id)));
      setSuggestNote("None of these tracks have a Rekordbox tempo and key yet, so there is no running order.");
      setNotice("");
      return;
    }
    const ids = applyPins(
      carry(plan.steps.map((step) => step.track.id), order),
      openerId,
      closerId,
    );
    setOrder(ids);
    setHeld(plan.held.filter((track) => !ids.some((item) => item.id === track.id)));
    setUnplaced(plan.unplaced.filter((track) => !ids.some((item) => item.id === track.id)));
    setSuggestNote("");
    setNotice("");
  }

  function load(set: SavedSet) {
    setActiveId(set.id);
    setName(set.name);
    setOrder(
      set.trackIds.flatMap((id, index) => (catalog.has(id) ? [{ id, marks: set.marks[index] ?? [] }] : [])),
    );
    setOpenerId(set.openerId);
    setCloserId(set.closerId);
    setTargetMinutes(set.targetMinutes);
    setHeld([]);
    setUnplaced([]);
    setSuggestNote("");
    setNotice("");
  }

  function lock() {
    const title = name.trim();
    if (!title) {
      setNotice("Name the set before locking it.");
      return;
    }
    if (rows.length === 0) {
      setNotice("Add a track before locking the set.");
      return;
    }
    const id = activeId || crypto.randomUUID();
    const next: SavedSet = {
      id,
      name: title,
      trackIds: placed.map((item) => item.id),
      marks: placed.map((item) => item.marks),
      openerId,
      closerId,
      targetMinutes,
    };
    setStored([next, ...saved.filter((set) => set.id !== id && set.name !== title)]);
    setActiveId(id);
    const playable = rows.flatMap((entry) => {
      const location = rekordboxLibrary[entry.track.id]?.location ?? "";
      if (!libraryPath(location)) return [];
      return [{ location, artists: entry.track.artists, title: entry.track.title, durationMs: entry.track.durationMs }];
    });
    if (playable.length === 0) {
      setNotice("This set is saved in this browser. None of these tracks have a local file yet, so there is no Rekordbox playlist.");
      return;
    }
    downloadPlaylist(title, rekordboxPlaylist(title, playable));
    const left = rows.length - playable.length;
    setNotice(
      left > 0
        ? `Rekordbox playlist downloaded. ${left} ${left === 1 ? "track is" : "tracks are"} not in the library yet and stayed off the playlist.`
        : "Rekordbox playlist downloaded. Import it in Rekordbox, then mix it on the DDJ-FLX4.",
    );
  }

  return (
    <section className="block">
      <div className="wrap">
        <p className="kicker">For the night</p>
        <h1 className="section-title">Set lists</h1>
        <p className="lede">
          The {DUO_NAME} playlist is the buy list. Add a cue point or a marker on any track in the order.
          Rekordbox cues show once the file is on the drive. Lock a set to save it in this browser and
          download a Rekordbox playlist for the DDJ-FLX4. Nothing is emailed and nothing is published.
        </p>

        <div className="set-tools no-print">
          <div className="choice-row" role="group" aria-label="Set length">
            <button type="button" className={targetMinutes === 60 ? "is-on" : undefined} onClick={() => setTargetMinutes(60)}>
              60 min
            </button>
            <button type="button" className={targetMinutes === 90 ? "is-on" : undefined} onClick={() => setTargetMinutes(90)}>
              90 min
            </button>
          </div>
          <button type="button" className="set-suggest" onClick={suggest}>
            Suggest a set
          </button>
          <button type="button" className="set-suggest is-quiet" onClick={() => editOrder([])}>
            Clear
          </button>
          <button type="button" className="set-suggest is-quiet" onClick={() => window.print()}>
            Print card
          </button>
        </div>

        <div className="set-tools no-print">
          <label className="field set-name">
            <span>Set name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <button type="button" className="set-suggest" onClick={lock}>
            Lock set
          </button>
          {saved.length > 0 ? (
            <label className="field set-name">
              <span>Saved in this browser</span>
              <select
                value={activeId}
                onChange={(event) => {
                  const set = saved.find((item) => item.id === event.target.value);
                  if (set) load(set);
                }}
              >
                <option value="">Choose a set</option>
                {saved.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {activeId ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setStored(saved.filter((set) => set.id !== activeId));
                setActiveId("");
                setNotice("Saved set removed from this browser.");
              }}
            >
              Remove saved set
            </button>
          ) : null}
        </div>
        {notice ? <p className="set-warn">{notice}</p> : null}
        {suggestNote ? <p className="set-empty">{suggestNote}</p> : null}
        {warnings.length > 0 ? (
          <ul className="set-warn">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}

        <h2 className="set-heading" id="set-order">
          Running order
          <span className={runtime > targetMs ? "is-over" : undefined}>{lengthLabel(rows.length, runtime, targetMinutes)}</span>
        </h2>
        <CoverStrip rows={rows} />
        <CamelotPath rows={rows} />
        {rows.length === 0 && !suggestNote ? (
          <p className="set-empty">The running order is empty. Add a track from the joint playlist, or suggest a set.</p>
        ) : rows.length === 0 ? null : (
          <ol className="set-list set-order">
            {rows.map((entry, index) => (
              <li
                key={`${entry.track.id}-${index}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  editOrder(move(order, dragIndex, index, openerId, closerId));
                  setDragIndex(-1);
                }}
              >
                <button
                  type="button"
                  className="text-btn set-handle no-print"
                  draggable
                  aria-label={`Drag ${entry.track.title}`}
                  onDragStart={() => setDragIndex(index)}
                >
                  Drag
                </button>
                <SetRow
                  entry={entry}
                  role={cueRole(index, rows.length)}
                  opener={openerId === entry.track.id && index === 0}
                  closer={closerId === entry.track.id && index === rows.length - 1}
                  note={neighbourNote(rows, index)}
                  onOpener={() => {
                    const next = openerId === entry.track.id ? "" : entry.track.id;
                    setOpenerId(next);
                    setCloserId(closerId === entry.track.id ? "" : closerId);
                    editOrder(applyPins(order, next, closerId === entry.track.id ? "" : closerId));
                  }}
                  onCloser={() => {
                    const next = closerId === entry.track.id ? "" : entry.track.id;
                    setCloserId(next);
                    setOpenerId(openerId === entry.track.id ? "" : openerId);
                    editOrder(applyPins(order, openerId === entry.track.id ? "" : openerId, next));
                  }}
                  onUp={() => editOrder(move(order, index, index - 1, openerId, closerId))}
                  onDown={() => editOrder(move(order, index, index + 1, openerId, closerId))}
                  marks={placed[index].marks}
                  onMarks={(marks) => {
                    const next = order.slice();
                    const at = next.indexOf(placed[index]);
                    if (at < 0) return;
                    next[at] = { ...placed[index], marks };
                    setOrder(next);
                  }}
                  onRemove={() => {
                    if (openerId === entry.track.id) setOpenerId("");
                    if (closerId === entry.track.id) setCloserId("");
                    editOrder(order.filter((item) => item !== placed[index]));
                  }}
                />
              </li>
            ))}
          </ol>
        )}
        <CueSheet rows={rows} marks={placed.map((item) => item.marks)} />

        {held.length > 0 ? (
          <>
            <h2 className="set-heading">
              Not in this {targetMinutes} minutes
              <span>{trackCount(held.length)}</span>
            </h2>
            <ol className="set-list">
              {held.map((track) => (
                <li key={track.id}>
                  <SetRow entry={catalog.get(track.id) ?? { track, crates: [] }} role="" note="" opener={false} closer={false} />
                </li>
              ))}
            </ol>
          </>
        ) : null}
        {unplaced.length > 0 ? (
          <>
            <h2 className="set-heading">
              Not enough to place
              <span>{trackCount(unplaced.length)}</span>
            </h2>
            <ol className="set-list">
              {unplaced.map((track) => (
                <li key={track.id}>
                  <SetRow entry={catalog.get(track.id) ?? { track, crates: [] }} role="" note="" opener={false} closer={false} />
                </li>
              ))}
            </ol>
          </>
        ) : null}

        <div className="no-print">
          <h2 className="set-heading">
            {DUO_NAME}
            <span>{trackCount(joint.length)}</span>
          </h2>
          <Pool tracks={joint} catalog={catalog} onAdd={addTrack} />
          <h2 className="set-heading">Suggest from another crate</h2>
          <p className="fine">
            A track from another crate can sit in the order. It joins the analysed library after it is on the joint
            playlist and the file is in Rekordbox.
          </p>
          <div className="set-tools">
            <label className="field set-crate">
              <span>Crate</span>
              <select
                value={crateId}
                onChange={(event) => setCrateId(event.target.value)}
              >
                <optgroup label="Tall Paul">
                  {paulCrates.map((playlist) => (
                    <option key={playlist.id} value={playlist.id}>
                      {playlist.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Jezz">
                  {jezzCrates.filter((playlist) => playlist.id !== DUO_ID).map((playlist) => (
                    <option key={playlist.id} value={playlist.id}>
                      {playlist.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>
          <Pool tracks={crateTracks} catalog={catalog} onAdd={addTrack} />
        </div>
      </div>
    </section>
  );
}

function CoverStrip({ rows }: { rows: PoolTrack[] }) {
  if (rows.length === 0) return null;
  return (
    <ol className="set-strip" aria-label="Cover sequence">
      {rows.map((entry, index) => (
        <li key={`${entry.track.id}-${index}`}>
          {entry.track.artwork ? <img src={entry.track.artwork} alt="" /> : <span aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function CamelotPath({ rows }: { rows: PoolTrack[] }) {
  const keys = rows.map((entry) => analysis[entry.track.id]?.key || "");
  if (!keys.some(Boolean)) return null;
  return (
    <ol className="set-path" aria-label="Camelot path">
      {rows.map((entry, index) => {
        const key = keys[index];
        const note = index > 0 ? neighbourNote(rows, index) : null;
        const breaks = note ? !note.fits : false;
        return (
          <li key={`${entry.track.id}-${index}`} className={breaks ? "is-break" : undefined}>
            {key || "—"}
          </li>
        );
      })}
    </ol>
  );
}

function CueSheet({ rows, marks }: { rows: PoolTrack[]; marks: SetMark[][] }) {
  if (rows.length < 2) return null;
  return (
    <>
      <h2 className="set-heading">Cue sheet</h2>
      <ol className="set-sheet">
        {rows.map((entry, index) => (
          <li key={`${entry.track.id}-cue-${index}`}>
            <span>{cueRole(index, rows.length)}</span>
            <span className="set-sheet-track">
              {entry.track.title}
              {marks[index]?.length ? <em>{marks[index].map(markLabel).join(" · ")}</em> : null}
            </span>
          </li>
        ))}
      </ol>
      <p className="fine">The opener, lift, peak, and land read the order. Cue points and markers are the ones you added.</p>
    </>
  );
}

function Pool({
  tracks,
  catalog,
  onAdd,
}: {
  tracks: CrateTrack[];
  catalog: Map<string, PoolTrack>;
  onAdd: (id: string) => void;
}) {
  if (tracks.length === 0) return <p className="set-empty">This crate has no tracks.</p>;
  return (
    <ol className="set-list">
      {tracks.map((track) => (
        <li key={track.id}>
          <SetRow entry={catalog.get(track.id) ?? { track, crates: [] }} role="" note="" opener={false} closer={false} onAdd={() => onAdd(track.id)} />
        </li>
      ))}
    </ol>
  );
}

function SetRow({
  entry,
  role,
  note,
  opener,
  closer,
  marks = [],
  onMarks,
  onAdd,
  onOpener,
  onCloser,
  onUp,
  onDown,
  onRemove,
}: {
  entry: PoolTrack;
  role: string;
  note: string | { fits: boolean; text: string } | null;
  opener: boolean;
  closer: boolean;
  marks?: SetMark[];
  onMarks?: (marks: SetMark[]) => void;
  onAdd?: () => void;
  onOpener?: () => void;
  onCloser?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
}) {
  const { track } = entry;
  const library = rekordboxLibrary[track.id];
  const match = beatportMatches[track.id];
  const duration = formatDuration(track.durationMs);
  const playing = playingLine(library);
  return (
    <article className="set-row">
      {track.artwork ? <img className="set-art" src={track.artwork} alt="" /> : <span className="set-art" aria-hidden="true" />}
      <div className="set-copy">
        <p className="set-title">
          {role ? <span className="set-role">{role}. </span> : null}
          {track.title}
        </p>
        <p className="set-meta">
          {track.artists}
          {duration ? ` · ${duration}` : ""}
          {playing ? ` · ${playing}` : ""}
        </p>
        {library ? <CueLine library={library} /> : <p className="set-meta">Not in the library yet</p>}
        {onMarks ? (
          <MarkEditor
            marks={marks}
            durationMs={track.durationMs}
            onChange={onMarks}
          />
        ) : null}
        {typeof note === "string" && note ? <p className="set-reason">{note}</p> : null}
        {note && typeof note !== "string" ? <p className={note.fits ? "set-reason" : "set-warn"}>{note.text}</p> : null}
        <p className="set-links">
          <a href={beatportSearchUrl(track)} target="_blank" rel="noreferrer">
            Beatport
          </a>
          {match ? (
            <a href={match.url} target="_blank" rel="noreferrer">
              Licensed copy
            </a>
          ) : null}
          {match?.genre ? <span>Beatport · {match.genre}</span> : null}
          {match && !library?.bpm ? <span>Beatport · {formatBpm(match.bpm)} BPM · {match.key}</span> : null}
        </p>
        {onAdd || onOpener || onRemove ? (
          <p className="set-row-tools no-print">
            {onAdd ? (
              <button type="button" className="text-btn" onClick={onAdd}>
                Add
              </button>
            ) : null}
            {onUp ? (
              <button type="button" className="text-btn" onClick={onUp}>
                Up
              </button>
            ) : null}
            {onDown ? (
              <button type="button" className="text-btn" onClick={onDown}>
                Down
              </button>
            ) : null}
            {onOpener ? (
              <button type="button" className="text-btn" aria-pressed={opener} onClick={onOpener}>
                {opener ? "Opener pinned" : "Pin opener"}
              </button>
            ) : null}
            {onCloser ? (
              <button type="button" className="text-btn" aria-pressed={closer} onClick={onCloser}>
                {closer ? "Closer pinned" : "Pin closer"}
              </button>
            ) : null}
            {onRemove ? (
              <button type="button" className="text-btn" onClick={onRemove}>
                Remove
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function MarkEditor({
  marks,
  durationMs,
  onChange,
}: {
  marks: SetMark[];
  durationMs: number;
  onChange: (marks: SetMark[]) => void;
}) {
  const [kind, setKind] = useState<SetMark["kind"]>("cue");
  const [markName, setMarkName] = useState("");
  const [markTime, setMarkTime] = useState("");
  const [markNote, setMarkNote] = useState("");

  function addMark(nextKind = kind, nextName = markName) {
    const startSec = parseClock(markTime);
    if (startSec === null) {
      setMarkNote("Use a time like 1:20.");
      return;
    }
    const limit = durationMs > 0 ? Math.round(durationMs / 1000) : null;
    if (limit !== null && startSec > limit) {
      setMarkNote("That time is past the end of the track.");
      return;
    }
    const name = nextName.trim();
    if (nextKind === "marker" && !name) {
      setMarkNote("Name the marker.");
      return;
    }
    onChange([...marks, { kind: nextKind, name, startSec }].sort((a, b) => a.startSec - b.startSec));
    setMarkName("");
    setMarkTime("");
    setMarkNote("");
  }

  return (
    <div className="set-mark-box">
      {marks.length > 0 ? (
        <ul className="set-marks">
          {marks.map((mark, index) => (
            <li key={`${mark.kind}-${mark.startSec}-${index}`}>
              <span>{markLabel(mark)}</span>
              <button
                type="button"
                className="text-btn no-print"
                onClick={() => onChange(marks.filter((_, item) => item !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="set-mark-form no-print">
        <div className="choice-row" role="group" aria-label="Cue or marker">
          <button type="button" className={kind === "cue" ? "is-on" : undefined} onClick={() => setKind("cue")}>
            Cue point
          </button>
          <button type="button" className={kind === "marker" ? "is-on" : undefined} onClick={() => setKind("marker")}>
            Marker
          </button>
        </div>
        <label className="field">
          <span>Name</span>
          <input value={markName} onChange={(event) => setMarkName(event.target.value)} />
        </label>
        <label className="field">
          <span>Time</span>
          <input
            value={markTime}
            inputMode="numeric"
            placeholder="1:20"
            aria-label="Time"
            onChange={(event) => setMarkTime(event.target.value)}
          />
        </label>
        <button type="button" className="text-btn" onClick={() => addMark()}>
          Add
        </button>
      </div>
      {markNote ? <p className="set-mark-note">{markNote}</p> : null}
    </div>
  );
}

function markLabel(mark: SetMark): string {
  const kind = mark.kind === "marker" ? "Marker" : "Cue";
  return `${kind}${mark.name ? ` · ${mark.name}` : ""} · ${formatSeconds(mark.startSec)}`;
}

function parseClock(value: string): number | null {
  const text = value.trim();
  const clock = /^(\d+):([0-5]\d)$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d+$/.test(text)) return Number(text);
  return null;
}

function CueLine({ library }: { library: RekordboxTrack }) {
  const cues = library.cues
    .slice()
    .sort((a, b) => a.startSec - b.startSec)
    .map((cue) => {
      const label = cue.kind === "hot" ? `Hot cue ${cue.num + 1}` : "Memory cue";
      return `${cue.name || label} ${formatSeconds(cue.startSec)}`;
    });
  const grid = library.grid.length > 0 ? `Beat grid · ${library.grid.length} ${library.grid.length === 1 ? "mark" : "marks"}` : "";
  if (cues.length === 0 && !grid) return null;
  return <p className="set-cues">{[grid, ...cues].filter(Boolean).join(" · ")}</p>;
}

function playingLine(library: RekordboxTrack | undefined): string {
  if (!library) return "";
  const parts: string[] = [];
  if (library.bpm > 0) parts.push(`${formatBpm(library.bpm)} BPM`);
  const key = displayKey(library.tonality);
  if (key) parts.push(key);
  if (library.genre) parts.push(library.genre);
  return parts.join(" · ");
}

function neighbourNote(rows: PoolTrack[], index: number): { fits: boolean; text: string } | null {
  if (index === 0) return null;
  const from = analysis[rows[index - 1].track.id];
  const to = analysis[rows[index].track.id];
  if (!from || !to) return null;
  return harmonicNote(from, to);
}

function buildCatalog(): Map<string, PoolTrack> {
  const map = new Map<string, PoolTrack>();
  for (const playlist of playlists) {
    for (const track of tracksFor(playlist.id)) addTrack(map, track, playlist.name);
  }
  for (const playlist of paulPlaylists) {
    for (const track of playlist.tracks) addTrack(map, track, playlist.name);
  }
  return map;
}

function addTrack(map: Map<string, PoolTrack>, track: CrateTrack, crate: string) {
  const existing = map.get(track.id);
  if (existing) {
    if (!existing.crates.includes(crate)) existing.crates.push(crate);
    return;
  }
  map.set(track.id, { track, crates: [crate] });
}

function otherCrates() {
  return [...paulCrates, ...jezzCrates.filter((playlist) => playlist.id !== DUO_ID)];
}

function tracksIn(id: string): CrateTrack[] {
  const paul = paulPlaylists.find((playlist) => playlist.id === id);
  if (paul) return paul.tracks;
  return tracksFor(id);
}

function setsFrom(value: unknown): SavedSet[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const set = entry as Partial<SavedSet>;
    const name = set.name?.trim() || "";
    const id = set.id?.trim() || "";
    const trackIds = Array.isArray(set.trackIds) ? set.trackIds.filter((item) => typeof item === "string" && item.trim()) : [];
    if (!name || !id || trackIds.length === 0) return [];
    const targetMinutes = set.targetMinutes === 90 ? 90 : 60;
    return [{
      id,
      name,
      trackIds,
      marks: marksFrom(set.marks, trackIds.length),
      openerId: set.openerId?.trim() || "",
      closerId: set.closerId?.trim() || "",
      targetMinutes,
    }];
  });
}

function marksFrom(value: unknown, count: number): SetMark[][] {
  const rows = Array.isArray(value) ? value : [];
  return Array.from({ length: count }, (_, index) => readMarks(rows[index]));
}

function readMarks(value: unknown): SetMark[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const mark = entry as Partial<SetMark>;
    const startSec = Number(mark.startSec);
    if (!Number.isFinite(startSec) || startSec < 0) return [];
    return [{ kind: mark.kind === "marker" ? "marker" : "cue", name: mark.name?.trim() || "", startSec }];
  });
}

function carry(ids: string[], previous: Slot[]): Slot[] {
  const used = new Set<number>();
  return ids.map((id) => {
    const index = previous.findIndex((item, itemIndex) => item.id === id && !used.has(itemIndex));
    if (index < 0) return { id, marks: [] };
    used.add(index);
    return previous[index];
  });
}

function applyPins(slots: Slot[], opener: string, closer: string): Slot[] {
  const find = (id: string) => slots.find((item) => item.id === id) ?? { id, marks: [] };
  const body = slots.filter((item) => item.id !== opener && item.id !== closer);
  const next = opener ? [find(opener), ...body] : [...body];
  if (closer && closer !== opener) next.push(find(closer));
  return next;
}

function move(ids: Slot[], from: number, to: number, opener: string, closer: string): Slot[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids;
  const startLocked = Boolean(opener) && ids[0]?.id === opener;
  const endLocked = Boolean(closer) && ids[ids.length - 1]?.id === closer;
  if (startLocked && (from === 0 || to === 0)) return ids;
  if (endLocked && (from === ids.length - 1 || to === ids.length - 1)) return ids;
  const next = ids.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function duplicateWarnings(rows: PoolTrack[]): string[] {
  const warnings: string[] = [];
  const seen = new Map<string, number>();
  const titles = new Map<string, PoolTrack[]>();
  for (const entry of rows) {
    seen.set(entry.track.id, (seen.get(entry.track.id) ?? 0) + 1);
    const title = norm(entry.track.title);
    const artists = norm(entry.track.artists);
    const key = `${artists}|${title}`;
    titles.set(key, [...(titles.get(key) ?? []), entry]);
  }
  for (const [id, count] of seen) {
    if (count < 2) continue;
    const title = rows.find((entry) => entry.track.id === id)?.track.title;
    if (title) warnings.push(`${title} is in the order ${count} times.`);
  }
  for (const group of titles.values()) {
    const ids = new Set(group.map((entry) => entry.track.id));
    if (ids.size < 2) continue;
    warnings.push(`${group[0].track.title} is pulled from more than one recording.`);
  }
  const paulIds = new Set(paulPlaylists.flatMap((playlist) => playlist.tracks.map((track) => track.id)));
  const byTitle = new Map<string, PoolTrack[]>();
  for (const entry of rows) {
    const title = norm(entry.track.title);
    if (!title) continue;
    byTitle.set(title, [...(byTitle.get(title) ?? []), entry]);
  }
  for (const group of byTitle.values()) {
    const ids = new Set(group.map((entry) => entry.track.id));
    if (ids.size < 2) continue;
    const hasPaul = group.some((entry) => paulIds.has(entry.track.id));
    const hasJezz = group.some((entry) => !paulIds.has(entry.track.id));
    if (hasPaul && hasJezz) warnings.push(`${group[0].track.title} shows up in both Paul and Jezz crates.`);
  }
  return [...new Set(warnings)];
}

function cueRole(index: number, count: number): string {
  if (count <= 1) return "Opener";
  if (index === 0) return "Opener";
  if (index === count - 1) return "Land";
  const middle = count - 2;
  const place = index - 1;
  return place < middle / 2 ? "Lift" : "Peak";
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function downloadPlaylist(name: string, body: string) {
  const file = new Blob([body], { type: "audio/x-mpegurl" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "set"}.m3u8`;
  link.click();
  URL.revokeObjectURL(url);
}

function lengthLabel(count: number, durationMs: number, targetMinutes: number): string {
  const tracks = trackCount(count);
  const over = durationMs - targetMinutes * 60 * 1000;
  if (over > 0) return `${tracks} · ${formatTuneTime(over)} over ${targetMinutes} min`;
  return `${tracks} · ${formatTuneTime(durationMs)} of ${targetMinutes} min`;
}

function trackCount(count: number): string {
  return `${count} ${count === 1 ? "track" : "tracks"}`;
}

function formatDuration(ms: number): string {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

function formatSeconds(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

function formatTuneTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

function formatBpm(bpm: number): string {
  return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1);
}
