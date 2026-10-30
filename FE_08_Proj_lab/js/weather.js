import { KMA_SERVICE_KEY } from "./keys.js";

const WEATHER_ENDPOINT = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
const CACHE_PREFIX = "travel_current_weather_v1";
const CACHE_TTL = 10 * 60 * 1000;

const PRECIPITATION = {
  0: { label: "강수 없음", icon: "☀️" },
  1: { label: "비", icon: "🌧️" },
  2: { label: "비 또는 눈", icon: "🌨️" },
  3: { label: "눈", icon: "❄️" },
  5: { label: "빗방울", icon: "🌦️" },
  6: { label: "빗방울 또는 날림눈", icon: "🌨️" },
  7: { label: "날림눈", icon: "❄️" },
};

function decodeServiceKey(key) {
  const value = String(key ?? "").trim();
  if (!value) return "";

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// 기상청 단기예보의 5km DFS 격자로 위도와 경도를 변환합니다.
export function convertLatLonToGrid(latitude, longitude) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + Number(latitude) * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = Number(longitude) * DEGRAD - olon;

  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

function getObservationBase(now = new Date()) {
  // 매시 관측자료의 제공 지연을 고려해 40분 전의 정시를 사용합니다.
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 - 40 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  const hour = String(kst.getUTCHours()).padStart(2, "0");

  return {
    baseDate: `${year}${month}${day}`,
    baseTime: `${hour}00`,
  };
}

function getCachedWeather(cacheKey) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey));
    if (cached && Date.now() - cached.savedAt < CACHE_TTL) return cached.weather;
  } catch {
    try {
      sessionStorage.removeItem(cacheKey);
    } catch {
      // 저장소를 사용할 수 없어도 날씨 조회는 계속합니다.
    }
  }

  return null;
}

function saveCachedWeather(cacheKey, weather) {
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), weather }));
  } catch {
    // 저장 공간을 사용할 수 없어도 최신 날씨 표시는 계속합니다.
  }
}

function getWindDirection(degree) {
  const directions = ["북", "북북동", "북동", "동북동", "동", "동남동", "남동", "남남동", "남", "남남서", "남서", "서남서", "서", "서북서", "북서", "북북서"];
  const numericDegree = Number(degree);
  if (!Number.isFinite(numericDegree)) return "-";
  return directions[Math.floor((numericDegree + 11.25) / 22.5) % 16];
}

function parseWeather(items, baseDate, baseTime) {
  const values = Object.fromEntries(items.map((item) => [item.category, item.obsrValue]));
  const precipitation = PRECIPITATION[Number(values.PTY)] ?? PRECIPITATION[0];

  return {
    temperature: values.T1H ?? "-",
    humidity: values.REH ?? "-",
    rainfall: values.RN1 ?? "-",
    windSpeed: values.WSD ?? "-",
    windDirection: getWindDirection(values.VEC),
    condition: precipitation.label,
    icon: precipitation.icon,
    observedAt: `${baseDate.slice(4, 6)}.${baseDate.slice(6, 8)} ${baseTime.slice(0, 2)}:${baseTime.slice(2)}`,
  };
}

export async function getCurrentWeather({ latitude, longitude, signal }) {
  const serviceKey = decodeServiceKey(KMA_SERVICE_KEY);
  if (!serviceKey) throw new Error("WEATHER_KEY_MISSING");

  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("WEATHER_COORDINATES_MISSING");

  const { nx, ny } = convertLatLonToGrid(lat, lon);
  const { baseDate, baseTime } = getObservationBase();
  const cacheKey = `${CACHE_PREFIX}_${nx}_${ny}_${baseDate}_${baseTime}`;
  const cachedWeather = getCachedWeather(cacheKey);
  if (cachedWeather) return cachedWeather;

  const params = new URLSearchParams({
    serviceKey,
    pageNo: "1",
    numOfRows: "20",
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  });
  const response = await fetch(`${WEATHER_ENDPOINT}?${params}`, { signal });

  if (!response.ok) throw new Error(`WEATHER_HTTP_${response.status}`);

  const payload = await response.json();
  const resultCode = payload?.response?.header?.resultCode;
  if (String(resultCode) !== "00") {
    throw new Error(`WEATHER_API_${resultCode ?? "UNKNOWN"}`);
  }

  const rawItems = payload?.response?.body?.items?.item ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  if (items.length === 0) throw new Error("WEATHER_EMPTY");

  const weather = parseWeather(items, baseDate, baseTime);
  saveCachedWeather(cacheKey, weather);
  return weather;
}
