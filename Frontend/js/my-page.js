import { getCurrentUser, loadCurrentUser, updateUserName, deleteUserAccount } from "./auth/auth-storage.js";
import { notifyAuthChange } from "./auth/auth-state.js";
import { formatDate } from "./board/board-ui.js";

export function initMyPage() {
  const loginRequired = document.querySelector("#my-page-login-required");
  const content = document.querySelector("#my-page-content");
  const form = document.querySelector("#profile-form");
  const message = document.querySelector("#profile-message");
  if (!form) return;
  function render() {
    const user = getCurrentUser();
    loginRequired.hidden = Boolean(user);
    content.hidden = !user;
    if (!user) return;
    document.querySelector("#profile-name").value = user.name;
    document.querySelector("#profile-email").value = user.email;
    document.querySelector("#profile-created-at").value = formatDate(user.createdAt);
    document.querySelector("#profile-heading-name").textContent = `${user.name}님`;
    document.querySelector("#profile-avatar").textContent = user.name.charAt(0);
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    message.classList.remove("is-success");
    const name = document.querySelector("#profile-name").value.trim();
    if (name.length < 2 || name.length > 20) { message.textContent = "이름은 2자 이상 20자 이하로 입력해주세요."; return; }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      notifyAuthChange(await updateUserName(name));
      message.textContent = "회원정보가 수정되었습니다.";
      message.classList.add("is-success");
    } catch (error) { message.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  const remove = document.querySelector("#delete-account-button");
  remove.addEventListener("click", async () => {
    if (!confirm("계정과 작성한 게시글이 모두 삭제됩니다. 정말 삭제할까요?")) return;
    remove.disabled = true;
    try {
      await deleteUserAccount();
      notifyAuthChange(null);
      window.location.replace("./map.html");
    } catch (error) { message.textContent = error.message; }
    finally { remove.disabled = false; }
  });
  document.addEventListener("auth:state-changed", render);
  window.addEventListener("pageshow", async (event) => {
    if (!event.persisted) return;
    try { notifyAuthChange(await loadCurrentUser()); }
    catch (error) { message.textContent = error.message; }
  });
  render();
}
