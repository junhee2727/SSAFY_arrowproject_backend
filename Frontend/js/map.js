import { DATA_GO_KR_API_KEY, KAKAO_REST_API_KEY } from "./keys.js";
import { getFetch, updateSelect } from "./common.js?v=20261002";
import { map, updateMap } from "./kakao.js";
import { moveVisitOrder, placesSignature } from "./route-optimizer.js";
import { startRouteOptimization } from "./route-job.js";
import { initPlanSortable } from "./plan-sortable.js";
import { fetchCarRoute } from "./car-route.js";

// 계획 상세 및 경로 관리 변수
let currentActivePlan = null;
let currentActivePlanId = null;
let currentRoutePolyline = null;
let routeRenderVersion = 0;
let routeAbortController = null;
let optimizationJob = null;
let planSortable = null;

const selectClass1 = document.querySelector("#selectClass1");
const selectClass2 = document.querySelector("#selectClass2");
const selectClass3 = document.querySelector("#selectClass3");
const selectSido = document.querySelector("#selectSido");
const selectGugun = document.querySelector("#selectGugun");

const endPoint = "https://apis.data.go.kr/B551011/KorService2";
const commonConfig = {
  serviceKey: DATA_GO_KR_API_KEY,
  numOfRows: 100,
  pageNo: 1,
  MobileOS: "WEB",
  MobileApp: "WEB",
  _type: "json",
};

const searchButtons = [
  document.querySelector("#btn_trip_search"),
  document.querySelector("#btn_around_search"),
  document.querySelector("#btn_map_search"),
].filter(Boolean);
let searchInProgress = false;

const notifySearch = (detail) => {
  document.dispatchEvent(new CustomEvent("enjoytrip:search-state", { detail }));
};

async function getAllSpots(service, params) {
  const spots = [];
  const seenPages = new Set();
  for (let pageNo = 1; ; pageNo += 1) {
    const json = await getFetch(`${endPoint}/${service}`, {
      ...commonConfig,
      ...params,
      pageNo,
    });
    const body = json?.response?.body;
    const header = json?.response?.header;
    if (!body || (header?.resultCode != null && !["0000", "00", "0"].includes(String(header.resultCode)))) {
      throw new Error(header?.resultMsg || "관광 정보 API 응답을 확인할 수 없습니다.");
    }

    const item = body.items?.item;
    const pageItems = Array.isArray(item) ? item : item && typeof item === "object" ? [item] : [];
    const total = Number(body.totalCount);
    const hasTotal = body.totalCount != null && body.totalCount !== "" && Number.isFinite(total) && total >= 0;
    if (pageItems.length === 0) {
      if (hasTotal && spots.length < total) {
        throw new Error("일부 관광 정보 페이지가 비어 있습니다. 잠시 후 다시 조회해주세요.");
      }
      break;
    }

    const pageKey = JSON.stringify(pageItems.map((spot) => spot.contentid ?? spot));
    if (seenPages.has(pageKey)) {
      throw new Error("API가 같은 페이지를 반복해서 반환했습니다. 잠시 후 다시 조회해주세요.");
    }
    seenPages.add(pageKey);
    spots.push(...pageItems);

    notifySearch({ phase: "loading", loaded: spots.length, total: hasTotal ? total : null });
    if (hasTotal && spots.length >= total) break;
  }

  return spots.map((spot) => ({
    ...spot,
    x: spot.mapx,
    y: spot.mapy,
    address: spot.addr1,
    label: spot.title,
  }));
}

async function runSearch(search) {
  if (searchInProgress) return;
  searchInProgress = true;
  searchButtons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  });
  notifySearch({ phase: "loading", loaded: 0, total: null });
  try {
    const result = await search();
    notifySearch({ phase: "complete", ...result });
  } catch (error) {
    const notice = error.isLocationError ? error.message : "관광 정보를 불러오지 못했습니다. 연결 상태와 API 이용 상태를 확인하고 다시 조회해주세요.";
    notifySearch({
      phase: "error",
      message: error.isLocationError ? "현재 위치를 확인하지 못했어요" : "조회에 실패했어요. 다시 시도해주세요",
      notice,
      offerMapSearch: Boolean(error.isLocationError),
    });
    if (!document.querySelector("#search-feedback")) alert(notice);
  } finally {
    searchInProgress = false;
    searchButtons.forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    });
  }
}

export const initEnjoyTrip = async () => {
  try {
    const [json1, json2] = await Promise.all([
      getFetch(`${endPoint}/lclsSystmCode2`, {
        ...commonConfig,
        lclsSystmListYn: "N",
      }),
      getFetch(`${endPoint}/ldongCode2`, {
        ...commonConfig,
        lDongListYn: "N",
      }),
    ]);

    if (selectClass1) updateSelect(selectClass1, json1.response.body.items.item);
    if (selectClass2) updateSelect(selectClass2);
    if (selectClass3) updateSelect(selectClass3);

    if (selectSido) updateSelect(selectSido, json2.response.body.items.item);
    if (selectGugun) updateSelect(selectGugun);
  } catch (e) {
    console.log(e);
  }
};

if (selectClass1) {
  selectClass1.addEventListener("change", async function () {
    const class1 = selectClass1.value;
    updateSelect(selectClass2);
    updateSelect(selectClass3);
    if (!class1) return;
    try {
      const json = await getFetch(`${endPoint}/lclsSystmCode2`, {
        ...commonConfig,
        lclsSystmListYn: "N",
        lclsSystm1: class1,
      });
      if (selectClass1.value !== class1) return;
      updateSelect(selectClass2, json.response.body.items.item);
    } catch (e) {
      console.log(e);
    }
  });
}

if (selectClass2) {
  selectClass2.addEventListener("change", async function () {
    const class1 = selectClass1.value;
    const class2 = selectClass2.value;
    updateSelect(selectClass3);
    if (!class2) return;
    try {
      const json = await getFetch(`${endPoint}/lclsSystmCode2`, {
        ...commonConfig,
        lclsSystmListYn: "N",
        lclsSystm1: class1,
        lclsSystm2: class2,
      });
      if (selectClass1.value !== class1 || selectClass2.value !== class2) return;
      updateSelect(selectClass3, json.response.body.items.item);
    } catch (e) {
      console.log(e);
    }
  });
}

if (selectSido) {
  selectSido.addEventListener("change", async function () {
    const sido = selectSido.value;
    updateSelect(selectGugun);
    if (!sido) return;
    try {
      const json = await getFetch(`${endPoint}/ldongCode2`, {
        ...commonConfig,
        lDongListYn: "N",
        lDongRegnCd: sido,
      });
      if (selectSido.value !== sido) return;
      updateSelect(selectGugun, json.response.body.items.item);
    } catch (e) {
      console.log(e);
    }
  });
}

document.querySelector("#btn_trip_search")?.addEventListener("click", () => runSearch(async () => {
  const queryObj = {};

  if (selectSido?.value) queryObj.lDongRegnCd = selectSido.value;
  if (selectGugun?.value) queryObj.lDongSignguCd = selectGugun.value;
  if (selectClass1?.value) queryObj.lclsSystm1 = selectClass1.value;
  if (selectClass2?.value) queryObj.lclsSystm2 = selectClass2.value;
  if (selectClass3?.value) queryObj.lclsSystm3 = selectClass3.value;

  const filters = getSearchFilters();
  const spots = await getAllSpots("areaBasedList2", queryObj);
  await updateMap(spots);
  return { spots, filters };
}));

function getSearchFilters(scope = "") {
  const label = (select) => select?.value ? select.selectedOptions?.[0]?.textContent || "" : "";
  const region = scope || [selectSido, selectGugun].map(label).filter(Boolean).join(" ") || "전국";
  const category = [selectClass1, selectClass2, selectClass3].map(label).filter(Boolean).join(" · ") || "전체 분류";
  return `${region} · ${category}`;
}

function locationError(message) {
  return Object.assign(new Error(message), { isLocationError: true });
}

export const getCurrentPosition = (options = {}) => {
  if (!window.isSecureContext) {
    return Promise.reject(locationError("현재 위치 조회는 HTTPS 또는 localhost/127.0.0.1에서 사용할 수 있어요. 개발 중에는 http://127.0.0.1:5500/pages/map.html로 접속해주세요."));
  }
  if (!navigator.geolocation) {
    return Promise.reject(locationError("이 브라우저는 현재 위치 조회를 지원하지 않아요. 다른 브라우저를 사용해주세요."));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(locationError("위치 확인 시간이 초과됐어요. 위치 권한을 확인한 뒤 다시 시도해주세요.")), 15000);
    const fail = (error) => {
      clearTimeout(timer);
      const messages = {
        1: "위치 접근이 차단됐어요. 브라우저의 이 사이트 위치 권한과 기기의 위치 서비스를 허용한 뒤 다시 조회해주세요.",
        2: "현재 위치를 확인할 수 없어요. 기기의 위치 서비스와 네트워크 연결을 확인한 뒤 다시 시도해주세요.",
        3: "위치 확인 시간이 초과됐어요. 위치 권한을 확인한 뒤 다시 조회해주세요.",
      };
      reject(locationError(messages[error.code] || "현재 위치를 확인할 수 없어요. 위치 권한을 확인한 뒤 다시 시도해주세요."));
    };
    try {
      navigator.geolocation.getCurrentPosition((position) => {
        clearTimeout(timer);
        resolve(position);
      }, fail, { timeout: 10000, maximumAge: 60000, ...options });
    } catch (error) {
      fail(error);
    }
  });
};

document.querySelector("#btn_around_search")?.addEventListener("click", () => runSearch(async () => {
  notifySearch({ phase: "locating" });
  const { coords } = await getCurrentPosition();
  return searchAround(coords.latitude, coords.longitude, "내 위치");
}));

document.querySelector("#btn_map_search")?.addEventListener("click", () => runSearch(async () => {
  if (!map) return;
  const center = map.getCenter();
  return searchAround(center.getLat(), center.getLng(), "지도 중심");
}));

async function searchAround(lat, lng, source) {
  const queryObj = {
    mapX: lng,
    mapY: lat,
    radius: 2000,
  };

  if (selectClass1?.value) queryObj.lclsSystm1 = selectClass1.value;
  if (selectClass2?.value) queryObj.lclsSystm2 = selectClass2.value;
  if (selectClass3?.value) queryObj.lclsSystm3 = selectClass3.value;

  const category = [selectClass1, selectClass2, selectClass3]
    .filter((select) => select?.value)
    .map((select) => select.selectedOptions[0].textContent)
    .join(" · ") || "전체 분류";
  const scope = `${source} 반경 2km`;
  const filters = getSearchFilters(scope);
  notifySearch({ phase: "loading", loaded: 0, total: null });
  const spots = await getAllSpots("locationBasedList2", queryObj);

  if (map && window.kakao && window.kakao.maps) {
    map.setCenter(new kakao.maps.LatLng(lat, lng));
    map.setLevel(5);
  }
  await updateMap(spots);
  const notice = spots.length === 0
    ? `${scope}에서 ‘${category}’에 해당하는 관광 정보가 없어요. 분류를 ‘전체’로 바꾸거나 지도를 이동한 뒤 지도 중심으로 다시 조회해보세요.`
    : `${scope} · ${category} 기준으로 조회했어요. 시·도와 시·군·구 조건은 주변 조회에 적용되지 않아요.`;
  if (spots.length === 0 && !document.querySelector("#search-feedback")) alert(notice);
  return { spots, filters, scope, notice, offerMapSearch: spots.length === 0 };
}


// =========================================================
// 1. 저장된 계획 목록 렌더링 (Depth 1)
// =========================================================

window.loadSavedPlans = function () {
  const planListContainer = document.querySelector("#saved-plan-list");
  if (!planListContainer) return;

  let savedPlans = [];
  try {
    const rawData = localStorage.getItem("myTripPlans");
    if (rawData) savedPlans = JSON.parse(rawData);
  } catch (e) {
    console.error("저장된 계획을 불러오는 중 오류가 발생했습니다:", e);
  }

  if (!Array.isArray(savedPlans) || savedPlans.length === 0) {
    planListContainer.innerHTML = `
      <div class="p-4 text-center border rounded-3 bg-light text-secondary small">
        <p class="mb-0">저장된 여행 계획이 없습니다.</p>
      </div>
    `;
    return;
  }

  planListContainer.innerHTML = savedPlans
    .map((plan, index) => {
      const title = plan.title || `여행 계획 #${index + 1}`;
      const date = plan.date || plan.createdAt || "";
      const desc = plan.description || (plan.places ? `${plan.places.length}개 장소` : "");
      const planId = plan.id !== undefined ? plan.id : index;

      return `
      <div class="card p-3 shadow-sm border mb-2 plan-card" style="cursor: pointer;" onclick="window.openPlanDetail('${planId}')">
        <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
          <h3 class="h6 fw-bold mb-0 text-truncate flex-grow-1 plan-card-title">${escapeHtml(title)}</h3>
          ${date ? `<span class="badge bg-primary-subtle text-primary border border-primary-subtle flex-shrink-0">${escapeHtml(date)}</span>` : ""}
        </div>
        ${desc ? `<p class="small text-secondary mb-2 text-truncate">${escapeHtml(desc)}</p>` : ""}
        <div class="d-flex justify-content-end" onclick="event.stopPropagation();">
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.deletePlan('${planId}')">삭제</button>
        </div>
      </div>
    `;
    })
    .join("");
};

// =========================================================
// 2. 카드 클릭 시 상세 화면으로 Depth 이동 (Depth 1 -> Depth 2)
// =========================================================

window.openPlanDetail = async function (planId) {
  const rawData = localStorage.getItem("myTripPlans");
  if (!rawData) return;

  const savedPlans = JSON.parse(rawData);
  const plan = savedPlans.find((p, idx) => (p.id !== undefined ? p.id == planId : idx == planId));

  if (!plan) return;
  clearActivePlan();
  currentActivePlan = plan;
  currentActivePlanId = planId;
  renderPlanDetail(plan);

  document.querySelector("#plan-depth-list")?.classList.add("d-none");
  document.querySelector("#plan-depth-detail")?.classList.remove("d-none");

  // 자동차 경로 바로 렌더링
  await renderPlanOnMap();
};

function renderPlanDetail(plan) {
  planSortable?.cancel();
  const titleEl = document.querySelector("#detail-plan-title");
  if (titleEl) titleEl.textContent = plan.title || "계획 상세";
  const meta = document.querySelector("#detail-plan-meta");
  if (meta) meta.textContent = [plan.date, `관광지 ${(plan.places || []).length}곳`].filter(Boolean).join(" · ");
  const status = document.querySelector("#plan-detail-status");
  if (status) status.hidden = true;
  const detailList = document.querySelector("#detail-place-list");
  if (detailList) {
    detailList.innerHTML = !plan.places?.length
      ? `<div class="text-muted small p-3 text-center bg-light rounded">등록된 장소가 없습니다.</div>`
      : plan.places.map((place, i) => {
        const title = escapeHtml(String(place.title || place.label || "장소"));
        const locked = place.orderLocked === true;
        return `
          <div class="itinerary-place d-flex align-items-center" data-place-index="${i}" data-locked="${locked}" role="listitem">
            <button class="btn itinerary-drag" type="button" data-drag-place="${i}" aria-label="${title} 방문 순서 변경" aria-describedby="plan-reorder-help" aria-pressed="false" ${locked ? "disabled" : ""}>
              <span class="itinerary-grip-slot"><img src="../resources/icons/itinerary-grip.svg" width="9" height="13" alt="" draggable="false" /></span>
            </button>
            <span class="itinerary-number" aria-label="방문 ${i + 1}번">${i + 1}</span>
            <div class="itinerary-place-text flex-grow-1">
              <div class="itinerary-place-name text-truncate" title="${title}">${title}</div>
              ${place.visitTime ? `<div class="itinerary-visit-time text-truncate">🕒 ${escapeHtml(String(place.visitTime))}</div>` : ""}
            </div>
            <button class="btn itinerary-lock d-inline-flex align-items-center justify-content-center" type="button" data-lock-place="${i}" aria-label="${title} ${i + 1}번 순서 잠금" aria-pressed="${locked}" title="${locked ? "순서 잠금 해제" : "현재 방문 순서 잠금"}">
              <svg class="icon" aria-hidden="true"><use href="#icon-order-${locked ? "lock" : "unlock"}" /></svg>
            </button>
            <button class="btn itinerary-delete flex-shrink-0" type="button" data-remove-place="${i}" aria-label="${title} 삭제">삭제</button>
          </div>`;
      }).join("");
  }
  updateOptimizationButton();
}

function updateOptimizationButton() {
  const button = document.querySelector("#btn-optimize-plan");
  if (!button) return;
  button.disabled = Boolean(optimizationJob) || (currentActivePlan?.places || []).filter((place) => !place.orderLocked).length < 2;
  button.textContent = optimizationJob ? "순서 계산 중…" : "최단 경로 순서";
  button.setAttribute("aria-busy", String(Boolean(optimizationJob)));
  button.title = "잠금 위치 유지 · 출발지 복귀 없음 · 직선거리 기준 16곳까지 정확 계산, 초과 시 근사 계산";
  for (const handle of document.querySelector("#detail-place-list")?.querySelectorAll?.("[data-drag-place]") || []) {
    handle.disabled = Boolean(optimizationJob) || currentActivePlan?.places[Number(handle.dataset.dragPlace)]?.orderLocked === true;
  }
}

function cancelOptimization() {
  optimizationJob?.cancel();
  optimizationJob = null;
  updateOptimizationButton();
}

function showPlanStatus(message, error = false) {
  const status = document.querySelector("#plan-detail-status");
  if (!status) return;
  status.textContent = message;
  status.hidden = false;
  status.classList.toggle("text-danger", error);
  status.classList.toggle("text-secondary", !error);
}

function showPlanOrderError(error) {
  if (error.message === "OPTIMIZATION_CANCELLED") return;
  const messages = {
    PLAN_CHANGED: "다른 곳에서 계획이 변경되었어요. 목록에서 계획을 다시 열어주세요.",
    PLAN_NOT_FOUND: "이 여행 계획이 삭제되었어요. 목록에서 다시 선택해주세요.",
    LOCKED_ORDER: "잠근 장소의 방문 번호는 바꿀 수 없어요. 잠금을 해제하거나 다른 위치에 놓아주세요.",
    INVALID_COORDINATES: "좌표가 없는 장소가 있어 순서를 계산하지 못했어요. 장소 정보를 확인해주세요.",
  };
  showPlanStatus(messages[error.message] || "방문 순서를 저장하지 못했어요. 저장 공간을 확인하고 다시 시도해주세요.", true);
}

function clearActivePlan() {
  planSortable?.cancel();
  cancelOptimization();
  currentActivePlan = null;
  currentActivePlanId = null;
  routeRenderVersion += 1;
  routeAbortController?.abort();
  currentRoutePolyline?.setMap(null);
  currentRoutePolyline = null;
  updateOptimizationButton();
}

function readActivePlanForChange() {
  if (!currentActivePlan || currentActivePlanId == null) throw new Error("NO_PLAN_SELECTED");
  const plans = getTravelPlans();
  const index = plans.findIndex((plan, position) => String(plan.id ?? position) === String(currentActivePlanId));
  if (index < 0) throw new Error("PLAN_NOT_FOUND");
  const plan = plans[index];
  if (!Array.isArray(plan.places)) throw new Error("INVALID_PLANS");
  if (placesSignature(plan.places) !== placesSignature(currentActivePlan.places || [])) throw new Error("PLAN_CHANGED");
  return { plans, index, plan };
}

function savePlanPlaces(state, places) {
  const updated = { ...state.plan, places };
  state.plans[state.index] = updated;
  localStorage.setItem("myTripPlans", JSON.stringify(state.plans));
  cancelOptimization();
  currentActivePlan = updated;
  renderPlanDetail(updated);
  window.loadSavedPlans();
  document.dispatchEvent(new CustomEvent("enjoytrip:plans-updated"));
}

export const reorderActivePlan = async (order) => {
  const state = readActivePlanForChange();
  const places = state.plan.places;
  if (!Array.isArray(order) || order.length !== places.length || new Set(order).size !== places.length ||
      order.some((index) => !Number.isInteger(index) || index < 0 || index >= places.length)) throw new Error("INVALID_ORDER");
  if (places.some((place, index) => place.orderLocked && order[index] !== index)) throw new Error("LOCKED_ORDER");
  if (order.every((value, index) => value === index)) return false;
  savePlanPlaces(state, order.map((index) => places[index]));
  showPlanStatus("방문 순서를 저장했어요.");
  await renderPlanOnMap();
  return true;
};

export const setPlaceOrderLocked = (placeIndex) => {
  const state = readActivePlanForChange();
  if (!Number.isInteger(placeIndex) || !state.plan.places[placeIndex]) throw new Error("PLACE_NOT_FOUND");
  const locked = !state.plan.places[placeIndex].orderLocked;
  const places = state.plan.places.map((place, index) => index === placeIndex ? { ...place, orderLocked: locked } : place);
  savePlanPlaces(state, places);
  showPlanStatus(`${placeIndex + 1}번 방문 순서 ${locked ? "잠금을 저장했어요." : "잠금을 해제했어요."}`);
  return locked;
};

export const optimizeActivePlan = async () => {
  const state = readActivePlanForChange();
  const planId = currentActivePlanId;
  const signature = placesSignature(state.plan.places);
  cancelOptimization();
  const job = startRouteOptimization(state.plan.places);
  optimizationJob = job;
  updateOptimizationButton();
  try {
    const result = await job.promise;
    if (optimizationJob !== job || currentActivePlanId !== planId) return null;
    if (placesSignature(currentActivePlan.places) !== signature) throw new Error("PLAN_CHANGED");
    optimizationJob = null;
    const applying = reorderActivePlan(result.order);
    const appliedSignature = placesSignature(currentActivePlan.places);
    await applying;
    if (currentActivePlanId === planId && placesSignature(currentActivePlan.places) === appliedSignature) {
      showPlanStatus(result.exact ? "잠금 순서를 유지해 직선거리 기준 최단 순서를 적용했어요."
        : "모든 장소와 잠금을 유지해 직선거리 기준 근사 순서를 적용했어요. 최단 순서를 보장하지는 않아요.");
    }
    return result;
  } finally {
    if (optimizationJob === job) optimizationJob = null;
    updateOptimizationButton();
  }
};

export const getTravelPlans = () => {
  const savedPlans = JSON.parse(localStorage.getItem("myTripPlans") || "[]");
  if (!Array.isArray(savedPlans)) throw new Error("INVALID_PLANS");
  return savedPlans;
};

export const addPlaceToPlan = (planId, info) => {
  if (planId == null || String(planId) === "") throw new Error("NO_PLAN_SELECTED");
  const savedPlans = getTravelPlans();
  const planIndex = savedPlans.findIndex((plan, index) => String(plan.id ?? index) === String(planId));
  if (planIndex < 0) throw new Error("PLAN_NOT_FOUND");

  const title = String(info?.title || info?.label || "").trim();
  const x = Number(info?.x ?? info?.mapx);
  const y = Number(info?.y ?? info?.mapy);
  if (!title || !(124.5 <= x && x <= 132 && 33 <= y && y <= 38.6)) {
    throw new Error("INVALID_PLACE");
  }

  const plan = savedPlans[planIndex];
  if (plan.places != null && !Array.isArray(plan.places)) throw new Error("INVALID_PLANS");
  const places = plan.places || [];
  const duplicate = places.some((place) => {
    if (info.contentid && place.contentid) return String(info.contentid) === String(place.contentid);
    return Number(place.x ?? place.mapx) === x && Number(place.y ?? place.mapy) === y
      && String(place.title || place.label || "").trim() === title;
  });
  if (duplicate) return { added: false, planTitle: plan.title || "여행 계획" };

  const updatedPlan = {
    ...plan,
    places: [...places, { ...info, title, label: title, x, y, address: info.address || info.addr1 || "" }],
  };
  savedPlans[planIndex] = updatedPlan;
  // 저장에 성공한 후에만 선택 상태와 화면을 갱신합니다.
  localStorage.setItem("myTripPlans", JSON.stringify(savedPlans));
  document.dispatchEvent(new CustomEvent("enjoytrip:plans-updated"));
  if (currentActivePlan && String(currentActivePlanId) === String(planId)) {
    cancelOptimization();
    currentActivePlan = updatedPlan;
    renderPlanDetail(updatedPlan);
    routeRenderVersion += 1;
    routeAbortController?.abort();
    currentRoutePolyline?.setMap(null);
    currentRoutePolyline = null;
  }
  window.loadSavedPlans();
  // 연속으로 장소를 추가할 수 있도록 검색 마커와 지도 위치를 유지합니다.
  // 저장된 장소의 마커와 경로는 계획 상세를 열 때 표시합니다.
  return { added: true, planTitle: updatedPlan.title || "여행 계획" };
};

export const removePlaceFromActivePlan = async (placeIndex) => {
  if (!currentActivePlan || currentActivePlanId == null) throw new Error("NO_PLAN_SELECTED");
  const selectedPlace = Number.isInteger(placeIndex) && currentActivePlan.places?.[placeIndex];
  if (!selectedPlace) throw new Error("PLACE_NOT_FOUND");

  const savedPlans = getTravelPlans();
  const planIndex = savedPlans.findIndex((plan, index) => String(plan.id ?? index) === String(currentActivePlanId));
  if (planIndex < 0) throw new Error("PLAN_NOT_FOUND");
  const plan = savedPlans[planIndex];
  if (!Array.isArray(plan.places)) throw new Error("INVALID_PLANS");
  // 다른 창에서 목록을 수정했더라도 선택한 장소만 삭제합니다.
  const savedPlaceIndex = plan.places.findIndex((place) => {
    if (selectedPlace.contentid && place.contentid) return String(selectedPlace.contentid) === String(place.contentid);
    return Number(place.x ?? place.mapx) === Number(selectedPlace.x ?? selectedPlace.mapx)
      && Number(place.y ?? place.mapy) === Number(selectedPlace.y ?? selectedPlace.mapy)
      && String(place.title || place.label || "").trim() === String(selectedPlace.title || selectedPlace.label || "").trim();
  });
  if (savedPlaceIndex < 0) throw new Error("PLACE_NOT_FOUND");

  const updatedPlan = { ...plan, places: plan.places.filter((_, index) => index !== savedPlaceIndex) };
  savedPlans[planIndex] = updatedPlan;
  localStorage.setItem("myTripPlans", JSON.stringify(savedPlans));
  document.dispatchEvent(new CustomEvent("enjoytrip:plans-updated"));
  cancelOptimization();
  currentActivePlan = updatedPlan;
  renderPlanDetail(updatedPlan);
  window.loadSavedPlans();
  await renderPlanOnMap();
};

window.deletePlan = function (planId) {
  if (!confirm("이 여행 계획을 삭제하시겠습니까?")) return;

  const rawData = localStorage.getItem("myTripPlans");
  if (!rawData) return;

  let savedPlans = JSON.parse(rawData);
  savedPlans = savedPlans.filter((p, idx) => (p.id !== undefined ? p.id != planId : idx != planId));

  localStorage.setItem("myTripPlans", JSON.stringify(savedPlans));
  document.dispatchEvent(new CustomEvent("enjoytrip:plans-updated"));
  window.loadSavedPlans();
};

// =========================================================
// 3. 지도에 마커 및 카카오내비 자동차 경로 렌더링
// =========================================================

async function renderPlanOnMap() {
  const version = ++routeRenderVersion;
  routeAbortController?.abort();
  currentRoutePolyline?.setMap(null);
  currentRoutePolyline = null;
  if (!map || !currentActivePlan) return;
  const controller = new AbortController();
  routeAbortController = controller;
  const places = currentActivePlan.places || [];
  const mode = document.querySelector("#plan-route-mode");
  if (mode) mode.textContent = places.length < 2 ? "방문지를 2곳 이상 추가해주세요" : "자동차 경로 조회 중…";
  try {
    await updateMap(places, { numbered: true });
    if (version !== routeRenderVersion || places.length < 2) return;
    const result = await fetchCarRoute(places, { apiKey: KAKAO_REST_API_KEY || "", signal: controller.signal });
    if (version !== routeRenderVersion) return;
    if (mode) mode.textContent = result.fallback ? "직선 연결 포함 · 경로 조회 실패" : "카카오내비 자동차 경로";
    if (result.path.length > 1 && window.kakao?.maps) {
      currentRoutePolyline = new kakao.maps.Polyline({
        path: result.path.map((point) => new kakao.maps.LatLng(point.lat, point.lng)),
        strokeWeight: 5, strokeColor: "#8552e5", strokeOpacity: 0.8,
        strokeStyle: result.fallback ? "shortdash" : "solid",
      });
      currentRoutePolyline.setMap(map);
    }
  } catch (error) {
    if (version !== routeRenderVersion || controller.signal.aborted) return;
    if (mode) mode.textContent = "이동 경로를 표시하지 못했어요";
    showPlanStatus("계획은 저장되어 있어요. 좌표와 연결 상태를 확인한 뒤 계획을 다시 열어주세요.", true);
  }
}

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function initPlanTabEvents() {
  const placeList = document.querySelector("#detail-place-list");
  planSortable = initPlanSortable(placeList, {
    isBusy: () => Boolean(optimizationJob),
    onError: showPlanOrderError,
    onMove: async (from, to) => {
      const order = moveVisitOrder(currentActivePlan?.places || [], from, to);
      const updating = reorderActivePlan(order);
      placeList.querySelector(`[data-drag-place="${to}"]`)?.focus({ preventScroll: true });
      await updating;
    },
  });
  document.querySelector("#btn-optimize-plan")?.addEventListener("click", async () => {
    try { await optimizeActivePlan(); } catch (error) { showPlanOrderError(error); }
  });
  placeList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lock-place]");
    if (!button) return;
    try {
      const index = Number(button.dataset.lockPlace);
      setPlaceOrderLocked(index);
      placeList.querySelector(`[data-lock-place="${index}"]`)?.focus({ preventScroll: true });
    } catch (error) { showPlanOrderError(error); }
  });
  placeList?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-place]");
    if (!button || button.disabled) return;
    const planId = currentActivePlanId;
    const placeIndex = Number(button.dataset.removePlace);
    button.disabled = true;
    try {
      await removePlaceFromActivePlan(placeIndex);
      if (currentActivePlanId !== planId) return;
      const nextIndex = Math.min(placeIndex, currentActivePlan.places.length - 1);
      const focusTarget = placeList.querySelector(`[data-remove-place="${nextIndex}"]`) || document.querySelector("#btn-plan-back");
      focusTarget?.focus({ preventScroll: true });
    } catch (error) {
      if (currentActivePlanId !== planId) return;
      const status = document.querySelector("#plan-detail-status");
      const messages = {
        PLAN_NOT_FOUND: "이 여행 계획이 삭제되었어요. 목록에서 다시 선택해주세요.",
        PLACE_NOT_FOUND: "장소 목록이 변경되었어요. 목록에서 계획을 다시 열어주세요.",
      };
      if (status) {
        status.textContent = messages[error.message] || "장소를 삭제하거나 지도를 갱신하지 못했어요. 계획을 다시 열어 확인해주세요.";
        status.hidden = false;
      }
    } finally {
      button.disabled = false;
    }
  });

  const planList = document.querySelector("#plan-depth-list");
  const planBtn = document.querySelector("#tab-plan-btn");
  if (planBtn) {
    const resetAndLoad = () => {
      clearActivePlan();
      document.querySelector("#plan-depth-detail")?.classList.add("d-none");
      document.querySelector("#plan-depth-list")?.classList.remove("d-none");
      if (planList) bootstrap.Collapse.getOrCreateInstance(planList, { toggle: false }).show();
      window.loadSavedPlans();
    };

    planBtn.addEventListener("click", resetAndLoad);
    planBtn.addEventListener("shown.bs.tab", resetAndLoad);
    planBtn.addEventListener("hide.bs.tab", clearActivePlan);
  }

  document.querySelector("#btn-plan-back")?.addEventListener("click", () => {
    clearActivePlan();
    document.querySelector("#plan-depth-detail")?.classList.add("d-none");
    document.querySelector("#plan-depth-list")?.classList.remove("d-none");

  });

  window.addEventListener?.("storage", (event) => {
    if (event.key !== "myTripPlans" && event.key !== null) return;
    planSortable?.cancel();
    cancelOptimization();
    if (currentActivePlan) showPlanStatus("다른 창에서 계획이 변경되었어요. 목록에서 계획을 다시 열어주세요.");
  });
  window.loadSavedPlans();
  initPlanCreateForm();
}

function initPlanCreateForm() {
  const form = document.querySelector("#plan-create-form");
  if (!form) return;

  const titleInput = document.querySelector("#plan-title");
  const dateInput = document.querySelector("#plan-date");
  const createPanel = document.querySelector("#plan-depth-create");
  const planList = document.querySelector("#plan-depth-list");
  const errorMessage = document.querySelector("#plan-create-error");
  const submitButton = form.querySelector('[type="submit"]');

  titleInput.addEventListener("input", () => titleInput.setCustomValidity(""));
  createPanel.addEventListener("show.bs.collapse", () => {
    form.reset();
    titleInput.setCustomValidity("");
    errorMessage.hidden = true;
  });
  createPanel.addEventListener("shown.bs.collapse", () => titleInput.focus());
  planList.addEventListener("shown.bs.collapse", () => document.querySelector("#btn-create-plan").focus());

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    errorMessage.hidden = true;
    const title = titleInput.value.trim();
    titleInput.setCustomValidity(title ? "" : "여행 이름을 입력해주세요.");
    if (!form.reportValidity()) return;

    submitButton.disabled = true;
    try {
      const savedPlans = JSON.parse(localStorage.getItem("myTripPlans") || "[]");
      if (!Array.isArray(savedPlans)) throw new Error("INVALID_PLANS");

      const plan = {
        id: crypto.randomUUID(),
        title,
        date: dateInput.value,
        description: "",
      };
      localStorage.setItem("myTripPlans", JSON.stringify([...savedPlans, plan]));
      document.dispatchEvent(new CustomEvent("enjoytrip:plans-updated"));
      window.loadSavedPlans();
      bootstrap.Collapse.getOrCreateInstance(planList, { toggle: false }).show();
    } catch {
      errorMessage.textContent = "여행 계획을 저장하지 못했어요. 브라우저 저장 공간과 기존 계획 데이터를 확인해주세요.";
      errorMessage.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPlanTabEvents);
} else {
  initPlanTabEvents();
}
