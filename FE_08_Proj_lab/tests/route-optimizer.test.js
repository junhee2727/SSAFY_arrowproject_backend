const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/route-optimizer.js"), "utf8").replace(/export const /g, "const "), context);
const optimize = vm.runInContext("optimizeVisitOrder", context);
const distance = vm.runInContext("geographicDistance", context);
const move = vm.runInContext("moveVisitOrder", context);
const dropIndex = vm.runInContext("dropVisitIndex", context);
const places = (count) => Array.from({ length: count }, (_, i) => ({ contentid: String(i), x: 126 + ((i * 17) % 71) / 100, y: 36 + ((i * 31) % 83) / 100 }));
const length = (items) => items.slice(1).reduce((sum, item, i) => sum + distance({ lat: items[i].y, lng: items[i].x }, { lat: item.y, lng: item.x }), 0);
function brute(items) {
  let best = Infinity;
  const visit = (order, left) => {
    if (!left.length) { best = Math.min(best, length(order.map((i) => items[i]))); return; }
    const slot = order.length;
    for (const i of left) {
      if (items[slot].orderLocked ? i !== slot : items[i].orderLocked) continue;
      visit([...order, i], left.filter((index) => index !== i));
    }
  };
  visit([], items.map((_, i) => i));
  return best;
}

test("exact optimization matches exhaustive permutations for free endpoints and positional locks", () => {
  for (const locks of [[], [0], [6], [0, 6], [2, 4], [0, 1, 2, 3, 4, 5, 6]]) {
    const input = places(7).map((place, i) => ({ ...place, orderLocked: locks.includes(i) }));
    const before = JSON.stringify(input);
    const result = optimize(input);
    assert.ok(Math.abs(result.distance - brute(input)) < 1e-6);
    assert.equal(result.exact, true);
    for (const i of locks) assert.equal(result.order[i], i);
    assert.equal(JSON.stringify(input), before);
  }
});

test("16 remains exact; 17, 100 and 600 preserve every place and lock without making routes longer", () => {
  for (const count of [16, 17, 100, 600]) {
    const input = places(count).map((place, i) => ({ ...place, orderLocked: i === 0 || i === Math.floor(count / 2) || i === count - 1 }));
    const result = optimize(input);
    assert.equal(result.exact, count <= 16);
    assert.equal(result.order.length, count);
    assert.equal(new Set(result.order).size, count);
    assert.ok(result.order.every((i) => i >= 0 && i < count));
    assert.ok(result.distance <= result.originalDistance + 1e-6);
    input.forEach((p, i) => { if (p.orderLocked) assert.equal(result.order[i], i); });
  }
});

test("empty, singleton, duplicate coordinates and missing coordinates never drop a place", () => {
  assert.deepEqual(Array.from(optimize([]).order), []);
  assert.deepEqual(Array.from(optimize(places(1)).order), [0]);
  const repeated = Array.from({ length: 20 }, (_, i) => ({ contentid: i, x: 127, y: 37 }));
  assert.deepEqual(Array.from(optimize(repeated).order), repeated.map((_, i) => i));
  for (const invalid of [{ x: "", y: 37 }, { x: 127, y: undefined }, { x: "wrong", y: 37 }, { x: 181, y: 37 }]) {
    assert.throws(() => optimize([...places(3), invalid]), /INVALID_COORDINATES/);
  }
});

test("the drop midpoint and actual drop location choose before/after and list boundaries", () => {
  const rects = [0, 1, 2, 3].map((i) => ({ top: i * 64, height: 56 }));
  assert.equal(dropIndex(rects, 0, 70), 0);
  assert.equal(dropIndex(rects, 0, 100), 1);
  assert.equal(dropIndex(rects, 0, 500), 3);
  assert.equal(dropIndex(rects, 3, -10), 0);
  assert.deepEqual(Array.from(move(places(4), 0, 2)), [1, 2, 0, 3]);
  assert.deepEqual(Array.from(move(places(4), 3, 0)), [3, 0, 1, 2]);
});

test("manual movement keeps locked slots and forbids dropping onto a locked slot", () => {
  const input = places(5);
  input[2].orderLocked = true;
  assert.deepEqual(Array.from(move(input, 0, 4)), [1, 3, 2, 4, 0]);
  assert.throws(() => move(input, 2, 4), /LOCKED_ORDER/);
  assert.throws(() => move(input, 0, 2), /LOCKED_ORDER/);
  assert.throws(() => move(input, 0, 9), /INVALID_ORDER/);
});
