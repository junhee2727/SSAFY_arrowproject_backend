const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const source = fs.readFileSync(path.join(__dirname, "../js/kakao.js"), "utf8").replace(/^import .*;$/gm, "").replace(/export (const|let|function) /g, "$1 ");
function harness() {
  const markerInstances = [];
  const clusterBatches = [];
  const events = [];
  const geocodes = [];
  const sdk = {
    Map: function () { this.setBounds = () => {}; },
    LatLng: function (lat, lng) { this.lat = lat; this.lng = lng; },
    LatLngBounds: function () { this.extend = () => {}; },
    MarkerClusterer: function () { this.clear = () => {}; this.addMarkers = (markers) => clusterBatches.push([...markers]); },
    Marker: function (options) { this.options = options; this.setMap = (map) => { this.map = map; }; markerInstances.push(this); },
    MarkerImage: function (src, size, options) { this.src = src; this.size = size; this.options = options; },
    Size: function (width, height) { this.width = width; this.height = height; },
    Point: function (x, y) { this.x = x; this.y = y; },
    InfoWindow: function () { this.close = () => {}; },
    services: { Status: { OK: "OK" }, Geocoder: function () { this.addressSearch = (_, callback) => geocodes.push(callback); } },
    event: { addListener() {} },
  };
  const context = vm.createContext({
    KAKAO_MAP_KEY: "test-only", window: { kakao: { maps: sdk } }, kakao: { maps: sdk }, console,
    document: { getElementById: () => ({}), createElement: () => ({}), dispatchEvent: (event) => events.push(event) },
    CustomEvent: function (type, options) { this.type = type; this.detail = options.detail; },
  });
  vm.runInContext(source + '\ninitMap();', context);
  return { markerInstances, clusterBatches, events, geocodes, update: vm.runInContext("updateMap", context) };
}
const places = [{ title: "가", label: "가", x: 127, y: 37.5 }, { title: "나", label: "나", x: 127.1, y: 37.6 }, { title: "다", label: "다", x: 127.2, y: 37.7 }];

test("plan markers show the current visit numbers and normal searches resume clustering", async () => {
  const h = harness();
  await h.update(places, { numbered: true });
  assert.deepEqual(h.markerInstances.map((m) => m.options.title), ["1. 가", "2. 나", "3. 다"]);
  h.markerInstances.forEach((marker, i) => {
    assert.ok(marker.map);
    assert.equal(marker.options.image.size.width, 40);
    assert.match(decodeURIComponent(marker.options.image.src), new RegExp(`>${i + 1}</text>`));
  });
  assert.equal(h.clusterBatches.length, 0);
  const old = h.markerInstances.slice();
  await h.update([places[2], places[0], places[1]], { numbered: true });
  assert.ok(old.every((marker) => marker.map === null));
  assert.deepEqual(h.markerInstances.slice(-3).map((m) => m.options.title), ["1. 다", "2. 가", "3. 나"]);
  await h.update(places);
  assert.equal(h.clusterBatches.at(-1).length, 3);
  assert.ok(h.markerInstances.slice(-3).every((marker) => !marker.options.image));
  assert.equal(h.events.at(-1).detail.infos, places);
});

test("a slow old geocode cannot restore markers from an earlier plan order", async () => {
  const h = harness();
  const old = h.update([{ label: "old", address: "서울" }], { numbered: true });
  await h.update(places, { numbered: true });
  h.geocodes[0]([{ x: "127", y: "37.5" }], "OK");
  await old;
  assert.equal(h.markerInstances.length, 3);
  assert.equal(h.events.length, 1);
});
