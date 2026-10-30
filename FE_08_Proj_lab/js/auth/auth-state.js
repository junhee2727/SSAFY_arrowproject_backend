import { clearCurrentUser, getCurrentUser } from "./auth-storage.js";

export function updateAuthUI(user) {
  const guestMenu = document.querySelector("[data-auth-guest]")
  const userMenu = document.querySelector("[data-auth-user]")
  const userName = document.querySelector("[data-user-name]")

  if(!guestMenu || !userMenu || !userName) {
    return;
  }

   const isLoggedIn = Boolean(user);

   guestMenu.hidden = isLoggedIn;
   userMenu.hidden = !isLoggedIn;
   userName.textContent = user?.name ?? "";
}

export function initAuthState() {
  const savedUser = getCurrentUser();
  const logoutButton = document.querySelector("[data-logout]");

  updateAuthUI(savedUser);

  logoutButton?.addEventListener("click", () => {
    clearCurrentUser();
    updateAuthUI(null);
    document.dispatchEvent(new CustomEvent("auth:state-changed", { detail: { user: null } }));
  });
}
