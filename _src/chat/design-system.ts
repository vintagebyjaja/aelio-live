export const DESIGNS = [
  {
    id: "og-light",
    name: "OG Light",
    description: "Clean, minimal, familiar",
    light: true,
    accent: "#e87832",
    scene: "ocean-fresh.webp",
    surface: "#fffaf4",
  },
  {
    id: "og-dark",
    name: "OG Dark",
    description: "Original copper after dark",
    light: false,
    accent: "#f68b45",
    scene: "chocolate-cream.webp",
    surface: "#101219",
  },
  {
    id: "ocean-fresh",
    name: "Ocean Fresh",
    description: "Airy coastal living",
    light: true,
    accent: "#237d9d",
    scene: "ocean-fresh.webp",
    surface: "#f8f3e9",
  },
  {
    id: "chocolate-cream",
    name: "Chocolate Cream",
    description: "Warm, intimate city nights",
    light: false,
    accent: "#cba276",
    scene: "chocolate-cream.webp",
    surface: "#2c1b15",
  },
];
export function designOf(ap: any = {}) {
  return (
    DESIGNS.find((d) => d.id === ap.design) ||
    DESIGNS.find(
      (d) => d.id === (ap.mode === "light" ? "og-light" : "og-dark"),
    )!
  );
}
export function resolveAppearance(
  global: any = {},
  agent: any,
  conversation: any = {},
) {
  const inherited =
    agent?.appearance_mode === "custom" ? agent.appearance || {} : {};
  const merged = { ...global, ...inherited, ...conversation };
  // Historical mode-only overrides retain their original light/dark meaning.
  if (conversation.mode && !conversation.design)
    merged.design = conversation.mode === "light" ? "og-light" : "og-dark";
  else if (inherited.mode && !inherited.design && !conversation.design)
    merged.design = inherited.mode === "light" ? "og-light" : "og-dark";
  return merged;
}
export function guestAppearance() {
  try {
    const v = JSON.parse(localStorage.getItem("aelio.appearance") || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}
