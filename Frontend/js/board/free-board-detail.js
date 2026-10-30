import { getFreePost, deleteFreePost } from "./board-api.js";
import { CATEGORY_LABELS, createMetaItem, formatDate, openLoginModal, renderParagraphs } from "./board-ui.js";

export function initFreeBoardDetail() {
  const id = new URLSearchParams(window.location.search).get("id");
  const article = document.querySelector("#free-board-detail");
  const notFound = document.querySelector("#free-board-not-found");
  const actions = document.querySelector("#free-board-detail-actions");
  const owner = document.querySelector("#post-owner-actions");
  const message = document.querySelector("#board-detail-message");
  const retry = document.querySelector("#board-detail-retry");
  const remove = document.querySelector("#post-delete-button");
  if (!article) return;
  let generation = 0;
  async function load() {
    const request = ++generation;
    message.textContent = "게시글을 불러오는 중입니다.";
    retry.hidden = true;
    owner.hidden = true;
    try {
      if (!id) { notFound.hidden = false; article.hidden = true; actions.hidden = true; message.textContent = ""; return; }
      const post = await getFreePost(id);
      if (request !== generation) return;
      article.hidden = false;
      actions.hidden = false;
      notFound.hidden = true;
      document.querySelector("#free-board-detail-category").textContent = CATEGORY_LABELS[post.category];
      document.querySelector("#free-board-detail-title").textContent = post.title;
      document.querySelector("#free-board-detail-meta").replaceChildren(
        createMetaItem("작성자", post.authorName),
        createMetaItem(post.updatedAt ? "수정일" : "작성일", formatDate(post.updatedAt ?? post.createdAt)),
      );
      renderParagraphs(document.querySelector("#free-board-detail-body"), post.content);
      document.title = `${post.title} · 푸른 하늘 여행`;
      owner.hidden = !post.canEdit;
      document.querySelector("#post-edit-button").href = `./free-board-write.html?id=${encodeURIComponent(post.id)}`;
      message.textContent = "";
    } catch (error) {
      if (request !== generation) return;
      if (error.status === 404) {
        notFound.hidden = false; article.hidden = true; actions.hidden = true; message.textContent = "";
      } else { message.textContent = error.message; retry.hidden = false; }
    }
  }
  remove.addEventListener("click", async () => {
    if (!confirm("게시글을 삭제할까요? 삭제한 글은 복구할 수 없습니다.")) return;
    remove.disabled = true;
    try {
      await deleteFreePost(id);
      window.location.replace("./free-board.html");
    } catch (error) {
      message.textContent = error.message;
      if (error.status === 401) openLoginModal();
      if (error.status === 404) load();
    } finally { remove.disabled = false; }
  });
  retry.addEventListener("click", load);
  document.addEventListener("auth:state-changed", load);
  window.addEventListener("pageshow", (event) => { if (event.persisted) load(); });
  load();
}
