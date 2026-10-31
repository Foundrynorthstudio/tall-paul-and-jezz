import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const BARS = 90;

function peaks(videoId: string): number[] {
  let hash = 2166136261;
  for (let index = 0; index < videoId.length; index += 1) {
    hash = Math.imul(hash ^ videoId.charCodeAt(index), 16777619);
  }
  const raw: number[] = [];
  for (let index = 0; index < BARS; index += 1) {
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    raw.push(0.22 + ((hash >>> 0) % 1000) / 1000 * 0.78);
  }
  return raw.map((value, index) => {
    const prev = raw[index - 1] ?? value;
    const next = raw[index + 1] ?? value;
    return (prev + value * 2 + next) / 4;
  });
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export default function WaveformSeek({
  videoId,
  currentTime,
  duration,
  onSeek,
}: {
  videoId: string;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
}) {
  const bars = useMemo(() => peaks(videoId || "radio"), [videoId]);
  const drag = useRef<number | null>(null);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const canSeek = duration > 0;
  const liveRatio = canSeek ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const ratio = dragRatio ?? liveRatio;

  function ratioFrom(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return 0;
    return Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!canSeek) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = ratioFrom(event);
    drag.current = next;
    setDragRatio(next);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (drag.current == null || !canSeek) return;
    const next = ratioFrom(event);
    drag.current = next;
    setDragRatio(next);
  }

  function finish(event: PointerEvent<HTMLDivElement>) {
    if (drag.current == null || !canSeek) return;
    const next = ratioFrom(event);
    drag.current = null;
    setDragRatio(null);
    onSeek(next * duration);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!canSeek) return;
    const step = event.shiftKey ? 10 : 5;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onSeek(Math.min(duration, currentTime + step));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      onSeek(Math.max(0, currentTime - step));
    }
  }

  return (
    <div
      className="waveform-seek"
      role="slider"
      tabIndex={0}
      aria-label="Track position"
      aria-valuemin={0}
      aria-valuemax={canSeek ? Math.round(duration) : 0}
      aria-valuenow={canSeek ? Math.round(ratio * duration) : 0}
      aria-valuetext={canSeek ? `${clock(ratio * duration)} of ${clock(duration)}` : "Position unavailable"}
      aria-disabled={canSeek ? undefined : true}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${BARS} 100`} preserveAspectRatio="none" aria-hidden="true">
        {bars.map((height, index) => {
          const barHeight = height * 86;
          const played = (index + 0.5) / BARS <= ratio;
          return (
            <rect
              key={index}
              x={index + 0.18}
              y={(100 - barHeight) / 2}
              width={0.64}
              height={barHeight}
              fill={played ? "var(--ink)" : "#b5b5b5"}
            />
          );
        })}
        <line
          x1={ratio * BARS}
          y1={4}
          x2={ratio * BARS}
          y2={96}
          stroke="var(--red)"
          strokeWidth={0.7}
        />
      </svg>
    </div>
  );
}
