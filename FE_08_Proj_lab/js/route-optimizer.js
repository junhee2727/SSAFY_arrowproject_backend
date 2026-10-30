// 순서 잠금은 현재 배열 위치를 고정합니다. 복귀하지 않는 편도 방문 경로입니다.
export const EXACT_ROUTE_LIMIT = 16;

export const placeCoordinates = (place) => {
  const x = place?.x ?? place?.mapx;
  const y = place?.y ?? place?.mapy;
  if (x == null || y == null || String(x).trim() === "" || String(y).trim() === "") throw new Error("INVALID_COORDINATES");
  const lng = Number(x);
  const lat = Number(y);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) throw new Error("INVALID_COORDINATES");
  return { lat, lng };
};

export const geographicDistance = (a, b) => {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
};

export const placesSignature = (places) => JSON.stringify(places.map((place) => [
  String(place.contentid ?? ""), String(place.title || place.label || ""),
  Number(place.x ?? place.mapx), Number(place.y ?? place.mapy), place.orderLocked === true,
]));

export const moveVisitOrder = (places, from, to) => {
  const order = places.map((_, index) => index);
  if (![from, to].every((index) => Number.isInteger(index) && index >= 0 && index < places.length)) throw new Error("INVALID_ORDER");
  if (places[from].orderLocked || places[to].orderLocked) throw new Error("LOCKED_ORDER");
  const slots = order.filter((index) => !places[index].orderLocked);
  const values = [...slots];
  const [moved] = values.splice(slots.indexOf(from), 1);
  values.splice(slots.indexOf(to), 0, moved);
  slots.forEach((slot, index) => { order[slot] = values[index]; });
  return order;
};

export const dropVisitIndex = (rects, from, clientY) => rects
  .filter((_, index) => index !== from)
  .filter((rect) => clientY >= rect.top + rect.height / 2).length;

function exactOrder(count, locked, distance) {
  const states = 1 << count;
  const costs = new Float64Array(states * count).fill(Infinity);
  const previous = new Int8Array(states * count).fill(-1);
  const sizes = new Uint8Array(states);
  const lockMask = locked.reduce((mask, value, index) => value ? mask | (1 << index) : mask, 0);
  const freeMask = (states - 1) ^ lockMask;
  const allowed = (position) => locked[position] ? 1 << position : freeMask;
  for (let index = 0; index < count; index += 1) {
    if (allowed(0) & (1 << index)) costs[(1 << index) * count + index] = 0;
  }
  for (let mask = 1; mask < states; mask += 1) {
    sizes[mask] = sizes[mask >> 1] + (mask & 1);
    const position = sizes[mask];
    if (position === count) continue;
    const candidates = allowed(position) & ~mask;
    for (let end = 0; end < count; end += 1) {
      const cost = costs[mask * count + end];
      if (!Number.isFinite(cost)) continue;
      for (let bits = candidates; bits; bits &= bits - 1) {
        const bit = bits & -bits;
        const next = 31 - Math.clz32(bit);
        const target = (mask | bit) * count + next;
        const nextCost = cost + distance(end, next);
        if (nextCost < costs[target]) {
          costs[target] = nextCost;
          previous[target] = end;
        }
      }
    }
  }
  let mask = states - 1;
  let end = 0;
  for (let index = 1; index < count; index += 1) {
    if (costs[mask * count + index] < costs[mask * count + end]) end = index;
  }
  const order = [];
  while (mask) {
    order.push(end);
    const prior = previous[mask * count + end];
    mask ^= 1 << end;
    end = prior;
  }
  return order.reverse();
}

function approximateOrder(count, locked, distance, total) {
  const original = Array.from({ length: count }, (_, index) => index);
  let best = original;
  let bestDistance = total(best);
  const free = original.filter((index) => !locked[index]);
  // 큰 계획에서도 전체 장소를 유지하고, 개선 탐색 횟수만 제한합니다.
  const starts = locked[0] ? [0] : free.filter((_, index) => index % Math.max(1, Math.floor(free.length / 4)) === 0).slice(0, 4);
  for (const start of starts) {
    const remaining = new Set(free);
    const order = [];
    for (let position = 0; position < count; position += 1) {
      let next = locked[position] ? position : position === 0 ? start : -1;
      if (next < 0) {
        let nearest = Infinity;
        for (const candidate of remaining) {
          const cost = distance(order[position - 1], candidate) + (locked[position + 1] ? distance(candidate, position + 1) : 0);
          if (cost < nearest) { nearest = cost; next = candidate; }
        }
      }
      order.push(next);
      remaining.delete(next);
    }
    const value = total(order);
    if (value < bestDistance) { best = order; bestDistance = value; }
  }
  best = [...best];
  let budget = 2000000;
  const lockPrefix = [0];
  locked.forEach((value, index) => lockPrefix.push(lockPrefix[index] + Number(value)));
  for (let pass = 0; pass < 12 && budget > 0; pass += 1) {
    let improved = false;
    for (let left = 0; left < count - 1 && budget > 0; left += 1) {
      if (locked[left]) continue;
      for (let right = left + 1; right < count && budget > 0; right += 1) {
        if (locked[right]) continue;
        budget -= 1;
        const edge = (a, b) => a == null || b == null ? 0 : distance(a, b);
        if (lockPrefix[right + 1] === lockPrefix[left]) {
          const delta = edge(best[left - 1], best[right]) + edge(best[left], best[right + 1])
            - edge(best[left - 1], best[left]) - edge(best[right], best[right + 1]);
          if (delta < -1e-7) {
            for (let a = left, b = right; a < b; a += 1, b -= 1) [best[a], best[b]] = [best[b], best[a]];
            improved = true;
            continue;
          }
        }
        // 고정된 중간 장소를 건너서도 잠금 없는 두 위치를 교환할 수 있습니다.
        const affected = [...new Set([left - 1, left, right - 1, right])].filter((index) => index >= 0 && index < count - 1);
        const before = affected.reduce((sum, index) => sum + distance(best[index], best[index + 1]), 0);
        const at = (index) => best[index === left ? right : index === right ? left : index];
        const after = affected.reduce((sum, index) => sum + distance(at(index), at(index + 1)), 0);
        if (after < before - 1e-7) { [best[left], best[right]] = [best[right], best[left]]; improved = true; }
      }
    }
    if (!improved) break;
  }
  return best;
}

export const optimizeVisitOrder = (places) => {
  const coords = places.map(placeCoordinates); // 잘못된 좌표는 제외하지 않고 전체 계산을 중단합니다.
  const count = places.length;
  const original = places.map((_, index) => index);
  if (count < 2) return { order: original, exact: true, distance: 0, originalDistance: 0 };
  const locked = places.map((place) => place.orderLocked === true);
  // 큰 계획은 행렬을 메모리에 쌓지 않고 필요할 때 좌표 거리를 계산합니다.
  const matrix = count <= 512 ? new Float64Array(count * count) : null;
  if (matrix) for (let i = 0; i < count; i += 1) for (let j = i + 1; j < count; j += 1) matrix[i * count + j] = matrix[j * count + i] = geographicDistance(coords[i], coords[j]);
  const distance = (i, j) => matrix ? matrix[i * count + j] : geographicDistance(coords[i], coords[j]);
  const total = (order) => order.reduce((sum, value, index) => sum + (index ? distance(order[index - 1], value) : 0), 0);
  const originalDistance = total(original);
  const exact = count <= EXACT_ROUTE_LIMIT;
  let order = exact ? exactOrder(count, locked, distance) : approximateOrder(count, locked, distance, total);
  if (total(order) >= originalDistance - 1e-7) order = original;
  return { order, exact, distance: total(order), originalDistance };
};
