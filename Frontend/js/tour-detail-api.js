const DETAIL_API_URL = "https://apis.data.go.kr/B551011/KorService2";

async function getDetailItems(service, params, signal) {
  const items = [];
  const seenPages = new Set();

  for (let pageNo = 1; ; pageNo += 1) {
    const query = new URLSearchParams({ ...params, numOfRows: 100, pageNo });
    const response = await fetch(`${DETAIL_API_URL}/${service}?${query}`, { signal });
    if (!response.ok) throw new Error("상세 정보 요청에 실패했습니다.");

    const json = await response.json();
    const { header, body } = json?.response || {};
    if (!body || !["0000", "00", "0"].includes(String(header?.resultCode))) {
      // 인증키가 포함될 수 있는 요청 URL이나 원본 오류는 화면/콘솔에 노출하지 않습니다.
      throw new Error("상세 정보 API 응답을 확인할 수 없습니다.");
    }

    const item = body.items?.item;
    const pageItems = Array.isArray(item) ? item : item && typeof item === "object" ? [item] : [];
    const total = Number(body.totalCount);
    const hasTotal = body.totalCount != null && body.totalCount !== "" && Number.isFinite(total) && total >= 0;
    if (!pageItems.length) {
      if (hasTotal && items.length < total) throw new Error("일부 상세 정보가 누락되었습니다.");
      break;
    }

    const signature = JSON.stringify(pageItems);
    if (seenPages.has(signature)) throw new Error("상세 정보 페이지가 반복되었습니다.");
    seenPages.add(signature);
    items.push(...pageItems);
    if (hasTotal && items.length >= total) break;
    if (!hasTotal && pageItems.length < 100) break;
  }

  return items;
}

export async function loadTourDetails({ contentId, contentTypeId, serviceKey, signal }) {
  if (!contentId) throw new Error("관광지 ID가 없습니다.");
  const params = { serviceKey, MobileOS: "WEB", MobileApp: "EnjoyTrip", _type: "json", contentId };
  const common = getDetailItems("detailCommon2", params, signal);
  // 검색 결과에 유형이 없으면 공통 정보의 유형으로 소개/반복 정보를 조회합니다.
  const type = contentTypeId ? Promise.resolve(contentTypeId) : common.then((items) => items[0]?.contenttypeid);
  const typedRequest = async (service) => {
    const resolvedType = await type;
    if (!resolvedType) return [];
    return getDetailItems(service, { ...params, contentTypeId: resolvedType }, signal);
  };

  const services = ["common", "intro", "info", "images"];
  const results = await Promise.allSettled([
    common,
    typedRequest("detailIntro2"),
    typedRequest("detailInfo2"),
    getDetailItems("detailImage2", { ...params, imageYN: "Y" }, signal),
  ]);
  if (signal?.aborted) throw new DOMException("조회가 취소되었습니다.", "AbortError");

  const detail = { common: {}, intro: {}, info: [], images: [], failed: [] };
  results.forEach((result, index) => {
    const name = services[index];
    if (result.status === "rejected") {
      detail.failed.push(name);
    } else {
      detail[name] = index < 2 ? result.value[0] || {} : result.value;
    }
  });
  return detail;
}
