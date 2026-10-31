const paths: Record<string, string[]> = {
  home: ["M3 10 12 3l9 7", "M5 9v12h5v-7h4v7h5V9"],
  agents: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    "M18 8a3 3 0 0 1 0 6",
    "M19 17a3 3 0 0 1 3 3v1",
  ],
  compass: [
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
    "m16 8-3 5-5 3 3-5 5-3Z",
  ],
  settings: [
    "m10 3-1 3-3 1-3-1-1 4 2 2-1 3 3 3 3-1 2 2 4-1 1-3 3-1 1-4-2-2 1-3-3-3-3 1-2-2Z",
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  ],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  sparkle: ["m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"],
  plus: ["M12 4v16M4 12h16"],
  mic: [
    "M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3",
    "M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8",
  ],
  send: ["M12 20V4m-7 7 7-7 7 7"],
  chat: ["M21 11a9 9 0 0 1-13 8l-6 3 2-6A9 9 0 1 1 21 11Z"],
  bulb: ["M9 18h6M9 21h6", "M8 15a7 7 0 1 1 8 0l-1 3H9l-1-3Z"],
  echo: ["M8 8a6 6 0 0 1 8 8", "M5 5a10 10 0 0 1 14 14", "M11 11a2 2 0 0 1 2 2"],
  library: ["M3 4h6v16H3zM11 4h4v16h-4zM17 5l3-1 4 15-3 1Z"],
  more: ["M5 12h.01M12 12h.01M19 12h.01"],
  arrow: ["M4 12h16m-6-6 6 6-6 6"],
  close: ["m5 5 14 14M19 5 5 19"],
  sun: [
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    "M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
  ],
  moon: ["M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"],
};
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {(paths[name] || paths.sparkle).map((d, i) => (
        <path d={d} key={i} />
      ))}
    </svg>
  );
}
export { AelioOrb as Orb } from "./AelioOrb";
