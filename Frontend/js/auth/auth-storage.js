import { apiRequest } from "../api.js";

// 화면 표시용 메모리 캐시. 인증 여부는 항상 서버 세션이 결정합니다.
let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
}

export async function loadCurrentUser() {
  try {
    currentUser = await apiRequest("members/me");
  } catch (error) {
    currentUser = null;
    if (error.status !== 401) throw error;
  }
  return currentUser;
}

export function registerUser(values) {
  return apiRequest("members/register", { method: "POST", body: values });
}

export function resetPassword(values) {
  return apiRequest("auth/password-reset", { method: "POST", body: values });
}

export async function authenticateUser(email, password) {
  currentUser = await apiRequest("auth/login", { method: "POST", body: { email, password } });
  return currentUser;
}

export async function updateUserName(name) {
  currentUser = await apiRequest("members/me", { method: "PUT", body: { name } });
  return currentUser;
}

export async function deleteUserAccount() {
  await apiRequest("members/me", { method: "DELETE" });
  currentUser = null;
}

export async function clearCurrentUser() {
  await apiRequest("auth/logout", { method: "POST" });
  currentUser = null;
}
