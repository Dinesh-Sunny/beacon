"use client";

// Display settings (Figma Kit 10, Display tab): a text size, twelve settings, a read-aloud speed,
// and eight comfort presets that switch groups of settings by need. Kept on this device only and
// applied as data attributes on <html>, so plain CSS does the work on every page. The person's
// own browser and system settings (zoom, forced colours, reduced motion) always win.

import { useCallback, useSyncExternalStore } from "react";

export const SETTINGS = [
  "dark",
  "contrast",
  "soft",
  "spacing",
  "readAloud",
  "captions",
  "simple",
  "calm",
  "colours",
  "links",
  "tap",
  "focus",
] as const;
export type Setting = (typeof SETTINGS)[number];

export const PRESETS = {
  read: ["soft", "spacing"],
  colours: ["colours", "links"],
  bigger: ["contrast"],
  listen: ["readAloud", "captions"],
  calmer: ["calm", "soft"],
  focus: ["focus", "calm"],
  simple: ["simple"],
  tap: ["tap"],
} as const satisfies Record<string, readonly Setting[]>;
export type Preset = keyof typeof PRESETS;
/** Text size each preset sets, when it sets one. */
const PRESET_SIZE: Partial<Record<Preset, number>> = { bigger: 2, simple: 1 };

export const SPEEDS = { slower: 0.8, normal: 1, faster: 1.2 } as const;
export type Speed = keyof typeof SPEEDS;

export interface Display {
  size: 0 | 1 | 2 | 3;
  on: Setting[];
  speed: Speed;
}
export const STANDARD: Display = { size: 1, on: [], speed: "normal" };

const KEY = "beacon:display";
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Display } = {
  raw: null,
  value: STANDARD,
};

function read(): Display {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (raw === cache.raw) return cache.value;
  let value = STANDARD;
  try {
    const d = JSON.parse(raw ?? "null") as Partial<Display> | null;
    if (d)
      value = {
        size: ([0, 1, 2, 3] as const).includes(d.size as 0)
          ? (d.size as Display["size"])
          : 1,
        on: (d.on ?? []).filter((s): s is Setting =>
          SETTINGS.includes(s as Setting),
        ),
        speed: d.speed && d.speed in SPEEDS ? d.speed : "normal",
      };
  } catch {
    /* bad value: standard */
  }
  cache = { raw, value };
  return value;
}

/** Puts the settings on <html> as data attributes for the CSS to follow. */
export function applyDisplay(d: Display) {
  const root = document.documentElement;
  root.dataset.size = String(d.size);
  for (const s of SETTINGS) {
    if (d.on.includes(s)) root.dataset[s] = "on";
    else delete root.dataset[s];
  }
}

function write(d: Display) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage blocked: still applies for this visit */
  }
  cache = { raw: JSON.stringify(d), value: d };
  applyDisplay(d);
  for (const l of listeners) l();
}

export function useDisplay() {
  const display = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => STANDARD,
  );
  const set = useCallback((d: Display) => write(d), []);
  // Changes read the latest saved settings, so quick taps never undo each other.
  const toggle = useCallback((s: Setting) => {
    const d = read();
    const on = d.on.includes(s) ? d.on.filter((x) => x !== s) : [...d.on, s];
    write({ ...d, on });
  }, []);
  /** A preset is on when all its settings are, partly on when some are. */
  const presetState = (p: Preset): "on" | "partly" | "off" => {
    const n = PRESETS[p].filter((s) => display.on.includes(s)).length;
    return n === 0 ? "off" : n === PRESETS[p].length ? "on" : "partly";
  };
  const togglePreset = (p: Preset) => {
    const d = read();
    const settings: readonly Setting[] = PRESETS[p];
    const turnOn = !settings.every((s) => d.on.includes(s));
    const on = turnOn
      ? [...new Set([...d.on, ...settings])]
      : d.on.filter((s) => !settings.includes(s));
    const size =
      turnOn && PRESET_SIZE[p] !== undefined
        ? Math.max(d.size, PRESET_SIZE[p])
        : d.size;
    write({ ...d, on, size: size as Display["size"] });
  };
  const changes =
    display.on.length +
    (display.size !== STANDARD.size ? 1 : 0) +
    (display.speed !== "normal" ? 1 : 0);
  return {
    display,
    set,
    toggle,
    presetState,
    togglePreset,
    changes,
    reset: () => write(STANDARD),
  };
}

/** The read-aloud rate for the person's chosen speed. */
export const speechRate = (): number => SPEEDS[read().speed];
export const isOn = (s: Setting): boolean => read().on.includes(s);
