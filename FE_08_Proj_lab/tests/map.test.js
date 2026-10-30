const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const source = ["js/common.js", "js/map.js"].map((file) => fs.readFileSync(path.join(root, file), "utf8")
  .replace(/^import .*;.*$/gm, "")
  .replace(/export const /g, "const ")).join("\n");

function createHarness({ geolocation, secure = true, respond } = {}) {
  const events = [];
  const requests = [];
  const updates = [];
  const timers = new Map();
  const elements = new Map();
  const ids = ["selectClass1", "selectClass2", "selectClass3", "selectSido", "selectGugun", "btn_trip_search", "btn_around_search", "btn_map_search", "search-feedback"];
  for (const id of ids) {
    elements.set(`#${id}`, {
      value: "", disabled: false, dataset: { type: id }, selectedOptions: [{ textContent: "축제/공연/행사" }],
      attributes: {}, handlers: {}, html: "",
      set innerHTML(value) { this.html = value; this.value = ""; },
      get innerHTML() { return this.html; },
      addEventListener(name, handler) { this.handlers[name] = handler; },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
    });
  }
  const map = {
    center: { getLat: () => 36.3, getLng: () => 127.4 },
    getCenter() { return this.center; },
    setCenter(center) { this.center = center; },
    setLevel(level) { this.level = level; },
  };
  const context = vm.createContext({
    DATA_GO_KR_API_KEY: "test-only", URLSearchParams, console,
    initPlanSortable: () => ({ cancel() {} }),
    window: { isSecureContext: secure }, navigator: { geolocation }, map,
    kakao: { maps: { LatLng: function (lat, lng) { this.getLat = () => lat; this.getLng = () => lng; } } },
    document: { querySelector: (id) => elements.get(id), dispatchEvent: (event) => events.push(event.detail) },
    CustomEvent: function (_, { detail }) { this.detail = detail; },
    setTimeout: (callback) => { const id = Symbol(); timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id),
    alert: (message) => assert.fail(`Unexpected alert: ${message}`),
    updateMap: async (spots) => updates.push(spots),
    fetch: async (url) => {
      const parsed = new URL(url);
      requests.push(parsed);
      return { json: async () => respond ? respond(parsed) : response([]) };
    },
  });
  // 브라우저에서는 전역 kakao와 window.kakao가 같은 SDK입니다.
  context.window.kakao = context.kakao;
  vm.runInContext(source, context);
  return {
    events, requests, updates, timers, elements, map,
    click: (id) => elements.get(`#${id}`).handlers.click(),
    change: (id, value) => { const select = elements.get(`#${id}`); select.value = value; return select.handlers.change(); },
    initialize: () => vm.runInContext("initEnjoyTrip()", context),
  };
}

function response(items, totalCount = items.length) {
  return { response: { header: { resultCode: "0000" }, body: { items: { item: items }, totalCount } } };
}

function assertButtonsReleased(harness) {
  for (const id of ["btn_trip_search", "btn_around_search", "btn_map_search"]) {
    const button = harness.elements.get(`#${id}`);
    assert.equal(button.disabled, false);
    assert.equal(button.attributes["aria-busy"], undefined);
  }
}

for (const [code, message] of [[1, "차단"], [2, "확인할 수 없어요"], [3, "시간이 초과"]]) {
  test(`geolocation error ${code} never searches an unrelated map center`, async () => {
    const harness = createHarness({ geolocation: { getCurrentPosition: (_, reject) => reject({ code }) } });
    await harness.click("btn_around_search");
    assert.equal(harness.requests.length, 0);
    assert.equal(harness.updates.length, 0);
    assert.match(harness.events.at(-1).notice, new RegExp(message));
    assert.equal(harness.events.at(-1).offerMapSearch, true);
    assertButtonsReleased(harness);
    // The fallback is allowed only after an explicit second button click.
    await harness.click("btn_map_search");
    assert.equal(harness.requests[0].searchParams.get("mapX"), "127.4");
    assert.equal(harness.requests[0].searchParams.get("mapY"), "36.3");
    assert.equal(harness.events.at(-1).scope, "지도 중심 반경 2km");
  });
}

test("missing geolocation and insecure origins explain why no request was made", async () => {
  for (const options of [{}, { secure: false }]) {
    const harness = createHarness(options);
    await harness.click("btn_around_search");
    assert.equal(harness.requests.length, 0);
    assert.equal(harness.events.at(-1).phase, "error");
    assertButtonsReleased(harness);
  }
});

test("an unanswered permission prompt times out and ignores late coordinates", async () => {
  let resolveLocation;
  const harness = createHarness({ geolocation: { getCurrentPosition: (resolve) => { resolveLocation = resolve; } } });
  const pending = harness.click("btn_around_search");
  assert.equal(harness.events.at(-1).phase, "locating");
  for (const callback of harness.timers.values()) callback();
  await pending;
  resolveLocation({ coords: { latitude: 37.4979, longitude: 127.0276 } });
  await Promise.resolve();
  assert.equal(harness.requests.length, 0);
  assertButtonsReleased(harness);
});

test("nearby search uses current coordinates, selected categories and every result page", async () => {
  const harness = createHarness({
    geolocation: { getCurrentPosition: (resolve) => resolve({ coords: { latitude: 37.4979, longitude: 127.0276 } }) },
    respond: (url) => {
      const start = url.searchParams.get("pageNo") === "1" ? 0 : 100;
      return response(Array.from({ length: start === 0 ? 100 : 1 }, (_, index) => ({ contentid: start + index, mapx: "127.0276", mapy: "37.4979", title: "장소" })), 101);
    },
  });
  harness.elements.get("#selectClass1").value = "EV";
  harness.elements.get("#selectSido").value = "11";
  await harness.click("btn_around_search");
  assert.equal(harness.requests.length, 2);
  for (const url of harness.requests) {
    assert.equal(url.searchParams.get("mapX"), "127.0276");
    assert.equal(url.searchParams.get("mapY"), "37.4979");
    assert.equal(url.searchParams.get("radius"), "2000");
    assert.equal(url.searchParams.get("lclsSystm1"), "EV");
    assert.equal(url.searchParams.has("lDongRegnCd"), false);
  }
  assert.equal(harness.updates[0].length, 101);
  assert.equal(harness.updates[0][0].x, "127.0276");
  assert.equal(harness.events.at(-1).spots.length, 101);
  assert.equal(harness.events.at(-1).scope, "내 위치 반경 2km");
  assert.match(harness.events.at(-1).notice, /축제\/공연\/행사/);
  assertButtonsReleased(harness);
});

test("zero results identify the actual search conditions and allow a new map search", async () => {
  const harness = createHarness({ geolocation: { getCurrentPosition: (resolve) => resolve({ coords: { latitude: 37.4979, longitude: 127.0276 } }) } });
  harness.elements.get("#selectClass1").value = "EV";
  await harness.click("btn_around_search");
  assert.equal(harness.updates[0].length, 0);
  assert.match(harness.events.at(-1).notice, /내 위치 반경 2km.*축제\/공연\/행사/);
  assert.equal(harness.events.at(-1).offerMapSearch, true);
  assert.equal(harness.map.level, 5);
});

test("clearing a parent clears descendants without fetching unfiltered child lists", async () => {
  const harness = createHarness();
  await harness.initialize();
  assert.match(harness.elements.get("#selectClass1").innerHTML, /전체/);
  assert.doesNotMatch(harness.elements.get("#selectClass1").innerHTML, /disabled/);
  harness.requests.length = 0;
  for (const [parent, children] of [["selectClass1", ["selectClass2", "selectClass3"]], ["selectClass2", ["selectClass3"]], ["selectSido", ["selectGugun"]]]) {
    for (const id of children) harness.elements.get(`#${id}`).value = "old-filter";
    await harness.change(parent, "");
    for (const id of children) {
      assert.equal(harness.elements.get(`#${id}`).value, "");
      assert.equal(harness.elements.get(`#${id}`).disabled, true);
    }
  }
  assert.equal(harness.requests.length, 0);
});

test("API errors release controls and are not reported as an empty search", async () => {
  const harness = createHarness({ respond: () => ({ response: { header: { resultCode: "10", resultMsg: "Invalid parameter" } } }) });
  await harness.click("btn_map_search");
  assert.equal(harness.events.at(-1).phase, "error");
  assert.equal(harness.updates.length, 0);
  assertButtonsReleased(harness);
});


test("area searches publish every result and keep the conditions captured before the response", async () => {
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  const harness = createHarness({ respond: () => waiting });
  const sido = harness.elements.get("#selectSido");
  const category = harness.elements.get("#selectClass1");
  sido.value = "11";
  sido.selectedOptions = [{ textContent: "서울특별시" }];
  category.value = "HS";
  category.selectedOptions = [{ textContent: "역사관광" }];
  const pending = harness.click("btn_trip_search");
  sido.selectedOptions = [{ textContent: "부산광역시" }];
  release(response([{ contentid: "123", title: "관광지", mapx: "127.1", mapy: "37.5", createdtime: "20261001000000" }]));
  await pending;
  const result = harness.events.at(-1);
  assert.equal(result.phase, "complete");
  assert.equal(result.filters, "서울특별시 · 역사관광");
  assert.equal(result.spots[0].contentid, "123");
  assert.equal(result.spots[0].createdtime, "20261001000000");
});

test("an empty area search updates the map and publishes a zero-result list without an alert", async () => {
  const harness = createHarness();
  await harness.click("btn_trip_search");
  assert.equal(harness.updates[0].length, 0);
  assert.equal(harness.events.at(-1).phase, "complete");
  assert.equal(harness.events.at(-1).spots.length, 0);
  assert.equal(harness.events.at(-1).filters, "전국 · 전체 분류");
});
