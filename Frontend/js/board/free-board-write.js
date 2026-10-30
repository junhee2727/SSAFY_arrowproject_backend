import { getCurrentUser } from "../auth/auth-storage.js";
import { createFreePost, getFreePost, updateFreePost } from "./board-api.js";
import { openLoginModal } from "./board-ui.js";

export function initFreeBoardWrite() {
  const form = document.querySelector("#free-board-write-form");
  if (!form) return;
  const category = document.querySelector("#post-category");
  const title = document.querySelector("#post-title");
  const content = document.querySelector("#post-content");
  const message = document.querySelector("#board-form-message");
  const submit = form.querySelector('[type="submit"]');
  const id = new URLSearchParams(window.location.search).get("id");
  const retry = document.querySelector("#board-write-retry");
  let ready = !id;
  let submitting = false;
  let canEdit = !id;
  let generation = 0;
  function counts() {
    document.querySelector("#post-title-count").textContent = `${title.value.length}/80`;
    document.querySelector("#post-content-count").textContent = `${content.value.length}/2,000`;
  }
  function availability() {
    submit.disabled = !ready || !canEdit || submitting || !getCurrentUser();
  }
  async function load(fill = true) {
    if (!id) { availability(); return; }
    const request = ++generation;
    ready = false;
    availability();
    retry.hidden = true;
    try {
      const post = await getFreePost(id);
      if (request !== generation) return;
      if (fill) { category.value = post.category; title.value = post.title; content.value = post.content; counts(); }
      canEdit = post.canEdit;
      ready = true;
      message.textContent = canEdit ? "" : "작성자만 게시글을 수정할 수 있습니다.";
    } catch (error) {
      if (request !== generation) return;
      message.textContent = error.message;
      retry.hidden = error.status === 404;
    } finally { availability(); }
  }
  if (id) {
    document.querySelector("#write-title").textContent = "게시글 수정";
    submit.textContent = "수정 완료";
    document.title = "푸른 하늘 여행 · 게시글 수정";
  }
  if (!getCurrentUser()) { message.textContent = "게시글을 작성하려면 먼저 로그인해주세요."; openLoginModal(); }
  title.addEventListener("input", counts);
  content.addEventListener("input", counts);
  retry.addEventListener("click", () => load());
  document.addEventListener("auth:state-changed", () => {
    if (id) load(false);
    else { availability(); message.textContent = getCurrentUser() ? "" : "로그인이 필요합니다."; }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    if (!getCurrentUser()) { message.textContent = "로그인이 필요합니다."; openLoginModal(); return; }
    if (!ready || !canEdit || submitting) return;
    if (!form.checkValidity() || !title.value.trim() || !content.value.trim()) {
      form.classList.add("was-validated");
      message.textContent = "분류, 제목, 내용을 모두 입력해주세요.";
      return;
    }
    submitting = true;
    availability();
    submit.textContent = id ? "수정 중..." : "등록 중...";
    try {
      const values = { category: category.value, title: title.value, content: content.value };
      const saved = id ? await updateFreePost(id, values) : await createFreePost(values);
      window.location.href = `./free-board-detail.html?id=${encodeURIComponent(saved.id)}`;
    } catch (error) {
      message.textContent = error.message;
      if (error.status === 401) openLoginModal();
    } finally { submitting = false; submit.textContent = id ? "수정 완료" : "게시글 등록"; availability(); }
  });
  counts();
  load();
}
