const moduleUrl = new URL(import.meta.url);
const isLiveServer = moduleUrl.protocol === "http:" && moduleUrl.port === "5500"
  && ["127.0.0.1", "localhost"].includes(moduleUrl.hostname);
const API_BASE = isLiveServer
  ? new URL(`http://${moduleUrl.hostname}:8080/enjoytrip/api/`)
  : new URL("../api/", moduleUrl);

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export async function apiRequest(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (method !== "GET") headers["X-Requested-With"] = "EnjoyTrip";
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(new URL(path, API_BASE), {
      method,
      credentials: "include",
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.", "NETWORK_ERROR", 0);
  }
  if (response.status === 204) return null;
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("서버 응답을 확인하지 못했습니다. Tomcat 실행 상태와 API 주소를 확인해주세요.", "INVALID_RESPONSE", response.status);
  }
  if (!response.ok) {
    if (payload.error?.code === "LOGIN_REQUIRED") {
      document.dispatchEvent(new CustomEvent("auth:expired"));
    }
    throw new ApiError(payload.error?.message ?? "요청을 처리하지 못했습니다.", payload.error?.code ?? "REQUEST_FAILED", response.status);
  }
  return payload.data;
}
