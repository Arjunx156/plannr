import { useEffect, useState } from "react";
import type { PlannrEvent } from "../data/types";
import { functionsOf } from "../shared/eventLists";
import { fieldsOf, isNumber, isRecord, isString, listOf } from "../shared/guards";
import type { RainRisk } from "../shared/watch";
import { addDays, TODAY } from "./dates";

/**
 * The rain forecast for function days in the next ten days, from Open-Meteo (free, no key,
 * no personal data sent: only the town's name and the dates). Asked once per session.
 */

const cacheKey = (place: string, from: string) => `plannr:rain:${place}:${from}`;

async function coords(place: string): Promise<{ lat: number; lon: number } | undefined> {
  // "Bolgatty Palace, Kochi" → try "Kochi" first; towns geocode far better than venues.
  const parts = place
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const name of [...parts].reverse()) {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&countryCode=IN&name=${encodeURIComponent(name)}`,
    );
    if (!res.ok) continue;
    const data: unknown = await res.json();
    const [hit] = listOf(isRecord(data) ? data["results"] : undefined);
    if (isRecord(hit) && isNumber(hit["latitude"]) && isNumber(hit["longitude"]))
      return { lat: hit["latitude"], lon: hit["longitude"] };
  }
  return undefined;
}

async function rainChances(place: string, from: string, to: string): Promise<Record<string, number>> {
  const key = cacheKey(place, from);
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) return fieldsOf(JSON.parse(hit), isNumber);
  } catch {
    // No session storage: just ask again.
  }
  const at = await coords(place);
  if (!at) return {};
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${at.lat}&longitude=${at.lon}&daily=precipitation_probability_max&timezone=Asia%2FKolkata&start_date=${from}&end_date=${to}`,
  );
  if (!res.ok) return {};
  const data: unknown = await res.json();
  const daily = isRecord(data) && isRecord(data["daily"]) ? data["daily"] : {};
  const chances = listOf(daily["precipitation_probability_max"]);
  const out: Record<string, number> = {};
  listOf(daily["time"]).forEach((d, i) => {
    const p = chances[i];
    if (isString(d) && isNumber(p)) out[d] = p;
  });
  try {
    sessionStorage.setItem(key, JSON.stringify(out));
  } catch {
    // Fine without the cache.
  }
  return out;
}

/** The chance of rain for each function in the next ten days that has a place, from Open-Meteo's forecast. */
export function useRain(ev: PlannrEvent): RainRisk[] {
  const [risks, setRisks] = useState<RainRisk[]>([]);
  const until = addDays(TODAY, 10);
  const soon = functionsOf(ev).filter((f) => f.date >= TODAY && f.date <= until && (f.address || f.place));
  const sig = soon.map((f) => `${f.id}:${f.date}:${f.address ?? f.place}`).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the signature covers the functions that matter
  useEffect(() => {
    if (soon.length === 0 || typeof fetch !== "function") return;
    let live = true;
    void (async () => {
      const found: RainRisk[] = [];
      for (const f of soon) {
        const chances = await rainChances(f.address ?? f.place ?? "", TODAY, until).catch(
          (): Record<string, number> => ({}),
        );
        const chance = chances[f.date];
        if (chance !== undefined) found.push({ fnId: f.id, label: f.label, date: f.date, chance });
      }
      if (live) setRisks(found);
    })();
    return () => {
      live = false;
    };
  }, [sig, until]);
  return risks;
}
