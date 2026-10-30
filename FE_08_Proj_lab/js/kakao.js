import { KAKAO_MAP_KEY } from "./keys.js";

// 카카오 맵 SDK를 동적으로 로드하기 위한 헬퍼 함수
export function loadKakaoMap() {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps?.Map && window.kakao.maps.MarkerClusterer && window.kakao.maps.services?.Geocoder) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_MAP_KEY)}&autoload=false&libraries=services,clusterer`;
    script.async = true;
    script.onload = () => kakao.maps.load(resolve);
    script.onerror = () => reject(new Error("카카오 지도 SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}
// marker 목록
export let geocoder = null;
export const markers = [];
export let map = null;
export let clusterer = null;
const infoWindows = [];
const markerPlaces = [];
let mapUpdateVersion = 0;

// 지도를 초기화하는 함수
export const initMap = (containerId = "map") => {
  if (map) {
    return; // 이미 초기화 되었다면 종료
  }
  const mapContainer = document.getElementById(containerId); // 지도를 표시할 div
  const mapOption = {
    center: new kakao.maps.LatLng(33.450701, 126.570667), // 지도의 중심좌표
    level: 3, // 지도의 확대 레벨
  };
  map = new kakao.maps.Map(mapContainer, mapOption);
  geocoder = new kakao.maps.services.Geocoder();
  // 가까운 장소를 묶고, 지도를 충분히 확대하면 개별 마커를 표시합니다.
  clusterer = new kakao.maps.MarkerClusterer({
    map,
    averageCenter: true,
    minLevel: 5,
    gridSize: 60,
    calculator: [10, 100, 1000],
    styles: [40, 48, 56, 64].map((size, index) => ({
      width: `${size}px`,
      height: `${size}px`,
      lineHeight: `${size - 6}px`,
      boxSizing: "border-box",
      borderRadius: "50%",
      border: "3px solid #fff",
      background: index === 0 ? "#e8f3ff" : "#3182f6",
      color: index === 0 ? "#2272eb" : "#fff",
      textAlign: "center",
      fontWeight: "700",
      fontSize: "15px",
      boxShadow: "0 3px 12px rgba(37, 63, 98, 0.15)",
    })),
  });
};

export const updateMap = async (infos, { numbered = false } = {}) => {
  const version = ++mapUpdateVersion;
  clusterer.clear();
  markerPlaces.length = 0;
  infoWindows.forEach((infoWindow) => infoWindow.close());
  infoWindows.length = 0;
  markers.forEach((m) => m.setMap(null));
  markers.length = 0; // 마커와 경계 초기화

  const bounds = new kakao.maps.LatLngBounds(); // 지도 경계 초기화
  try {
    // 좌표가 없는 장소는 주소 검색 결과로 좌표를 채웁니다.
    const promises = infos
      .filter((info) => !info.x || !info.y)
      .map((info) => new Promise((resolve) => {
        if (!info.address) {
          resolve();
          return;
        }
        geocoder.addressSearch(info.address, (result, status) => {
          if (status === kakao.maps.services.Status.OK && result.length > 0) {
            info.x = Number(result[0].x);
            info.y = Number(result[0].y);
          } else {
            console.warn("주소의 좌표를 찾지 못했습니다:", info.address);
          }
          // 검색 실패 시에도 나머지 장소의 마커 표시를 진행합니다.
          resolve();
        });
      }));

    await Promise.all(promises); // 모두 resolve 되면.
    if (version !== mapUpdateVersion) return;

    for (const [index, info] of infos.entries()) {
      // 잘못된 좌표가 들어오는 경우는 filtering(우리나라만 취급)
      if (124.5 <= info.x && info.x <= 132 && 33.0 <= info.y && info.y <= 38.6) {
        setOverlay(info, bounds, numbered ? index + 1 : null);
      } else {
        console.warn("좌표가 유효하지 않습니다:", info);
      }
    }
    // 마커는 클러스터러가 지도에 표시하도록 한 번에 등록합니다.
    if (numbered) markers.forEach((marker) => marker.setMap(map));
    else clusterer.addMarkers(markers);
    // 지도 경계 설정
    if (markers.length > 0) {
      map.setBounds(bounds);
    }
    document.dispatchEvent(new CustomEvent("enjoytrip:map-updated", {
      detail: { count: markers.length, infos },
    }));
  } catch (e) {
    throw e;
  }
};

// 목록에서 선택한 장소를 확대해 클러스터 안의 개별 마커도 확인할 수 있게 합니다.
export const focusMapPlace = (info) => {
  if (!map || !info) return false;
  const x = Number(info.x || info.mapx);
  const y = Number(info.y || info.mapy);
  if (!(124.5 <= x && x <= 132 && 33 <= y && y <= 38.6)) return false;
  const coords = new kakao.maps.LatLng(y, x);
  map.setLevel(Math.min(map.getLevel(), 4));
  map.setCenter(coords);
  infoWindows.forEach((infoWindow) => infoWindow.close());
  const index = markerPlaces.findIndex((place) => place === info ||
    (info.contentid != null && String(place.contentid) === String(info.contentid)));
  if (index !== -1) infoWindows[index].open(map, markers[index]);
  return true;
};

// 실제 마커를 등록하고 경계를 확장하는 함수
const setOverlay = (info, bounds, number = null) => {
  const coords = new kakao.maps.LatLng(info.y, info.x);
  bounds.extend(coords);
  const options = { position: coords };
  if (number != null) {
    const size = Math.max(9, 15 - Math.max(0, String(number).length - 2) * 2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><path d="M20 46C15 38 2 28 2 20a18 18 0 1 1 36 0c0 8-13 18-18 26Z" fill="#3182f6" stroke="white" stroke-width="2"/><text x="20" y="25" text-anchor="middle" font-family="sans-serif" font-size="${size}" font-weight="700" fill="white">${number}</text></svg>`;
    options.image = new kakao.maps.MarkerImage(`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, new kakao.maps.Size(40, 48), { offset: new kakao.maps.Point(20, 48) });
    options.title = `${number}. ${info.title || info.label || "장소"}`;
  }
  const marker = new kakao.maps.Marker(options);
  markers.push(marker);

  // https://apis.map.kakao.com/web/sample/addMarkerMouseEvent/
  // 마커에 커서가 오버됐을 때 마커 위에 표시할 인포윈도우를 생성합니다
  const iwContent = document.createElement("div");
  iwContent.className = "map-marker-title text-truncate";
  iwContent.textContent = info.label;
  iwContent.title = info.label || "";

  // 인포윈도우를 생성합니다
  const infowindow = new kakao.maps.InfoWindow({
    content: iwContent,
  });
  infoWindows.push(infowindow);
  markerPlaces.push(info);

  // 마커에 마우스오버 이벤트를 등록합니다
  kakao.maps.event.addListener(marker, "mouseover", function () {
    // 마커에 마우스오버 이벤트가 발생하면 인포윈도우를 마커위에 표시합니다
    infowindow.open(map, marker);
  });

  // 마커에 마우스아웃 이벤트를 등록합니다
  kakao.maps.event.addListener(marker, "mouseout", function () {
    // 마커에 마우스아웃 이벤트가 발생하면 인포윈도우를 제거합니다
    infowindow.close();
  });

  // 상세 창의 표시와 향후 데이터 연동은 별도 UI 모듈에서 담당합니다.
  kakao.maps.event.addListener(marker, "click", function () {
    infowindow.close();
    document.dispatchEvent(new CustomEvent("enjoytrip:place-selected", {
      detail: info,
    }));
  });
};
