// Public, operator-approved destinations only. No invented APIs or query parameters.
export const ECOSYSTEM_APPS = Object.freeze([
  {
    id: "groove-guide",
    name: "Groove Guide",
    url: "https://grooveville.org/guide/",
    icon: "compass",
    description: "Your personal travel and navigation companion.",
    capabilities: [
      "Plan a trip",
      "Explore destinations",
    ],
    intent: "travel_planning",
  },
  {
    id: "vybr8",
    name: "VYBR8",
    url: "https://vybr8.live/",
    icon: "sparkle",
    description: "Discover places, experiences, and moments that match your vibe.",
    capabilities: [
      "Explore food and drinks",
      "Discover experiences",
    ],
    intent: "food_discovery",
  },
  {
    id: "pathd",
    name: "PATHD",
    url: "https://mypathd.com",
    icon: "agents",
    description: "Career and life with MILA",
    capabilities: [
      "Your career and life with MILA",
      "Explore your next move",
    ],
    intent: "career_support",
  },
]);
export function ecosystemHandoff(input) {
  const app = ECOSYSTEM_APPS.find((a) => a.id === input?.app);
  if (!app || input.intent !== app.intent)
    throw Error("Unsupported connected-app action.");
  const clean = (value, max) => {
    if (typeof value !== "string" || value.length > max)
      throw Error("Invalid handoff details.");
    return value.trim();
  };
  const summary = clean(input.summary, 500);
  if (!summary) throw Error("Describe the handoff.");
  const result = {
    app: app.id,
    name: app.name,
    url: app.url,
    intent: app.intent,
    summary,
    status: "handoff_only",
    permissions: [],
    dataRetrieved: false,
  };
  if (input.origin != null) result.origin = clean(input.origin, 200);
  if (input.destination != null)
    result.destination = clean(input.destination, 200);
  if (input.mode != null) {
    if (!["driving", "walking", "unspecified"].includes(input.mode))
      throw Error("Unsupported travel mode.");
    result.mode = input.mode;
  }
  return result;
}
