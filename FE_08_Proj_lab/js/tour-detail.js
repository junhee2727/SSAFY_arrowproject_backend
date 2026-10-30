import { DATA_GO_KR_API_KEY } from "./keys.js";
import { loadTourDetails } from "./tour-detail-api.js";
import { getCurrentWeather } from "./weather.js";
import { addPlaceToPlan, getTravelPlans } from "./map.js";

const PLACEHOLDER_IMAGE = new URL("../resources/img/placeholder.png", import.meta.url).href;
const TYPE_NAMES = { 12: "관광지", 14: "문화시설", 15: "축제·공연·행사", 25: "여행코스", 28: "레포츠", 32: "숙박", 38: "쇼핑", 39: "음식점" };
const INTRO_FIELDS = {
  12: [["이용시간", "usetime"], ["휴무일", "restdate"], ["문의", "infocenter"], ["주차", "parking"], ["체험안내", "expguide"]],
  14: [["이용시간", "usetimeculture"], ["휴무일", "restdateculture"], ["문의", "infocenterculture"], ["이용요금", "usefee"], ["주차", "parkingculture"]],
  15: [["행사장소", "eventplace"], ["시작일", "eventstartdate"], ["종료일", "eventenddate"], ["공연시간", "playtime"], ["문의", "sponsor1tel"], ["이용요금", "usetimefestival"]],
  25: [["소요시간", "taketime"], ["코스거리", "distance"], ["일정", "schedule"], ["문의", "infocentertourcourse"]],
  28: [["이용시간", "usetimeleports"], ["휴무일", "restdateleports"], ["문의", "infocenterleports"], ["이용요금", "usefeeleports"], ["주차", "parkingleports"]],
  32: [["체크인", "checkintime"], ["체크아웃", "checkouttime"], ["문의", "infocenterlodging"], ["주차", "parkinglodging"], ["예약안내", "reservationlodging"], ["객실유형", "roomtype"]],
  38: [["영업시간", "opentime"], ["휴무일", "restdateshopping"], ["문의", "infocentershopping"], ["주차", "parkingshopping"], ["판매품목", "saleitem"]],
  39: [["영업시간", "opentimefood"], ["휴무일", "restdatefood"], ["문의", "infocenterfood"], ["대표메뉴", "firstmenu"], ["메뉴", "treatmenu"], ["주차", "parkingfood"], ["예약안내", "reservationfood"]],
};

const detailElement = document.getElementById("tour-detail-modal");
const detailModal = window.bootstrap.Offcanvas.getOrCreateInstance(detailElement, {
  backdrop: false,
  scroll: true,
  keyboard: false,
});
const closeButton = detailElement.querySelector(".tour-detail-close");
const content = document.getElementById("tour-detail-content");
const heroImage = document.getElementById("tour-detail-image");
const retryButton = document.getElementById("tour-detail-retry");
const weatherSection = document.getElementById("tour-detail-weather");
const weatherStatus = document.getElementById("tour-weather-status");
const weatherContent = document.getElementById("tour-weather-content");
const addToPlanButton = document.getElementById("btn_add_to_route");
const planStatus = document.getElementById("tour-detail-plan-status");
const planPicker = document.getElementById("tour-plan-picker");
const planSelect = document.getElementById("tour-plan-select");
const cancelPlanButton = document.getElementById("tour-plan-cancel");
let pendingPlanPlace = null;
let selectedPlace = null;
let requestId = 0;
let activeController = null;

// API의 HTML은 분리된 template에서 텍스트만 추출합니다. 원본 노드는 삽입하지 않습니다.
function plainText(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value ?? "").replace(/<br\s*\/?\s*>|<\/(?:p|div|li)>/gi, "\n");
  template.content.querySelectorAll("script, style, iframe, object").forEach((element) => element.remove());
  return template.content.textContent.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function httpUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function setImage(image, source, description) {
  const url = httpUrl(source);
  image.classList.toggle("is-placeholder", !url);
  image.alt = url ? description : "등록된 사진이 없습니다";
  image.onerror = () => {
    // 대체 이미지도 실패하는 경우에는 요청을 반복하지 않습니다.
    image.onerror = null;
    image.classList.add("is-placeholder");
    image.alt = "등록된 사진이 없습니다";
    image.src = PLACEHOLDER_IMAGE;
  };
  image.src = url || PLACEHOLDER_IMAGE;
}

function setStatus(message = "", { loading = false, retry = false } = {}) {
  document.getElementById("tour-detail-status").hidden = !message;
  document.getElementById("tour-detail-message").textContent = message;
  document.getElementById("tour-detail-spinner").hidden = !loading;
  retryButton.hidden = !retry;
  content.setAttribute("aria-busy", String(loading));
}

function appendRow(list, label, value, link = "") {
  const text = plainText(value);
  if (!text) return;
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  if (link) {
    const anchor = document.createElement("a");
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = text;
    anchor.setAttribute("aria-label", label + " (새 탭)");
    description.append(anchor);
  } else {
    description.textContent = text;
  }
  list.append(term, description);
}

function renderVisit(info, common, intro, type) {
  const list = document.getElementById("tour-detail-visit");
  list.replaceChildren();
  const address = [common.addr1 || info.addr1 || info.address, common.addr2 || info.addr2].filter(Boolean).join(" ");
  appendRow(list, "주소", address);
  const fields = INTRO_FIELDS[type] || [];
  for (const [label, key] of fields) {
    const value = /event(?:start|end)date/.test(key)
      ? String(intro[key] || "").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1.$2.$3")
      : intro[key];
    appendRow(list, label, value);
  }
  const contactKey = fields.find(([label]) => label === "문의")?.[1];
  if (!plainText(intro[contactKey])) appendRow(list, "문의", common.tel || info.tel);

  const homepageTemplate = document.createElement("template");
  homepageTemplate.innerHTML = String(common.homepage || "");
  const homepage = httpUrl(homepageTemplate.content.querySelector("a")?.getAttribute("href") || plainText(common.homepage));
  if (homepage) appendRow(list, "홈페이지", "홈페이지 방문", homepage);
  document.getElementById("tour-detail-visit-empty").hidden = list.children.length > 0;
}

function renderExtra(items, type) {
  const container = document.getElementById("tour-detail-extra-content");
  container.replaceChildren();
  document.getElementById("tour-extra-title").textContent = type === "32" ? "객실 정보" : type === "25" ? "코스 정보" : "상세 안내";
  for (const item of items) {
    let title = item.infoname;
    let description = plainText(item.infotext);
    if (type === "25") {
      title = item.subname;
      description = plainText(item.subdetailoverview);
    } else if (type === "32") {
      title = item.roomtitle;
      description = [
        plainText(item.roomintro),
        item.roombasecount && "기준 " + item.roombasecount + "명",
        item.roommaxcount && "최대 " + item.roommaxcount + "명",
        item.roomsize2 && "객실 크기 " + item.roomsize2 + "㎡",
      ].filter(Boolean).join("\n");
    }
    if (!plainText(title) && !description) continue;
    const article = document.createElement("div");
    const heading = document.createElement("h4");
    heading.className = "tour-detail-extra-title";
    heading.textContent = plainText(title) || "안내";
    const text = document.createElement("p");
    text.className = "tour-detail-text";
    text.textContent = description;
    article.append(heading, text);
    container.append(article);
  }
  document.getElementById("tour-detail-extra").hidden = !container.children.length;
}

function renderImages(info, common, images, title) {
  const urls = [...new Set([
    common.firstimage || common.firstimage2,
    info.firstimage || info.firstimage2,
    ...images.map((image) => image.originimgurl || image.smallimageurl),
  ].map(httpUrl).filter(Boolean))];
  setImage(heroImage, urls[0], title + " 대표 사진");
  const photos = document.getElementById("tour-detail-photos");
  photos.replaceChildren();
  urls.forEach((url, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn tour-detail-photo";
    button.setAttribute("aria-label", title + " 사진 " + (index + 1) + " 보기");
    button.setAttribute("aria-pressed", String(index === 0));
    const image = document.createElement("img");
    image.loading = "lazy";
    setImage(image, url, "");
    button.append(image);
    button.addEventListener("click", () => {
      setImage(heroImage, url, title + " 사진 " + (index + 1));
      for (const photo of photos.children) photo.setAttribute("aria-pressed", String(photo === button));
      content.scrollTo({ top: 0 });
    });
    photos.append(button);
  });
  document.getElementById("tour-detail-gallery").hidden = urls.length < 2;
}

function setWeatherLoading() {
  weatherSection.hidden = false;
  weatherStatus.hidden = false;
  weatherStatus.textContent = "날씨 정보를 불러오고 있어요.";
  weatherContent.hidden = true;
  document.getElementById("tour-weather-time").textContent = "";
}

function setWeatherError(message) {
  weatherSection.hidden = false;
  weatherStatus.hidden = false;
  weatherStatus.textContent = message;
  weatherContent.hidden = true;
}

function formatRainfall(value) {
  const text = String(value ?? "-").trim();
  if (!text || text === "-") return "-";
  if (/^강수없음$/i.test(text)) return "강수 없음";
  return /^\d+(?:\.\d+)?$/.test(text) ? `${text}mm` : text;
}

function renderWeather(weather) {
  weatherStatus.hidden = true;
  weatherContent.hidden = false;
  document.getElementById("tour-weather-time").textContent = `${weather.observedAt} 기준`;
  document.getElementById("tour-weather-icon").textContent = weather.icon;
  document.getElementById("tour-weather-temperature").textContent = weather.temperature;
  document.getElementById("tour-weather-condition").textContent = weather.condition;
  document.getElementById("tour-weather-humidity").textContent = weather.humidity;
  document.getElementById("tour-weather-rainfall").textContent = formatRainfall(weather.rainfall);
  document.getElementById("tour-weather-direction").textContent = weather.windDirection;
  document.getElementById("tour-weather-wind-speed").textContent = weather.windSpeed;
}

async function loadWeather(info, currentRequest, signal) {
  const latitude = info.y ?? info.mapy ?? info.latitude;
  const longitude = info.x ?? info.mapx ?? info.longitude;
  setWeatherLoading();

  try {
    const weather = await getCurrentWeather({ latitude, longitude, signal });
    if (currentRequest === requestId) renderWeather(weather);
  } catch (error) {
    if (error.name === "AbortError" || currentRequest !== requestId) return;

    if (error.message === "WEATHER_KEY_MISSING") {
      setWeatherError("KMA_SERVICE_KEY를 설정하면 현재 날씨를 확인할 수 있어요.");
    } else if (error.message === "WEATHER_COORDINATES_MISSING") {
      setWeatherError("이 장소의 좌표가 없어 날씨를 확인할 수 없어요.");
    } else {
      console.error("현재 날씨 조회 실패:", error);
      setWeatherError("현재 날씨를 불러오지 못했어요. 잠시 후 다시 확인해주세요.");
    }
  }
}

function renderDetail(info, detail = {}) {
  const common = detail.common || {};
  const title = plainText(common.title || info.title || info.label) || "관광지 세부 정보";
  const type = String(common.contenttypeid || info.contenttypeid || "");
  document.getElementById("tour-detail-title").textContent = title;
  const category = document.getElementById("tour-detail-category");
  category.textContent = TYPE_NAMES[type] || "";
  category.hidden = !category.textContent;
  document.getElementById("tour-detail-overview").textContent = plainText(common.overview) || "등록된 소개가 없습니다.";
  renderVisit(info, common, detail.intro || {}, type);
  renderExtra(detail.info || [], type);
  renderImages(info, common, detail.images || [], title);
  document.getElementById("tour-detail-credit").hidden = !info.contentid;
}

async function showPlace(info) {
  if (!info) return;
  selectedPlace = info;
  closePlanPicker();
  planStatus.hidden = true;
  const currentRequest = ++requestId;
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  renderDetail(info);
  content.scrollTop = 0;
  detailModal.show();
  void loadWeather(info, currentRequest, controller.signal);

  if (!info.contentid) {
    setStatus("이 장소에는 등록된 관광 상세 정보가 없습니다. 관광지 조회 후 표시되는 마커를 선택해주세요.");
    return;
  }

  setStatus("상세 정보를 불러오고 있어요.", { loading: true });
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const detail = await loadTourDetails({
      contentId: info.contentid,
      contentTypeId: info.contenttypeid,
      serviceKey: DATA_GO_KR_API_KEY,
      signal: controller.signal,
    });
    // 다른 마커를 선택하거나 창을 닫았다면 이전 응답은 표시하지 않습니다.
    if (currentRequest !== requestId) return;
    renderDetail(info, detail);
    const hasData = Object.keys(detail.common).length || Object.keys(detail.intro).length || detail.info.length || detail.images.length;
    if (detail.failed.length) {
      setStatus(detail.failed.length === 4 ? "상세 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요." : "일부 정보를 불러오지 못했어요. 다시 시도해주세요.", { retry: true });
    } else {
      setStatus(hasData ? "" : "등록된 상세 정보가 없습니다.");
    }
  } catch {
    if (currentRequest === requestId) setStatus("상세 정보를 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.", { retry: true });
  } finally {
    clearTimeout(timer);
    if (currentRequest === requestId) content.setAttribute("aria-busy", "false");
  }
}

document.addEventListener("enjoytrip:place-selected", ({ detail }) => showPlace(detail));
retryButton.addEventListener("click", () => showPlace(selectedPlace));

function closePlanPicker() {
  planPicker.hidden = true;
  pendingPlanPlace = null;
  addToPlanButton.setAttribute("aria-expanded", "false");
}

addToPlanButton.addEventListener("click", () => {
  if (!selectedPlace) return;
  closePlanPicker();
  planStatus.hidden = true;
  planStatus.classList.remove("text-danger");
  try {
    const plans = getTravelPlans();
    if (!plans.length) {
      planStatus.textContent = "저장된 여행 계획이 없어요. 왼쪽 계획 탭에서 새 계획을 먼저 만들어주세요.";
      planStatus.hidden = false;
      return;
    }

    planSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "여행 계획을 선택해주세요";
    planSelect.append(placeholder);
    plans.forEach((plan, index) => {
      const option = document.createElement("option");
      option.value = String(plan.id ?? index);
      option.textContent = [plan.title || `여행 계획 #${index + 1}`, plan.date].filter(Boolean).join(" · ");
      planSelect.append(option);
    });
    planSelect.value = "";
    pendingPlanPlace = selectedPlace;
    planPicker.hidden = false;
    addToPlanButton.setAttribute("aria-expanded", "true");
    planSelect.focus();
  } catch {
    planStatus.textContent = "여행 계획을 불러오지 못했어요. 브라우저 저장 공간과 계획 데이터를 확인해주세요.";
    planStatus.classList.add("text-danger");
    planStatus.hidden = false;
  }
});

cancelPlanButton.addEventListener("click", () => {
  closePlanPicker();
  planStatus.hidden = true;
  addToPlanButton.focus();
});

planPicker.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!pendingPlanPlace) return;
  planStatus.hidden = false;
  planStatus.classList.remove("text-danger");
  if (!planSelect.value) {
    planStatus.textContent = "장소를 추가할 여행 계획을 선택해주세요.";
    planStatus.classList.add("text-danger");
    planSelect.focus();
    return;
  }
  try {
    const result = addPlaceToPlan(planSelect.value, pendingPlanPlace);
    closePlanPicker();
    addToPlanButton.focus();
    planStatus.textContent = result.added
      ? `‘${result.planTitle}’에 장소를 추가했어요.`
      : `이미 ‘${result.planTitle}’에 포함된 장소예요.`;
  } catch (error) {
    const messages = {
      NO_PLAN_SELECTED: "장소를 추가할 여행 계획을 선택해주세요.",
      PLAN_NOT_FOUND: "선택한 계획을 찾을 수 없어요. ‘여행 계획에 추가’를 눌러 다시 선택해주세요.",
      INVALID_PLACE: "이 장소의 이름이나 위치를 확인할 수 없어 추가하지 못했어요.",
    };
    planStatus.textContent = messages[error.message] || "장소를 저장하지 못했어요. 브라우저 저장 공간과 계획 데이터를 확인해주세요.";
    planStatus.classList.add("text-danger");
  }
});

detailElement.addEventListener("shown.bs.offcanvas", () => {
  // 지도와 검색 조건도 사용할 수 있는 비모달 패널입니다.
  detailElement.removeAttribute("aria-modal");
  closeButton.focus({ preventScroll: true });
});

detailElement.addEventListener("hide.bs.offcanvas", () => {
  closePlanPicker();
  requestId += 1;
  activeController?.abort();
  content.setAttribute("aria-busy", "false");
});

detailElement.addEventListener("hidden.bs.offcanvas", () => {
  document.querySelector(".map-region").focus({ preventScroll: true });
});
