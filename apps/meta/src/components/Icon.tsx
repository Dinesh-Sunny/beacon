// One outline icon set, 24px grid, 1.8 stroke. Decorative unless a label is given.

const PATHS: Record<string, string> = {
  panel: "M4 5h16v14H4zM9 5v14",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  send: "M5 12h13M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  back: "M15 6l-6 6 6 6",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  warn: "M12 4l9 16H3zM12 10v4M12 17v.5",
  up: "M12 19V5M6 11l6-6 6 6",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  shrink: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  restart: "M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4",
  doc: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  play: "M8 5l11 7-11 7z",
  stop: "M7 7h10v10H7z",
  share: "M12 3v12M7 8l5-5 5 5M5 14v6h14v-6",
  download: "M12 4v12M7 11l5 5 5-5M5 20h14",
  copy: "M8 8h11v12H8zM5 16V4h11",
  arrow: "M5 12h14M13 6l6 6-6 6",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
};

export function Icon({ name, size = 20, label }: { name: keyof typeof PATHS | string; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className="icon"
    >
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <rect width="64" height="64" rx="16" fill="var(--ink)" />
      <circle cx="32" cy="32" r="11" fill="#FFF4D6" stroke="#F3B43C" strokeWidth="4" />
      <path
        d="M32 9v7M32 48v7M9 32h7M48 32h7M16 16l5 5M43 43l5 5M48 16l-5 5M21 43l-5 5"
        stroke="#F3B43C"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
