import { useEffect, useState } from "react";

export type TicketHold = { name: string; email: string; qty: number };
export type TicketLine = { gigId: string; qty: number };
export type BagLine = { merchId: string; qty: number; size: string | null };

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStore(key, fallback));
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}
