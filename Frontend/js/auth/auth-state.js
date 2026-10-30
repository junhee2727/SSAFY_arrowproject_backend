import { clearCurrentUser, loadCurrentUser, setCurrentUser } from "./auth-storage.js";

export function updateAuthUI(user) {
  const guestMenu = document.querySelector("[data-auth-guest]");
  const userMenu = document.querySelector("[data-auth-user]");
  const userName = document.querySelector("[data-user-name]");
  if (!guestMenu || !userMenu || !userName) return;
  guestMenu.hidden = Boolean(user);
  userMenu.hidden = !user;
  userName.textContent = user?.name ?? "";
}

export function notifyAuthChange(user) {
  setCurrentUser(user);
  updateAuthUI(user);
  document.dispatchEvent(new CustomEvent("auth:state-changed", { detail: { user } }));
}

export async function initAuthState() {
  const status = document.querySelector("#auth-status-message");
  document.addEventListener("auth:expired", () => notifyAuthChange(null));
  const logoutButton = document.querySelector("[data-logout]");
  logoutButton?.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
      await clearCurrentUser();
      notifyAuthChange(null);
      if (status) status.hidden = true;
    } catch (error) {
      if (status) { status.textContent = error.message; status.hidden = false; }
    } finally { logoutButton.disabled = false; }
  });
  try {
    updateAuthUI(await loadCurrentUser());
  } catch (error) {
    updateAuthUI(null);
    if (status) { status.textContent = error.message; status.hidden = false; }
  }
}
