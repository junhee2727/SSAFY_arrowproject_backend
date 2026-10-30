const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const source = ["route-optimizer.js", "car-route.js", "map.js"].map((file) => fs.readFileSync(path.join(__dirname, "../js/", file), "utf8")).join("\n")
  .replace(/^import .*;$/gm, "")
  .replace(/export const /g, "const ");
const place = { contentid: "123", contenttypeid: "12", title: "여행지", mapx: "127.1", mapy: "37.5", addr1: "서울" };
const plan = (id) => ({ id, title: `계획 ${id}`, date: "2026-10-17", description: "기존 설명" });
const settle = () => new Promise(setImmediate);

function harness(plans, { withMap = false, fetch = async () => ({ ok: false }), deferredOptimization = false } = {}) {
  let stored = JSON.stringify(plans);
  let failWrites = false;
  const nodes = new Map();
  const updates = [];
  const lines = [];
  const markerOptions = [];
  let finishOptimization;
  for (const id of ["tab-plan", "tab-plan-btn", "plan-depth-list", "plan-depth-detail", "detail-plan-title", "detail-place-list", "saved-plan-list", "btn-plan-back", "plan-detail-status", "plan-route-mode", "btn-optimize-plan", "detail-plan-meta"]) {
    const classes = new Set(id === "tab-plan" ? ["active"] : id === "plan-depth-detail" ? ["d-none"] : []);
    nodes.set(`#${id}`, {
      innerHTML: "", textContent: "", handlers: {},
      setAttribute() {}, querySelector() { return null; },
      classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name), toggle: (name, active) => active ? classes.add(name) : classes.delete(name) },
      addEventListener(name, handler) { this.handlers[name] = handler; },
    });
  }
  const kakao = { maps: {
    LatLng: function (lat, lng) { this.lat = lat; this.lng = lng; },
    Polyline: function (options) {
      this.path = options.path;
      this.setMap = (map) => { this.map = map; };
      lines.push(this);
    },
  } };
  const context = vm.createContext({
    DATA_GO_KR_API_KEY: "test-only", KAKAO_REST_API_KEY: "test-only",
    AbortController, URLSearchParams, setTimeout, clearTimeout,
    initPlanSortable: () => ({ cancel() {} }),
    startRouteOptimization: (places) => {
      let fail;
      const promise = new Promise((resolve, reject) => {
        fail = reject;
        finishOptimization = () => resolve(vm.runInContext("optimizeVisitOrder", context)(places));
        if (!deferredOptimization) queueMicrotask(finishOptimization);
      });
      return { promise, cancel: () => fail(new Error("OPTIMIZATION_CANCELLED")) };
    },
    window: { kakao }, kakao, console: { warn() {} }, fetch,
    map: withMap ? { setCenter() {}, setLevel() {} } : null,
    updateMap: async (places, options) => { updates.push(places); markerOptions.push(options); },
    document: { readyState: "complete", querySelector: (selector) => nodes.get(selector), dispatchEvent() {} },
    CustomEvent: function (type) { this.type = type; },
    bootstrap: { Collapse: { getOrCreateInstance: () => ({ show() {} }) } },
    localStorage: {
      getItem: () => stored,
      setItem: (key, value) => {
        assert.equal(key, "myTripPlans");
        if (failWrites) throw new Error("QuotaExceededError");
        stored = value;
      },
    },
  });
  vm.runInContext(source, context);
  return {
    nodes, updates, lines, markerOptions,
    reorder: vm.runInContext("reorderActivePlan", context),
    lock: vm.runInContext("setPlaceOrderLocked", context),
    optimize: vm.runInContext("optimizeActivePlan", context),
    finishOptimization: () => finishOptimization(),
    add: vm.runInContext("addPlaceToPlan", context),
    remove: vm.runInContext("removePlaceFromActivePlan", context),
    list: vm.runInContext("getTravelPlans", context),
    open: context.window.openPlanDetail,
    read: () => JSON.parse(stored),
    replace: (value) => { stored = JSON.stringify(value); },
    failWrites: (value) => { failWrites = value; },
    back: () => nodes.get("#btn-plan-back").handlers.click(),
    leaveTab: () => nodes.get("#tab-plan-btn").handlers["hide.bs.tab"](),
  };
}

test("a destination plan is required but opening its detail is not required", async () => {
  const h = harness([plan("a")]);
  assert.throws(() => h.add("", place), /NO_PLAN_SELECTED/);
  assert.throws(() => h.add("missing", place), /PLAN_NOT_FOUND/);
  h.leaveTab();
  assert.equal(h.add("a", place).added, true);
  assert.equal(h.list()[0].places.length, 1);
});

test("adding persists only the selected plan and keeps its metadata and place API identifiers", async () => {
  const h = harness([plan("a"), plan("b")]);
  await h.open("a");
  assert.equal(h.add("b", place).added, true);
  const saved = h.read();
  assert.deepEqual(saved[0], plan("a"));
  assert.deepEqual({ ...saved[1], places: undefined }, { ...plan("b"), places: undefined });
  assert.deepEqual(saved[1].places[0], { ...place, label: "여행지", x: 127.1, y: 37.5, address: "서울" });
  assert.equal(h.nodes.get("#detail-plan-title").textContent, "계획 a");
  const reloaded = harness(saved);
  await reloaded.open("b");
  assert.match(reloaded.nodes.get("#detail-place-list").innerHTML, /여행지/);
});

test("repeated clicks deduplicate by content ID or by name and coordinates for ID-less places", async () => {
  const h = harness([plan("a"), plan("b")]);
  await h.open("a");
  h.add("a", place);
  assert.equal(h.add("a", { ...place, contentid: 123 }).added, false);
  const campus = { label: "서울캠퍼스", x: 127.04, y: 37.5 };
  assert.equal(h.add("a", campus).added, true);
  assert.equal(h.add("a", { ...campus, x: "127.04" }).added, false);
  assert.equal(h.read()[0].places.length, 2);
  assert.equal(h.add("b", place).added, true);
  assert.equal(h.read()[1].places.length, 1);
});

test("fresh storage changes are preserved and a deleted plan is never recreated", async () => {
  const h = harness([plan("a")]);
  await h.open("a");
  h.replace([{ ...plan("a"), description: "다른 창에서 수정", places: [{ ...place, contentid: "456" }] }]);
  h.add("a", place);
  assert.equal(h.read()[0].description, "다른 창에서 수정");
  assert.equal(h.read()[0].places.length, 2);
  h.replace([]);
  assert.throws(() => h.add("a", place), /PLAN_NOT_FOUND/);
  assert.deepEqual(h.read(), []);
});

test("invalid coordinates and failed writes leave saved plans and the visit list unchanged", async () => {
  const h = harness([plan("a")]);
  await h.open("a");
  const initialList = h.nodes.get("#detail-place-list").innerHTML;
  assert.throws(() => h.add("a", { ...place, mapx: "invalid" }), /INVALID_PLACE/);
  h.failWrites(true);
  assert.throws(() => h.add("a", place), /QuotaExceededError/);
  assert.deepEqual(h.read(), [plan("a")]);
  assert.equal(h.nodes.get("#detail-place-list").innerHTML, initialList);
  h.failWrites(false);
  assert.equal(h.add("a", place).added, true);
  assert.equal(h.read()[0].places.length, 1);
});

test("adding multiple places preserves search markers until the user opens the plan", async () => {
  const h = harness([plan("a")], { withMap: true });
  h.add("a", place);
  await settle();
  h.add("a", { ...place, contentid: "456", title: "다음 여행지", mapx: "127.2" });
  await settle();
  assert.equal(h.updates.length, 0);
  assert.equal(h.lines.length, 0);
  assert.equal(h.read()[0].places.length, 2);
  await h.open("a");
  assert.deepEqual(Array.from(h.updates.at(-1), (item) => item.contentid), ["123", "456"]);
  assert.deepEqual(Array.from(h.lines.at(-1).path, (point) => point.lng), [127.1, 127.2]);
  h.back();
  assert.equal(h.lines.at(-1).map, null);
});

test("a late route response cannot draw a route after leaving the plan", async () => {
  let resolveFetch;
  const h = harness([{ ...plan("a"), places: [{ ...place, x: 127.1, y: 37.5 }, { ...place, x: 127.2, y: 37.6 }] }], {
    withMap: true,
    fetch: () => new Promise((resolve) => { resolveFetch = resolve; }),
  });
  const opening = h.open("a");
  await settle();
  h.back();
  resolveFetch({ ok: false });
  await opening;
  assert.equal(h.lines.length, 0);
});

test("removing a place persists the remaining order and refreshes markers and the route", async () => {
  const places = [0, 1, 2].map((index) => ({ ...place, contentid: String(index), title: `장소 ${index}`, x: 127.1 + index / 10, y: 37.5 }));
  places[0].visitTime = "10:00";
  const h = harness([{ ...plan("a"), places }, { ...plan("b"), places }], { withMap: true });
  await h.open("a");
  const initialList = h.nodes.get("#detail-place-list").innerHTML;
  assert.doesNotMatch(initialList, /방문 시간 미지정/);
  assert.match(initialList, /10:00/);
  assert.match(initialList, /aria-label="장소 1 삭제"/);
  const previousLine = h.lines.at(-1);
  await h.remove(1);
  const saved = h.read();
  assert.deepEqual(saved[0], { ...plan("a"), places: [places[0], places[2]] });
  assert.deepEqual(saved[1], { ...plan("b"), places });
  assert.equal(previousLine.map, null);
  assert.deepEqual(Array.from(h.updates.at(-1), (item) => item.contentid), ["0", "2"]);
  assert.deepEqual(Array.from(h.lines.at(-1).path, (point) => point.lng), [127.1, 127.3]);
  assert.doesNotMatch(h.nodes.get("#detail-place-list").innerHTML, /장소 1|data-remove-place="2"/);
  assert.match(h.nodes.get("#saved-plan-list").innerHTML, /기존 설명/);
  const reloaded = harness(saved);
  await reloaded.open("a");
  assert.doesNotMatch(reloaded.nodes.get("#detail-place-list").innerHTML, /장소 1/);

  const route = h.lines.at(-1);
  await h.remove(0);
  assert.equal(route.map, null);
  assert.equal(h.updates.at(-1).length, 1);
  await h.remove(0);
  assert.deepEqual(h.read()[0].places, []);
  assert.equal(h.updates.at(-1).length, 0);
  assert.match(h.nodes.get("#detail-place-list").innerHTML, /등록된 장소가 없습니다/);
});

test("removing an ID-less place finds it in fresh storage without overwriting other edits", async () => {
  const first = { label: "첫 장소", x: 127.1, y: 37.5 };
  const second = { label: "둘째 장소", x: 127.2, y: 37.5 };
  const h = harness([{ ...plan("a"), places: [first, second] }]);
  await h.open("a");
  h.replace([{ ...plan("a"), description: "수정된 설명", places: [second, first, place] }]);
  await h.remove(1);
  assert.deepEqual(h.read()[0], { ...plan("a"), description: "수정된 설명", places: [first, place] });
});

test("failed deletion and stale selections leave saved places and the visible list unchanged", async () => {
  const initial = [{ ...plan("a"), places: [place] }];
  const h = harness(initial);
  await assert.rejects(h.remove(0), /NO_PLAN_SELECTED/);
  await h.open("a");
  const initialList = h.nodes.get("#detail-place-list").innerHTML;
  await assert.rejects(h.remove(-1), /PLACE_NOT_FOUND/);
  h.failWrites(true);
  await assert.rejects(h.remove(0), /QuotaExceededError/);
  assert.deepEqual(h.read(), initial);
  assert.equal(h.nodes.get("#detail-place-list").innerHTML, initialList);
  h.failWrites(false);
  h.replace([{ ...plan("a"), places: [{ ...place, contentid: "456" }] }]);
  await assert.rejects(h.remove(0), /PLACE_NOT_FOUND/);
  assert.equal(h.read()[0].places[0].contentid, "456");
  h.replace([]);
  await assert.rejects(h.remove(0), /PLAN_NOT_FOUND/);
  assert.deepEqual(h.read(), []);
});

test("a late route response cannot restore a route containing a removed place", async () => {
  let resolveFetch;
  const h = harness([{ ...plan("a"), places: [{ ...place, x: 127.1, y: 37.5 }, { ...place, contentid: "456", x: 127.2, y: 37.6 }] }], {
    withMap: true,
    fetch: () => new Promise((resolve) => { resolveFetch = resolve; }),
  });
  const opening = h.open("a");
  await settle();
  await h.remove(0);
  resolveFetch({ ok: false });
  await opening;
  assert.equal(h.lines.length, 0);
  assert.deepEqual(Array.from(h.updates.at(-1), (item) => item.contentid), ["456"]);
});


test("reordering saves every place and metadata, numbers markers, and survives reload", async () => {
  const places = [0, 1, 2, 3].map((index) => ({ ...place, contentid: String(index), title: `장소 ${index}`, x: 127 + index / 10, y: 37.5 }));
  const h = harness([{ ...plan("a"), places }, plan("b")], { withMap: true });
  await h.open("a");
  const previousLine = h.lines.at(-1);
  await h.reorder([2, 0, 3, 1]);
  assert.deepEqual(h.read()[0].places.map((item) => item.contentid), ["2", "0", "3", "1"]);
  assert.equal(h.read()[0].description, "기존 설명");
  assert.deepEqual(h.read()[1], plan("b"));
  assert.equal(previousLine.map, null);
  assert.equal(h.markerOptions.at(-1).numbered, true);
  assert.deepEqual(Array.from(h.lines.at(-1).path, (point) => point.lng), [127.2, 127, 127.3, 127.1]);
  const reloaded = harness(h.read());
  await reloaded.open("a");
  const html = reloaded.nodes.get("#detail-place-list").innerHTML;
  assert.ok(html.indexOf('title="장소 2"') < html.indexOf('title="장소 0"'));
  assert.match(html, /aria-label="방문 4번"/);
});

test("order locks persist, protect endpoints, and reject invalid permutations", async () => {
  const places = [0, 1, 2, 3].map((index) => ({ ...place, contentid: String(index), x: 127 + index / 10, y: 37.5 }));
  const h = harness([{ ...plan("a"), places }]);
  await h.open("a");
  h.lock(0); h.lock(3);
  await assert.rejects(h.reorder([1, 0, 2, 3]), /LOCKED_ORDER/);
  await assert.rejects(h.reorder([0, 1, 1, 3]), /INVALID_ORDER/);
  await h.reorder([0, 2, 1, 3]);
  assert.equal(h.read()[0].places[0].orderLocked, true);
  assert.equal(h.read()[0].places[3].orderLocked, true);
  const reloaded = harness(h.read());
  await reloaded.open("a");
  assert.match(reloaded.nodes.get("#detail-place-list").innerHTML, /data-place-index="0" data-locked="true"/);
  reloaded.lock(0);
  assert.equal(reloaded.read()[0].places[0].orderLocked, false);
});

test("failed order or lock writes keep the saved and visible order unchanged", async () => {
  const h = harness([{ ...plan("a"), places: [place, { ...place, contentid: "456" }] }]);
  await h.open("a");
  const before = h.nodes.get("#detail-place-list").innerHTML;
  h.failWrites(true);
  await assert.rejects(h.reorder([1, 0]), /QuotaExceededError/);
  assert.throws(() => h.lock(0), /QuotaExceededError/);
  assert.equal(h.nodes.get("#detail-place-list").innerHTML, before);
  assert.equal(h.read()[0].places[0].contentid, "123");
});

test("reordering retains fresh metadata and rejects a changed place list", async () => {
  const places = [place, { ...place, contentid: "456" }];
  const h = harness([{ ...plan("a"), places }]);
  await h.open("a");
  h.replace([{ ...plan("a"), description: "다른 창의 설명", places: places.map((p) => ({ ...p, visitTime: "10:00" })) }]);
  await h.reorder([1, 0]);
  assert.equal(h.read()[0].description, "다른 창의 설명");
  assert.equal(h.read()[0].places[0].visitTime, "10:00");
  h.replace([{ ...plan("a"), places }]);
  await assert.rejects(h.reorder([1, 0]), /PLAN_CHANGED/);
  assert.deepEqual(h.read()[0].places, places);
});

test("optimization saves the exact order with locked endpoints and no extra pairwise API calls", async () => {
  let calls = 0;
  const places = [0, 3, 1, 2, 4].map((position, index) => ({ ...place, contentid: String(position), x: 127 + position / 10, y: 37.5, orderLocked: index === 0 || index === 4 }));
  const h = harness([{ ...plan("a"), places }], { withMap: true, fetch: async () => { calls += 1; return { ok: false }; } });
  await h.open("a");
  const result = await h.optimize();
  assert.equal(result.exact, true);
  assert.deepEqual(h.read()[0].places.map((p) => p.contentid), ["0", "1", "2", "3", "4"]);
  assert.equal(calls, 2); // 열기와 최종 경로 표시만 요청합니다.
});

test("leaving or editing a plan cancels optimization; late results never overwrite changes", async () => {
  const places = [0, 3, 1, 2].map((position) => ({ ...place, contentid: String(position), x: 127 + position / 10, y: 37.5 }));
  for (const edit of ["leave", "lock", "remove"]) {
    const h = harness([{ ...plan("a"), places }], { deferredOptimization: true });
    await h.open("a");
    const pending = h.optimize();
    const rejected = assert.rejects(pending, /OPTIMIZATION_CANCELLED/);
    if (edit === "leave") h.back();
    else if (edit === "lock") h.lock(0);
    else await h.remove(1);
    const saved = h.read();
    h.finishOptimization();
    await rejected;
    assert.deepEqual(h.read(), saved);
  }
});
