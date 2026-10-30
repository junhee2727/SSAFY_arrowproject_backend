import { placeCoordinates } from "./route-optimizer.js";

// Directions API의 경유지 5개 제한을 지키며 인접 요청의 끝/시작을 공유합니다.
export const fetchCarRoute = async (places, { apiKey = "", signal, fetchImpl = fetch } = {}) => {
  const coordinates = places.map(placeCoordinates);
  const path = [];
  let fallback = false;
  let canRequest = Boolean(apiKey.trim());
  for (let start = 0; start < coordinates.length - 1; start += 6) {
    if (signal?.aborted) throw new Error("ROUTE_CANCELLED");
    const chunk = coordinates.slice(start, start + 7);
    let sectionPath = null;
    if (canRequest) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 10000);
      try {
        const point = (value) => `${value.lng},${value.lat}`;
        const query = new URLSearchParams({ origin: point(chunk[0]), destination: point(chunk.at(-1)), priority: "DISTANCE" });
        if (chunk.length > 2) query.set("waypoints", chunk.slice(1, -1).map(point).join("|"));
        const response = await fetchImpl(`https://apis-navi.kakaomobility.com/v1/directions?${query}`, {
          headers: { Authorization: `KakaoAK ${apiKey.trim()}` }, signal: controller.signal,
        });
        if ([401, 403, 429].includes(response.status)) canRequest = false;
        if (response.ok) {
          const route = (await response.json()).routes?.[0];
          if (route?.result_code === 0 && route.sections?.length === chunk.length - 1) {
            const vertices = [];
            const complete = route.sections.every((section) => {
              const points = (section.roads || []).flatMap((road) => road.vertexes || []);
              if (!points.length || points.length % 2 || !points.every(Number.isFinite)) return false;
              for (let index = 0; index < points.length; index += 2) vertices.push({ lng: points[index], lat: points[index + 1] });
              return true;
            });
            if (complete) sectionPath = vertices;
          }
        }
      } catch {
        // 응답이 없거나 불완전하면 해당 구간의 모든 방문지를 직선으로 연결합니다.
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
      }
    }
    if (signal?.aborted) throw new Error("ROUTE_CANCELLED");
    if (!sectionPath) { sectionPath = chunk; fallback = true; }
    // 공유 경계 지점만 합치고, 떨어져 있는 방문지는 생략하지 않습니다.
    for (const point of sectionPath) {
      const last = path.at(-1);
      if (!last || last.lat !== point.lat || last.lng !== point.lng) path.push(point);
    }
  }
  return { path, fallback };
};
