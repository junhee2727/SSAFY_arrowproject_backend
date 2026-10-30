// 정적 서버에서 제공하는 .env에는 브라우저에서 사용할 공개 API 키만 저장합니다.
async function loadKeys() {
  let response;
  try {
    // HTML의 위치와 관계없이 프로젝트 루트의 .env를 읽습니다.
    response = await fetch(new URL("../config.env", import.meta.url), { cache: "no-store" });
  } catch {
    throw new Error(".env 파일을 불러오지 못했습니다. HTTP 서버로 페이지를 실행해주세요.");
  }

  if (!response.ok) {
    throw new Error(`.env 파일을 불러오지 못했습니다. 파일 위치와 서버 설정을 확인해주세요. (HTTP ${response.status})`);
  }

  const env = {};
  const source = await response.text();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?(DATA_GO_KR_API_KEY|KAKAO_MAP_KEY|KAKAO_REST_API_KEY|KMA_SERVICE_KEY)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^#'"]*?))\s*(?:#.*)?$/);
    if (match) {
      env[match[1]] = match[2] ?? match[3] ?? match[4].trim();
    }
  }

  // 지도와 관광지 조회에 필요한 키만 필수로 검사합니다.
  // 경로·날씨 키가 없으면 해당 부가 기능만 안내 상태를 표시합니다.
  const missingKeys = ["DATA_GO_KR_API_KEY", "KAKAO_MAP_KEY"].filter((name) => !env[name]?.trim());
  if (missingKeys.length) {
    throw new Error(`.env에 다음 키를 입력해주세요: ${missingKeys.join(", ")}`);
  }

  return env;
}

// 로딩이 끝난 뒤 다른 모듈이 실행되므로 기존 import를 그대로 사용할 수 있습니다.
const {
  DATA_GO_KR_API_KEY,
  KAKAO_MAP_KEY,
  KAKAO_REST_API_KEY,
  KMA_SERVICE_KEY,
} = await loadKeys();

export {
  DATA_GO_KR_API_KEY,
  KAKAO_MAP_KEY,
  KAKAO_REST_API_KEY,
  KMA_SERVICE_KEY,
};
