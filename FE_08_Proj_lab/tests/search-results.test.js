const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const mapSource = fs.readFileSync(path.join(__dirname, "../js/map.js"), "utf8");
const locationSource = mapSource.slice(mapSource.indexOf("function locationError("), mapSource.indexOf('document.querySelector("#btn_around_search")', mapSource.indexOf("function locationError(")));
const source = (locationSource + "\n" + fs.readFileSync(path.join(__dirname, "../js/search-results.js"), "utf8"))
  .replace(/^import .*;$/gm, "").replace(/export const /g, "const ");
const data = [
  { contentid: "a", title: "능인선원", addr1: "서울 강남구 양재대로 340", x: 127.04, y: 37.47, createdtime: "20200101000000" },
  { contentid: "b", title: "불국사(서울)", addr1: "서울 강남구 광평로10길 30-71", x: 127.08, y: 37.48, createdtime: "20250101000000" },
  { contentid: "c", title: "선릉과 정릉", addr1: "서울 강남구 선릉로100길 1", x: 127.04, y: 37.51, createdtime: "20230101000000" },
];

class Element {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.handlers = {};
    this.hidden = false;
    this.textContent = "";
    const classes = new Set();
    this.classList = {
      contains: (name) => classes.has(name),
      toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
    };
  }
  append(...nodes) { this.children.push(...nodes.flatMap((node) => node.fragment ? node.children : [node])); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); }
  async emit(type, event = {}) { for (const fn of this.handlers[type] || []) await fn(event); }
  scrollIntoView() { this.scrolled = true; }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...((selector === "[data-sort]" && child.dataset.sort) ||
        (selector === ".search-result-item" && child.className?.split(" ").includes("search-result-item")) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
}

function harness({ geolocation = { getCurrentPosition: (resolve) => resolve({ coords: { latitude: 37.51, longitude: 127.04 } }) }, secure = true } = {}) {
  const ids = ["tab-results", "tab-results-btn", "tab-search-btn", "search-results-summary", "search-results-filters", "search-results-body", "search-results-list", "search-results-empty", "search-results-hint", "search-results-sort-help", "search-results-sort", "tour-detail-modal"];
  const nodes = Object.fromEntries(ids.map((id) => [id, new Element()]));
  for (const sort of ["name", "distance", "registered"]) {
    const button = new Element();
    button.dataset.sort = sort;
    nodes["search-results-sort"].append(button);
  }
  const events = [];
  const listeners = new Map();
  const updates = [];
  const focused = [];
  let showCount = 0;
  let plans = [];
  let plansError = false;
  const timers = new Map();
  const windowListeners = new Map();
  const document = {
    getElementById: (id) => nodes[id],
    createElement: () => new Element(),
    createDocumentFragment: () => Object.assign(new Element(), { fragment: true }),
    addEventListener: (type, fn) => { const handlers = listeners.get(type) || []; handlers.push(fn); listeners.set(type, handlers); },
    dispatchEvent: (event) => { events.push(event); for (const fn of listeners.get(event.type) || []) fn(event); },
  };
  const context = vm.createContext({
    document, map: {}, navigator: { geolocation },
    setTimeout: (callback) => { const id = Symbol(); timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id),
    getTravelPlans: () => { if (plansError) throw new Error("INVALID_PLANS"); return plans; },
    window: { isSecureContext: secure,
      addEventListener: (type, fn) => windowListeners.set(type, fn), bootstrap: { Tab: { getOrCreateInstance: () => ({ show: () => {
      showCount += 1;
      nodes["tab-results"].classList.toggle("active", true);
    } }) } } },
    updateMap: async (infos) => { updates.push(infos); document.dispatchEvent({ type: "enjoytrip:map-updated", detail: { infos } }); },
    focusMapPlace: (place) => focused.push(place),
    CustomEvent: function (type, options) { this.type = type; this.detail = options.detail; },
  });
  vm.runInContext(source + "\ninitSearchResults();", context);
  const send = (detail) => document.dispatchEvent({ type: "enjoytrip:search-state", detail });
  return {
    nodes, updates, events, focused, document, context, send, timers,
    setPlans: (value) => { plans = value; },
    failPlans: () => { plansError = true; },
    storage: (key = "myTripPlans") => windowListeners.get("storage")({ key }),
    buttons: () => nodes["search-results-list"].querySelectorAll(".search-result-item"),
    shown: () => showCount,
    sort: (value) => nodes["search-results-sort"].children.find((button) => button.dataset.sort === value).emit("click"),
    complete: (spots = data) => send({ phase: "complete", spots, filters: "서울 강남구 · 역사관광", origin: { lat: 37.51, lng: 127.04 }, distanceLabel: "내 위치" }),
    sorted: (spots, sort, origin, plans) => Array.from(vm.runInContext("sortSearchResults", context)(spots, sort, origin, plans)),
  };
}

test("name sorting orders Korean titles without changing the API response", () => {
  const h = harness();
  const original = [data[2], data[0], data[1]];
  assert.deepEqual(h.sorted(original, "name").map((place) => place.contentid), ["a", "b", "c"]);
  assert.deepEqual(original.map((place) => place.contentid), ["c", "a", "b"]);
});

test("distance sorting uses the supplied search origin and puts missing coordinates last", () => {
  const h = harness();
  const places = [...data, { contentid: "missing", title: "가", x: "", y: "" }];
  const sorted = h.sorted(places, "distance", { lat: 37.51, lng: 127.04 });
  assert.equal(sorted[0].contentid, "c");
  assert.equal(sorted.at(-1).contentid, "missing");
  assert.equal(h.sorted(places, "distance", { lat: 37.48, lng: 127.08 })[0].contentid, "b");
});

test("registration order counts distinct plans and ignores API creation dates", () => {
  const h = harness();
  const plans = [
    { places: [data[0], data[0], data[0], data[2]] },
    { places: [data[2], data[1]] },
    { places: [data[2]] },
    { places: [] },
  ];
  // c is in three plans; a and b tie at one plan, so Korean name order breaks the tie.
  assert.deepEqual(h.sorted(data, "registered", null, plans).map((place) => place.contentid), ["c", "a", "b"]);
  assert.deepEqual(h.sorted(data, "registered", null, []).map((place) => place.contentid), ["a", "b", "c"]);
});

test("registration IDs compare numbers and strings, while ID-less places match normalized coordinates", () => {
  const h = harness();
  const places = [{ ...data[0], contentid: "123" }, { label: "다른 장소", x: "127.0400", y: "37.5100" }];
  const plans = [{ places: [{ ...data[0], contentid: 123 }] }, { places: [{ title: "다른 장소", x: 127.04, y: 37.51 }] }, { places: [places[1]] }];
  assert.equal(h.sorted(places, "registered", null, plans)[0], places[1]);
});

test("a completed search opens results and renders all 101 items and the captured conditions", () => {
  const h = harness();
  h.complete(Array.from({ length: 101 }, (_, i) => ({ ...data[0], contentid: i })));
  assert.equal(h.buttons().length, 101);
  assert.match(h.nodes["search-results-summary"].textContent, /101/);
  assert.equal(h.nodes["search-results-filters"].textContent, "서울 강남구 · 역사관광");
  assert.equal(h.shown(), 1);
  assert.equal(h.nodes["search-results-empty"].hidden, true);
});

test("selecting a result focuses the map and opens the existing details with the full API item", async () => {
  const h = harness();
  h.complete();
  await h.buttons()[1].emit("click");
  assert.equal(h.focused[0], data[1]);
  assert.equal(h.events.at(-1).type, "enjoytrip:place-selected");
  assert.equal(h.events.at(-1).detail, data[1]);
  assert.equal(h.buttons()[1].attributes["aria-pressed"], "true");
});

test("marker selection stays highlighted when sort order changes", async () => {
  const h = harness();
  h.complete();
  h.document.dispatchEvent({ type: "enjoytrip:place-selected", detail: data[2] });
  await h.sort("distance");
  assert.equal(h.buttons()[0].dataset.placeKey, "c");
  assert.equal(h.buttons()[0].attributes["aria-pressed"], "true");
  assert.match(h.nodes["search-results-sort-help"].textContent, /내 위치 기준 직선거리/);
  await h.nodes["tour-detail-modal"].emit("hidden.bs.offcanvas");
  assert.ok(h.buttons().every((button) => button.attributes["aria-pressed"] === "false"));
});

test("returning from a plan restores search markers without changing list order", async () => {
  const h = harness();
  h.setPlans([{ places: [data[1]] }]);
  h.complete();
  await h.sort("registered");
  h.document.dispatchEvent({ type: "enjoytrip:map-updated", detail: { infos: [data[0]] } });
  await h.nodes["tab-results-btn"].emit("shown.bs.tab");
  assert.equal(h.updates[0], data);
  assert.equal(h.buttons()[0].dataset.placeKey, "b");
});

test("new searches clear stale choices; errors and empty responses have distinct states", () => {
  const h = harness();
  h.complete();
  h.send({ phase: "loading", loaded: 0, total: null });
  assert.equal(h.buttons().length, 0);
  assert.equal(h.nodes["search-results-body"].attributes["aria-busy"], "true");
  h.send({ phase: "loading", loaded: 100, total: 101 });
  assert.match(h.nodes["search-results-empty"].textContent, /101곳 중 100곳/);
  h.send({ phase: "error", message: "조회 실패", notice: "다시 시도해주세요" });
  assert.equal(h.nodes["search-results-summary"].textContent, "조회 실패");
  assert.equal(h.nodes["search-results-body"].attributes["aria-busy"], "false");
  h.complete([]);
  assert.match(h.nodes["search-results-summary"].textContent, /총 0곳/);
  assert.equal(h.nodes["search-results-sort"].hidden, true);
});

test("API text is displayed as text, and long titles retain a full title tooltip", () => {
  const h = harness();
  const title = '<img src=x onerror="alert(1)"> 아주 긴 관광지 이름';
  h.complete([{ ...data[0], title }]);
  const titleNode = h.buttons()[0].children[0].children[0];
  assert.equal(titleNode.textContent, title);
  assert.equal(titleNode.title, title);
  assert.equal(titleNode.children.length, 0);
});


test("distance sorting requests a fresh geolocation instead of using the search map origin", async () => {
  let requests = 0;
  const h = harness({ geolocation: { getCurrentPosition: (resolve, reject, options) => {
    requests += 1;
    assert.equal(options.maximumAge, 0);
    assert.equal(options.timeout, 10000);
    resolve({ coords: { latitude: 37.48, longitude: 127.08 } });
  } } });
  h.complete(); // Search metadata deliberately points to c.
  await h.sort("name");
  await h.sort("registered");
  assert.equal(requests, 0);
  await h.sort("distance");
  assert.equal(requests, 1);
  assert.equal(h.buttons()[0].dataset.placeKey, "b");
  assert.equal(h.updates.length, 0); // Sorting does not replace or move the map.
});

for (const [code, notice] of [[1, /차단/], [2, /확인할 수 없어요/], [3, /초과/]]) {
  test(`geolocation failure ${code} preserves the prior order and allows retry`, async () => {
    let fail = true;
    const h = harness({ geolocation: { getCurrentPosition: (resolve, reject) => fail
      ? reject({ code }) : resolve({ coords: { latitude: 37.51, longitude: 127.04 } }) } });
    h.setPlans([{ places: [data[1]] }]);
    h.complete();
    await h.sort("registered");
    const before = h.buttons().map((button) => button.dataset.placeKey);
    await h.sort("distance");
    assert.deepEqual(h.buttons().map((button) => button.dataset.placeKey), before);
    assert.match(h.nodes["search-results-sort-help"].textContent, notice);
    const distanceButton = h.nodes["search-results-sort"].children[1];
    assert.equal(distanceButton.attributes["aria-pressed"], "false");
    assert.equal(distanceButton.attributes["aria-busy"], "false");
    assert.equal(distanceButton.disabled, false);
    fail = false;
    await h.sort("distance");
    assert.equal(h.buttons()[0].dataset.placeKey, "c");
    assert.equal(distanceButton.attributes["aria-pressed"], "true");
  });
}

test("unsupported or insecure geolocation leaves the name order intact", async () => {
  for (const options of [{ geolocation: null }, { secure: false }]) {
    const h = harness(options);
    h.complete();
    await h.sort("distance");
    assert.equal(h.buttons()[0].dataset.placeKey, "a");
    assert.match(h.nodes["search-results-sort-help"].textContent, /기존 정렬을 유지/);
  }
});

test("switching sort while locating ignores the late position response", async () => {
  let resolve;
  const h = harness({ geolocation: { getCurrentPosition: (callback) => { resolve = callback; } } });
  h.complete();
  h.setPlans([{ places: [data[1]] }]);
  const pending = h.sort("distance");
  assert.equal(h.nodes["search-results-sort"].children[1].disabled, true);
  await h.sort("registered");
  resolve({ coords: { latitude: 37.51, longitude: 127.04 } });
  await pending;
  assert.equal(h.buttons()[0].dataset.placeKey, "b");
  assert.match(h.nodes["search-results-sort-help"].textContent, /여행 계획에 많이 포함/);
});

test("a new search invalidates an in-flight distance sort", async () => {
  let resolve;
  const h = harness({ geolocation: { getCurrentPosition: (callback) => { resolve = callback; } } });
  h.complete();
  const pending = h.sort("distance");
  h.send({ phase: "loading", loaded: 0, total: null });
  h.complete([data[0], data[1]]);
  resolve({ coords: { latitude: 37.48, longitude: 127.08 } });
  await pending;
  assert.deepEqual(h.buttons().map((button) => button.dataset.placeKey), ["a", "b"]);
  assert.equal(h.nodes["search-results-sort"].children[0].attributes["aria-pressed"], "true");
});

test("an unanswered location prompt times out and cannot later reorder the list", async () => {
  let resolve;
  const h = harness({ geolocation: { getCurrentPosition: (callback) => { resolve = callback; } } });
  h.complete();
  const pending = h.sort("distance");
  for (const callback of h.timers.values()) callback();
  await pending;
  assert.match(h.nodes["search-results-sort-help"].textContent, /시간이 초과/);
  resolve({ coords: { latitude: 37.51, longitude: 127.04 } });
  await Promise.resolve();
  assert.equal(h.buttons()[0].dataset.placeKey, "a");
});

test("registered sorting refreshes after same-tab plan changes and cross-tab deletion", async () => {
  const h = harness();
  h.complete();
  h.setPlans([{ places: [data[1]] }]);
  await h.sort("registered");
  assert.equal(h.buttons()[0].dataset.placeKey, "b");
  h.setPlans([{ places: [data[2]] }]);
  h.document.dispatchEvent({ type: "enjoytrip:plans-updated" });
  assert.equal(h.buttons()[0].dataset.placeKey, "c");
  h.setPlans([]);
  h.storage();
  assert.equal(h.buttons()[0].dataset.placeKey, "a");
});

test("unreadable plans show a message without switching the active sort", async () => {
  const h = harness();
  h.complete();
  await h.sort("distance");
  h.failPlans();
  await h.sort("registered");
  assert.equal(h.buttons()[0].dataset.placeKey, "c");
  assert.match(h.nodes["search-results-sort-help"].textContent, /등록 순을 적용하지 않았어요/);
  assert.equal(h.nodes["search-results-sort"].children[1].attributes["aria-pressed"], "true");
});
