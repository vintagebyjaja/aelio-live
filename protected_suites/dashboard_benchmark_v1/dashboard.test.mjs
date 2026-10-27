// Protected acceptance tests — dashboard_benchmark_v1
import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const mod = await import(pathToFileURL(path.resolve("src/dashboard.js")).href);
const { sampleData } = await import(pathToFileURL(path.resolve("src/data.js")).href);

const section = (html, name) => {
  const m = html.match(new RegExp(`<([a-z0-9]+)[^>]*data-section="${name}"[^>]*>([\\s\\S]*?)</\\1>`, "i"));
  return m ? m[0] : null;
};

test("exports renderDashboard()", () => {
  assert.equal(typeof mod.renderDashboard, "function");
  assert.equal(typeof mod.renderDashboard(sampleData), "string");
});

test("shows system status", () => {
  const s = section(mod.renderDashboard(sampleData), "status");
  assert.ok(s, 'missing data-section="status"');
  assert.match(s, /operational/i);
  assert.match(s, /All systems normal/);
});

test("shows at most five recent activity items", () => {
  const s = section(mod.renderDashboard(sampleData), "activity");
  assert.ok(s, 'missing data-section="activity"');
  const items = s.match(/<li[\s>]/g) || [];
  assert.equal(items.length, 5);
  assert.match(s, /Training run tr-42 finished/);
  assert.doesNotMatch(s, /should not be shown/);
});

test("empty activity shows a message", () => {
  const html = mod.renderDashboard({ ...sampleData, activity: [] });
  assert.match(section(html, "activity") || "", /No recent activity/i);
});

test("shows exactly three metrics with labels and values", () => {
  const html = mod.renderDashboard(sampleData);
  const cards = html.match(/data-metric(=|\s|>)/g) || [];
  assert.equal(cards.length, 3);
  for (const m of sampleData.metrics) {
    assert.ok(html.includes(m.label), `missing label ${m.label}`);
    assert.ok(html.includes(String(m.value)), `missing value ${m.value}`);
  }
});

test("escapes untrusted text (no HTML injection)", () => {
  const evil = { ...sampleData, activity: [{ time: "0", text: '<img src=x onerror="alert(1)">' }],
                 status: { ...sampleData.status, message: "<script>bad()</script>" } };
  const html = mod.renderDashboard(evil);
  assert.ok(!html.includes("<script>bad()"), "status message not escaped");
  assert.ok(!html.includes('<img src=x'), "activity text not escaped");
});
