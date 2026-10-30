const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const context = vm.createContext({ AbortController, URLSearchParams, setTimeout, clearTimeout });
vm.runInContext(["route-optimizer.js", "car-route.js"].map((file) => fs.readFileSync(path.join(__dirname, "../js/", file), "utf8")).join("\n").replace(/^import .*;$/gm, "").replace(/export const /g, "const "), context);
const route = vm.runInContext("fetchCarRoute", context);
const places = (n) => Array.from({ length: n }, (_, i) => ({ x: 127 + i / 100, y: 37.5 }));
const answer = (url) => {
  const query = new URL(url).searchParams;
  const points = [query.get("origin"), ...(query.get("waypoints")?.split("|") || []), query.get("destination")].map((p) => p.split(",").map(Number));
  return { ok: true, json: async () => ({ routes: [{ result_code: 0, sections: points.slice(1).map((p, i) => ({ roads: [{ vertexes: [...points[i], ...p] }] })) }] }) };
};

test("all waypoints are included in overlapping batches of at most five intermediate stops", async () => {
  for (const n of [2, 7, 8, 13, 20, 50]) {
    const requests = [];
    const result = await route(places(n), { apiKey: "test", fetchImpl: async (url) => { requests.push(url); return answer(url); } });
    assert.equal(requests.length, Math.ceil((n - 1) / 6));
    for (const url of requests) assert.ok((new URL(url).searchParams.get("waypoints")?.split("|") || []).length <= 5);
    assert.deepEqual(Array.from(result.path, (p) => p.lng), places(n).map((p) => p.x));
    assert.equal(result.fallback, false);
  }
});

test("API failure or incomplete sections retain all affected places using straight segments", async () => {
  for (const response of [{ ok: false, status: 500 }, { ok: true, json: async () => ({ routes: [{ result_code: 0, sections: [] }] }) }]) {
    const result = await route(places(20), { apiKey: "test", fetchImpl: async () => response });
    assert.equal(result.fallback, true);
    assert.deepEqual(Array.from(result.path, (p) => p.lng), places(20).map((p) => p.x));
  }
});

test("missing keys skip requests, quota failure stops additional requests, and cancellation stops later batches", async () => {
  let calls = 0;
  await route(places(20), { fetchImpl: async () => { calls += 1; } });
  assert.equal(calls, 0);
  await route(places(20), { apiKey: "test", fetchImpl: async () => { calls += 1; return { ok: false, status: 429 }; } });
  assert.equal(calls, 1);
  const controller = new AbortController();
  await assert.rejects(route(places(20), { apiKey: "test", signal: controller.signal, fetchImpl: async (url) => { controller.abort(); return answer(url); } }), /ROUTE_CANCELLED/);
});
