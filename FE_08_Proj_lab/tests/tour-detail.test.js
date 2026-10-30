const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const apiSource = fs.readFileSync(path.join(root, "js/tour-detail-api.js"), "utf8").replace("export async function", "async function");
const controllerSource = fs.readFileSync(path.join(root, "js/tour-detail.js"), "utf8")
  .replace(/^import .*;$/gm, "")
  .replace(/import\.meta\.url/g, '"http://localhost:5500/js/tour-detail.js"');
const emptyDetail = () => ({ common: {}, intro: {}, info: [], images: [], failed: [] });

function response(items = [], totalCount = Array.isArray(items) ? items.length : 1, code = "0000") {
  return { ok: true, json: async () => ({ response: { header: { resultCode: code }, body: { items: { item: items }, totalCount } } }) };
}

function apiHarness(respond) {
  const calls = [];
  const context = vm.createContext({
    URLSearchParams, DOMException,
    fetch: async (url, options) => {
      const parsed = new URL(url);
      calls.push({ service: parsed.pathname.split("/").pop(), params: parsed.searchParams, signal: options.signal });
      return respond(calls.at(-1));
    },
  });
  vm.runInContext(apiSource, context);
  return { calls, load: (options = {}) => context.loadTourDetails({ contentId: "126128", contentTypeId: "12", serviceKey: "test-key", ...options }) };
}

test("detail requests use the required IDs, normalize single items and include imageYN", async () => {
  const harness = apiHarness(({ service }) => response(service === "detailCommon2" ? { title: "공원" } : []));
  const detail = await harness.load();
  assert.equal(detail.common.title, "공원");
  assert.equal(harness.calls.length, 4);
  for (const { service, params } of harness.calls) {
    assert.equal(params.get("contentId"), "126128");
    assert.equal(params.get("MobileOS"), "WEB");
    assert.equal(params.get("_type"), "json");
    assert.equal(params.get("contentTypeId"), ["detailIntro2", "detailInfo2"].includes(service) ? "12" : null);
    if (service === "detailImage2") assert.equal(params.get("imageYN"), "Y");
  }
});

test("repeated information and photos retrieve every page", async () => {
  const harness = apiHarness(({ service, params }) => {
    if (!["detailInfo2", "detailImage2"].includes(service)) return response();
    const page = Number(params.get("pageNo"));
    return response(Array.from({ length: page === 1 ? 100 : 1 }, (_, index) => ({ serialnum: (page - 1) * 100 + index })), 101);
  });
  const detail = await harness.load();
  assert.equal(detail.info.length, 101);
  assert.equal(detail.images.length, 101);
  assert.equal(harness.calls.length, 6);
});

test("empty API data is successful, while API/HTTP/non-JSON failures preserve other data", async () => {
  const empty = await apiHarness(() => response("", 0)).load();
  assert.equal(empty.failed.length, 0);
  assert.equal(empty.images.length, 0);
  for (const failure of [response([], 0, "10"), { ok: false }, { ok: true, json: async () => { throw new Error("not JSON"); } }]) {
    const detail = await apiHarness(({ service }) => service === "detailInfo2" ? failure : response({ title: "남은 정보" })).load();
    assert.equal(detail.common.title, "남은 정보");
    assert.deepEqual(Array.from(detail.failed), ["info"]);
  }
});

test("missing or repeated pages are reported instead of silently truncating", async () => {
  for (const nextItems of [[], [{ serialnum: "same" }]]) {
    const harness = apiHarness(({ service, params }) => service === "detailInfo2"
      ? response(params.get("pageNo") === "1" ? [{ serialnum: "same" }] : nextItems, 2)
      : response());
    assert.deepEqual(Array.from((await harness.load()).failed), ["info"]);
  }
});

test("missing type is resolved from common data and aborted requests are discarded", async () => {
  const harness = apiHarness(() => response({ contenttypeid: "32" }));
  await harness.load({ contentTypeId: undefined });
  assert.equal(harness.calls.find((call) => call.service === "detailIntro2").params.get("contentTypeId"), "32");
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(harness.load({ signal: controller.signal }), { name: "AbortError" });
});

// Lightweight DOM double for selection/cancellation and image fallback behavior.
class Element {
  constructor() {
    this.children = [];
    this.handlers = {};
    this.attributes = {};
    this.textContent = "";
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  querySelector() { return new Element(); }
  focus() {}
  scrollTo() {}
}

function uiHarness(load, addPlaceToPlan, getTravelPlans = () => []) {
  const nodes = new Map();
  const timers = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  const context = vm.createContext({
    DATA_GO_KR_API_KEY: "test-key", URL, AbortController, loadTourDetails: load, addPlaceToPlan, getTravelPlans,
    window: { bootstrap: { Offcanvas: { getOrCreateInstance: () => ({ show() {} }) } } },
    setTimeout: (fn) => { const id = Symbol(); timers.set(id, fn); return id; },
    clearTimeout: (id) => timers.delete(id),
    document: {
      getElementById: node, querySelector: node, addEventListener() {},
      createElement: (tag) => {
        const element = new Element();
        if (tag === "template") {
          element.content = { textContent: "", querySelector: () => null, querySelectorAll: () => [] };
          Object.defineProperty(element, "innerHTML", { set(value) { element.content.textContent = value; } });
        }
        return element;
      },
    },
  });
  vm.runInContext(controllerSource, context);
  return { node, context, timers, show: (info) => context.showPlace(info) };
}

test("the plan picker requires an explicit destination and adds each displayed place to that plan", async () => {
  const selected = [];
  let result = { added: true, planTitle: "주말 여행" };
  const harness = uiHarness(async () => emptyDetail(), (planId, place) => {
    selected.push({ planId, place });
    if (result instanceof Error) throw result;
    return result;
  }, () => [{ id: "a", title: "봄 여행", date: "2026-10-10" }, { id: "b", title: "주말 여행", date: "2026-10-17" }]);
  await harness.show({ contentid: "123", title: "첫 장소" });
  const open = harness.node("btn_add_to_route").handlers.click;
  const picker = harness.node("tour-plan-picker");
  const select = harness.node("tour-plan-select");
  const submit = () => picker.handlers.submit({ preventDefault() {} });
  const status = harness.node("tour-detail-plan-status");
  open();
  assert.equal(picker.hidden, false);
  assert.equal(selected.length, 0);
  assert.equal(select.children[2].textContent, "주말 여행 · 2026-10-17");
  submit();
  assert.equal(selected.length, 0);
  assert.match(status.textContent, /여행 계획을 선택/);
  select.value = "b";
  submit();
  assert.equal(selected.at(-1).place.contentid, "123");
  assert.equal(selected.at(-1).planId, "b");
  assert.equal(picker.hidden, true);
  assert.match(status.textContent, /주말 여행.*추가했어요/);

  await harness.show({ contentid: "456", title: "두 번째 장소" });
  open();
  select.value = "b";
  submit();
  assert.equal(selected.at(-1).place.contentid, "456");
  result = { added: false, planTitle: "주말 여행" };
  open();
  select.value = "b";
  submit();
  assert.match(status.textContent, /이미.*포함된/);
  result = new Error("PLAN_NOT_FOUND");
  open();
  select.value = "b";
  submit();
  assert.match(status.textContent, /선택한 계획을 찾을 수 없어요/);
  assert.equal(picker.hidden, false);
});

test("canceling or changing places discards a pending choice without saving", async () => {
  let writes = 0;
  const harness = uiHarness(async () => emptyDetail(), () => { writes += 1; }, () => [{ id: "a", title: "계획" }]);
  await harness.show({ contentid: "123", title: "첫 장소" });
  const open = harness.node("btn_add_to_route").handlers.click;
  const picker = harness.node("tour-plan-picker");
  open();
  harness.node("tour-plan-cancel").handlers.click();
  assert.equal(picker.hidden, true);
  open();
  harness.node("tour-plan-select").value = "a";
  await harness.show({ contentid: "789", title: "새 장소" });
  assert.equal(picker.hidden, true);
  picker.handlers.submit({ preventDefault() {} });
  assert.equal(writes, 0);
});

test("no saved plans gives creation guidance and never opens an empty picker", async () => {
  const harness = uiHarness(async () => emptyDetail());
  await harness.show({ contentid: "123", title: "장소" });
  harness.node("btn_add_to_route").handlers.click();
  assert.equal(harness.node("tour-plan-picker").hidden, true);
  assert.match(harness.node("tour-detail-plan-status").textContent, /새 계획을 먼저 만들어/);
});

test("missing images and failed image loads use the requested placeholder without retry loops", () => {
  const harness = uiHarness();
  for (const source of ["", "https://example.com/missing.jpg", "javascript:alert(1)"]) {
    const image = new Element();
    harness.context.setImage(image, source, "사진");
    if (source.startsWith("https")) image.onerror();
    assert.equal(image.src, "http://localhost:5500/resources/img/placeholder.png");
    if (image.onerror) image.onerror();
    assert.equal(image.onerror, null);
  }
});

test("a slow old selection cannot overwrite the most recently clicked marker", async () => {
  const requests = [];
  const harness = uiHarness((options) => new Promise((resolve) => requests.push({ ...options, resolve })));
  const old = harness.show({ contentid: "1", contenttypeid: "12", title: "첫 장소" });
  const latest = harness.show({ contentid: "2", contenttypeid: "12", title: "둘째 장소" });
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve({ ...emptyDetail(), common: { title: "둘째 상세" } });
  await latest;
  requests[0].resolve({ ...emptyDetail(), common: { title: "이전 상세" } });
  await old;
  assert.equal(harness.node("tour-detail-title").textContent, "둘째 상세");
  assert.equal(harness.node("tour-detail-content").attributes["aria-busy"], "false");
});

test("closing the panel aborts pending data and ID-less markers do not request an API", async () => {
  let resolve;
  let signal;
  const harness = uiHarness((options) => { signal = options.signal; return new Promise((done) => { resolve = done; }); });
  const pending = harness.show({ contentid: "1", title: "선택한 장소" });
  harness.node("tour-detail-modal").handlers["hide.bs.offcanvas"]();
  assert.equal(signal.aborted, true);
  resolve({ ...emptyDetail(), common: { title: "닫은 뒤 도착" } });
  await pending;
  assert.equal(harness.node("tour-detail-title").textContent, "선택한 장소");
  const noId = uiHarness(() => assert.fail("ID-less markers must not request details"));
  await noId.show({ label: "서울캠퍼스" });
  assert.match(noId.node("tour-detail-message").textContent, /관광지 조회/);
});

test("failed requests clear loading and expose retry; retry replaces the error with data", async () => {
  let attempts = 0;
  const harness = uiHarness(async () => {
    if (++attempts === 1) throw new Error("network failure");
    return { ...emptyDetail(), common: { title: "다시 불러온 장소" } };
  });
  await harness.show({ contentid: "1", title: "장소" });
  assert.equal(harness.node("tour-detail-retry").hidden, false);
  assert.equal(harness.node("tour-detail-content").attributes["aria-busy"], "false");
  await harness.node("tour-detail-retry").handlers.click();
  assert.equal(harness.node("tour-detail-title").textContent, "다시 불러온 장소");
  assert.equal(harness.node("tour-detail-status").hidden, true);
});

test("lodging and course information render their type-specific fields", () => {
  const harness = uiHarness();
  harness.context.renderExtra([{ roomtitle: "트윈", roomintro: "객실 소개", roombasecount: "2" }], "32");
  assert.equal(harness.node("tour-extra-title").textContent, "객실 정보");
  assert.match(harness.node("tour-detail-extra-content").children[0].children[1].textContent, /기준 2명/);
  harness.context.renderExtra([{ subname: "첫 코스", subdetailoverview: "산책길" }], "25");
  assert.equal(harness.node("tour-extra-title").textContent, "코스 정보");
  assert.equal(harness.node("tour-detail-extra-content").children[0].children[0].textContent, "첫 코스");
});
