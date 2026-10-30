import { apiRequest } from "../api.js";

export function searchPosts({ page = 1, type = "all", keyword = "" } = {}) {
  return apiRequest(`posts?${new URLSearchParams({ page, type, keyword })}`);
}
export function getFreePost(id) {
  return apiRequest(`posts/${encodeURIComponent(id)}`);
}
export function createFreePost(values) {
  return apiRequest("posts", { method: "POST", body: values });
}
export function updateFreePost(id, values) {
  return apiRequest(`posts/${encodeURIComponent(id)}`, { method: "PUT", body: values });
}
export function deleteFreePost(id) {
  return apiRequest(`posts/${encodeURIComponent(id)}`, { method: "DELETE" });
}
