const PATHS = {
  home: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  tx: <path d="M4 7h13M14 4l3 3-3 3M20 17H7M10 14l-3 3 3 3" />,
  inst: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></>,
  cats: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1" /></>,
  cards: <><rect x="3" y="5" width="15" height="11" rx="2" /><path d="M7 19h12a2 2 0 0 0 2-2V9" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  send: <path d="M5 12h13M13 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  sync: <path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M4 4v4h4M20 20v-4h-4" />,
  chev: <path d="M9 6l6 6-6 6" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`i ${className}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
