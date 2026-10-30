import { map, updateMap, focusMapPlace } from "./kakao.js";
import { getCurrentPosition, getTravelPlans } from "./map.js";

const nameOf = (place) => String(place.title || place.label || "이름 없는 관광지");
const addressOf = (place) => [place.addr1 || place.address, place.addr2].filter(Boolean).join(" ") || "주소 정보가 없습니다";
const keyOf = (place) => place.contentid != null && String(place.contentid) !== ""
  ? String(place.contentid)
  : `${nameOf(place).trim()}|${Number(place.x ?? place.mapx)}|${Number(place.y ?? place.mapy)}`;

function distanceFrom(place, origin) {
  const lat = Number(place.y || place.mapy);
  const lng = Number(place.x || place.mapx);
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng) ||
      !(33 <= lat && lat <= 38.6 && 124.5 <= lng && lng <= 132)) return Infinity;
  const radians = (value) => value * Math.PI / 180;
  const halfLat = Math.sin(radians(lat - origin.lat) / 2);
  const halfLng = Math.sin(radians(lng - origin.lng) / 2);
  const a = halfLat ** 2 + Math.cos(radians(origin.lat)) * Math.cos(radians(lat)) * halfLng ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

// 등록 수는 관광지가 포함된 계획 수이며, 한 계획 안의 중복은 한 번만 집계합니다.
export const sortSearchResults = (places, sort = "name", origin = null, plans = []) => {
  const registrations = new Map();
  if (sort === "registered") {
    for (const plan of plans) {
      const savedPlaces = Array.isArray(plan?.places) ? plan.places : [];
      const keys = new Set(savedPlaces.filter((place) => place && typeof place === "object").map(keyOf));
      for (const key of keys) registrations.set(key, (registrations.get(key) || 0) + 1);
    }
  }
  return places.map((place) => ({ place, distance: distanceFrom(place, origin), registered: registrations.get(keyOf(place)) || 0 }))
    .sort((a, b) => {
      const difference = sort === "distance" ? a.distance - b.distance
        : sort === "registered" ? b.registered - a.registered : 0;
      return difference || nameOf(a.place).localeCompare(nameOf(b.place), "ko", { numeric: true });
    }).map(({ place }) => place);
};

export const initSearchResults = () => {
  const panel = document.getElementById("tab-results");
  if (!panel || panel.dataset.initialized) return;
  panel.dataset.initialized = "true";
  const tab = document.getElementById("tab-results-btn");
  const summary = document.getElementById("search-results-summary");
  const filters = document.getElementById("search-results-filters");
  const body = document.getElementById("search-results-body");
  const list = document.getElementById("search-results-list");
  const empty = document.getElementById("search-results-empty");
  const hint = document.getElementById("search-results-hint");
  const sortHelp = document.getElementById("search-results-sort-help");
  const sortGroup = document.getElementById("search-results-sort");
  const sortButtons = [...sortGroup.querySelectorAll("[data-sort]")];
  let places = null;
  let origin = null;
  let plans = [];
  let sortRequestVersion = 0;
  const distanceButton = sortButtons.find((button) => button.dataset.sort === "distance");
  let sort = "name";
  let selectedKey = "";
  let loading = false;
  let mapShowsResults = false;
  let selectionVersion = 0;

  const showResultsTab = () => window.bootstrap.Tab.getOrCreateInstance(tab).show();

  function setLocating(locating) {
    distanceButton.disabled = locating;
    distanceButton.setAttribute("aria-busy", String(locating));
  }

  function cancelDistanceSort() {
    sortRequestVersion += 1;
    setLocating(false);
  }

  function showSortMessage(message) {
    sortHelp.textContent = message;
    sortHelp.hidden = false;
  }

  function updateSelection(scroll = false) {
    for (const button of list.querySelectorAll(".search-result-item")) {
      const selected = button.dataset.placeKey === selectedKey;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      if (selected && scroll && panel.classList.contains("active")) button.scrollIntoView({ block: "nearest" });
    }
  }

  async function restoreResultsMap() {
    if (places === null || loading || mapShowsResults || !map) return;
    await updateMap(places);
  }

  function renderList() {
    const sorted = sortSearchResults(places || [], sort, origin, plans);
    const fragment = document.createDocumentFragment();
    for (const place of sorted) {
      const item = document.createElement("li");
      item.className = "list-group-item p-0 border-0";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn search-result-item d-flex align-items-center gap-2 w-100 text-start";
      button.dataset.placeKey = keyOf(place);
      button.setAttribute("aria-controls", "tour-detail-modal");
      const text = document.createElement("span");
      text.className = "search-result-text d-flex flex-column flex-grow-1";
      const title = document.createElement("span");
      title.className = "search-result-name text-truncate";
      title.textContent = nameOf(place);
      title.title = title.textContent;
      const address = document.createElement("span");
      address.className = "search-result-address text-truncate";
      address.textContent = addressOf(place);
      address.title = address.textContent;
      const chevron = document.createElement("img");
      chevron.src = "../resources/icons/search-result-chevron.svg";
      chevron.width = 16;
      chevron.height = 16;
      chevron.alt = "";
      chevron.className = "flex-shrink-0";
      text.append(title, address);
      button.append(text, chevron);
      button.addEventListener("click", async () => {
        const version = ++selectionVersion;
        try {
          await restoreResultsMap();
          if (version !== selectionVersion || loading) return;
          focusMapPlace(place);
          document.dispatchEvent(new CustomEvent("enjoytrip:place-selected", { detail: place }));
        } catch {
          summary.textContent = "지도 표시를 갱신하지 못했어요. 장소를 다시 선택해주세요.";
        }
      });
      item.append(button);
      fragment.append(item);
    }
    list.replaceChildren(fragment);
    empty.hidden = sorted.length > 0;
    sortGroup.hidden = sorted.length === 0;
    hint.hidden = sorted.length === 0;
    for (const button of sortButtons) button.setAttribute("aria-pressed", String(button.dataset.sort === sort));
    sortHelp.hidden = sorted.length === 0 || (sort === "name" && !distanceButton.disabled);
    sortHelp.textContent = distanceButton.disabled ? "현재 위치를 확인하고 있어요. 위치 권한을 허용해주세요."
      : sort === "distance" ? "내 위치 기준 직선거리 순이에요. 위치 정보가 없는 장소는 마지막에 표시해요."
      : "이 브라우저에 저장된 여행 계획에 많이 포함된 순서예요. 같은 계획에서는 한 번만 집계해요.";
    updateSelection();
  }

  for (const button of sortButtons) {
    button.addEventListener("click", async () => {
      if (loading || !places?.length) return;
      cancelDistanceSort();
      const version = sortRequestVersion;
      const requestedSort = button.dataset.sort;
      if (requestedSort !== "distance") {
        try {
          if (requestedSort === "registered") plans = getTravelPlans();
          sort = requestedSort;
          renderList();
        } catch {
          showSortMessage("여행 계획을 불러오지 못해 등록 순을 적용하지 않았어요. 브라우저 저장 공간과 계획 데이터를 확인해주세요.");
        }
        return;
      }

      setLocating(true);
      showSortMessage("현재 위치를 확인하고 있어요. 위치 권한을 허용해주세요.");
      try {
        const { coords } = await getCurrentPosition({ maximumAge: 0 });
        if (version !== sortRequestVersion || loading) return;
        if (!Number.isFinite(coords?.latitude) || !Number.isFinite(coords?.longitude) ||
            Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
          throw new Error("현재 위치의 좌표를 확인할 수 없어요. 다시 시도해주세요.");
        }
        origin = { lat: coords.latitude, lng: coords.longitude };
        sort = "distance";
        setLocating(false);
        renderList();
      } catch (error) {
        if (version !== sortRequestVersion) return;
        showSortMessage(`${error.message || "현재 위치를 확인하지 못했어요."} 기존 정렬을 유지했어요.`);
      } finally {
        if (version === sortRequestVersion) setLocating(false);
      }
    });
  }

  function refreshRegisteredSort() {
    if (sort !== "registered" || loading || !places?.length) return;
    try {
      plans = getTravelPlans();
      renderList();
    } catch {
      showSortMessage("여행 계획 변경을 확인하지 못했어요. 등록 순을 다시 눌러주세요.");
    }
  }

  document.addEventListener("enjoytrip:plans-updated", refreshRegisteredSort);
  window.addEventListener("storage", (event) => {
    if (event.key === "myTripPlans" || event.key === null) refreshRegisteredSort();
  });

  document.addEventListener("enjoytrip:search-state", ({ detail }) => {
    loading = detail.phase === "loading" || detail.phase === "locating";
    body.setAttribute("aria-busy", String(loading));
    if (loading) {
      if (detail.phase === "locating" || detail.loaded === 0) {
        cancelDistanceSort();
        places = null;
        selectedKey = "";
        selectionVersion += 1;
        filters.hidden = true;
        renderList();
      }
      summary.textContent = detail.phase === "locating" ? "현재 위치를 확인하고 있어요" : "관광지를 불러오고 있어요";
      empty.textContent = detail.phase === "locating" ? "위치 권한을 허용하면 주변 관광지를 찾아드려요."
        : detail.total == null ? `현재 ${(detail.loaded || 0).toLocaleString()}곳을 불러왔어요.`
        : `${detail.total.toLocaleString()}곳 중 ${(detail.loaded || 0).toLocaleString()}곳을 불러왔어요.`;
    } else if (detail.phase === "complete" && Array.isArray(detail.spots)) {
      cancelDistanceSort();
      places = detail.spots;
      origin = null;
      sort = "name";
      selectedKey = "";
      mapShowsResults = true;
      summary.textContent = `총 ${places.length.toLocaleString()}곳의 관광지를 찾았어요`;
      filters.textContent = detail.filters || "전체 관광지";
      filters.hidden = false;
      empty.textContent = "검색된 관광지가 없어요. 지역이나 분류를 바꾸어 다시 검색해주세요.";
      renderList();
      showResultsTab();
    } else if (detail.phase === "error") {
      cancelDistanceSort();
      places = null;
      selectedKey = "";
      filters.hidden = true;
      summary.textContent = detail.message || "검색 결과를 불러오지 못했어요";
      empty.textContent = detail.notice || "검색 탭에서 다시 검색해주세요.";
      renderList();
      showResultsTab();
    }
  });

  document.addEventListener("enjoytrip:map-updated", ({ detail }) => {
    mapShowsResults = detail.infos === places;
  });
  document.addEventListener("enjoytrip:place-selected", ({ detail }) => {
    selectedKey = detail ? keyOf(detail) : "";
    updateSelection(true);
  });
  document.getElementById("tour-detail-modal")?.addEventListener("hidden.bs.offcanvas", () => {
    selectedKey = "";
    updateSelection();
  });
  for (const id of ["tab-results-btn", "tab-search-btn"]) {
    document.getElementById(id)?.addEventListener("shown.bs.tab", () => {
      refreshRegisteredSort();
      restoreResultsMap().catch(() => {
        summary.textContent = "검색 결과 지도를 표시하지 못했어요. 다시 검색해주세요.";
      });
    });
  }
};
