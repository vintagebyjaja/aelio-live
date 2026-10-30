// Fixed public providers only. Coordinates are transient, never added to profiles/logs.
import { reply, fail } from "./shared.js";
export async function discovery(req, path) {
  if (req.method !== "GET") fail(405, "method_not_allowed", "Use GET.");
  const q = new URL(req.url).searchParams;
  let endpoint;
  if (path === "/places") {
    const name = (q.get("q") || "").trim();
    if (name.length < 2 || name.length > 100)
      fail(400, "invalid_location", "Enter a city or place name.");
    endpoint =
      "https://geocoding-api.open-meteo.com/v1/search?" +
      new URLSearchParams({ name, count: "5", language: "en", format: "json" });
  } else if (path === "/weather") {
    const lat = Number(q.get("lat")),
      lon = Number(q.get("lon"));
    if (
      !q.has("lat") ||
      !q.has("lon") ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      fail(400, "invalid_location", "Choose a valid location.");
    endpoint =
      "https://api.open-meteo.com/v1/forecast?" +
      new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: "temperature_2m,weather_code",
        daily: "temperature_2m_max,temperature_2m_min",
        temperature_unit: "fahrenheit",
        forecast_days: "1",
        timezone: "auto",
      });
  } else fail(404, "not_found", "Not found.");
  try {
    const r = await fetch(endpoint, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw Error("provider");
    const d = await r.json();
    if (path === "/places")
      return reply({
        places: (d.results || []).slice(0, 5).map((p) => ({
          name: [p.name, p.admin1, p.country].filter(Boolean).join(", "),
          lat: p.latitude,
          lon: p.longitude,
        })),
        source: "Open-Meteo / GeoNames",
      });
    if (
      !Number.isFinite(d.current?.temperature_2m) ||
      !Number.isInteger(d.current?.weather_code) ||
      typeof d.current?.time !== "string" ||
      !Number.isFinite(Date.parse(d.current.time)) ||
      typeof d.timezone !== "string" ||
      !Number.isFinite(d.daily?.temperature_2m_max?.[0]) ||
      !Number.isFinite(d.daily?.temperature_2m_min?.[0])
    )
      throw Error("data");
    return reply(
      {
        current: d.current,
        daily: d.daily,
        timezone: d.timezone,
        source: "Open-Meteo",
        retrieved_at: new Date().toISOString(),
      },
      200,
      { "cache-control": "private, max-age=300" },
    );
  } catch {
    fail(
      503,
      "discovery_unavailable",
      "Weather or location search is temporarily unavailable. Try again later.",
    );
  }
}
