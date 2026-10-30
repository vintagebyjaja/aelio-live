import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAppearance, designOf, DESIGNS } from "../chat/design-system.ts";
import { appearance } from "../platform/messaging.js";
import { discovery } from "../platform/discovery.js";
test("four official designs remain distinct and legacy mode is preserved", () => {
  assert.equal(DESIGNS.length, 4);
  assert.equal(new Set(DESIGNS.map((d) => d.id)).size, 4);
  assert.equal(designOf({ mode: "light" }).id, "og-light");
  for (const d of DESIGNS)
    assert.equal(appearance({ design: d.id }).design, d.id);
  assert.throws(() => appearance({ design: "random" }));
  assert.throws(() => appearance({ motion: "spin" }));
  assert.throws(() => appearance(null));
});
test("appearance precedence is dynamic and never mutates identities or saved custom settings", () => {
  const global = { design: "og-light", dim: 10, outgoing: "#112233" },
    agent = {
      name: "Chester",
      personality: "The Homie",
      specialty: "Architecture",
      appearance_mode: "custom",
      appearance: { design: "chocolate-cream", dim: 25 },
    };
  const original = JSON.stringify(agent);
  assert.deepEqual(resolveAppearance(global, agent, { dim: 40 }), {
    design: "chocolate-cream",
    dim: 40,
    outgoing: "#112233",
  });
  assert.equal(
    resolveAppearance(global, { ...agent, appearance_mode: "inherit" }).design,
    "og-light",
  );
  assert.equal(
    resolveAppearance(
      { ...global, design: "ocean-fresh" },
      { ...agent, appearance_mode: "inherit" },
    ).design,
    "ocean-fresh",
  );
  assert.equal(
    resolveAppearance(global, agent, { design: "og-dark" }).design,
    "og-dark",
  );
  assert.equal(JSON.stringify(agent), original);
  assert.equal(
    resolveAppearance(global, agent, { mode: "light" }).design,
    "og-light",
  );
  assert.equal(resolveAppearance(global, null).design, "og-light");
});
test("weather validates coordinates and exposes provider failures without fake conditions", async () => {
  await assert.rejects(
    discovery(new Request("https://test/?lat=999&lon=0"), "/weather"),
    /valid location/,
  );
  const orig = globalThis.fetch;
  try {
    let url;
    globalThis.fetch = async (u) => {
      url = String(u);
      return Response.json({
        current: {
          temperature_2m: 72,
          weather_code: 0,
          time: "2026-10-29T10:00",
        },
        daily: { temperature_2m_max: [75], temperature_2m_min: [60] },
        timezone: "America/New_York",
      });
    };
    const r = await discovery(
      new Request("https://test/?lat=35&lon=-80"),
      "/weather",
    );
    assert.equal(new URL(url).hostname, "api.open-meteo.com");
    const d = await r.json();
    assert.equal(d.source, "Open-Meteo");
    assert.equal(d.current.temperature_2m, 72);
    globalThis.fetch = async () =>
      Response.json({ current: { temperature_2m: 72 } });
    await assert.rejects(
      discovery(new Request("https://test/?lat=35&lon=-80"), "/weather"),
      /unavailable/,
    );
    globalThis.fetch = async () => new Response("", { status: 503 });
    await assert.rejects(
      discovery(new Request("https://test/?lat=35&lon=-80"), "/weather"),
      /unavailable/,
    );
  } finally {
    globalThis.fetch = orig;
  }
});
