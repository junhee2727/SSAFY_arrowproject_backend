import { getCurrentUser } from "../auth/auth-storage.js";
import { searchPosts } from "./board-api.js";
import { CATEGORY_LABELS, formatDate, getPageNumber, openLoginModal, renderPagination } from "./board-ui.js";

export function initFreeBoardList() {
  const body = document.querySelector("#free-board-body");
  const count = document.querySelector("#free-board-count");
  const pagination = document.querySelector("#free-board-pagination");
  const form = document.querySelector("#free-board-search-form");
  const type = document.querySelector("#free-board-search-type");
  const keyword = document.querySelector("#free-board-search-keyword");
  if (!body || !form) return;
  const params = new URLSearchParams(window.location.search);
  type.value = ["all", "title", "author"].includes(params.get("type")) ? params.get("type") : "all";
  keyword.value = params.get("keyword") ?? "";
  let generation = 0;

  function message(text, retry = false) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "board-empty";
    cell.textContent = text;
    if (retry) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-outline-primary btn-sm ms-2";
      button.textContent = "다시 시도";
      button.addEventListener("click", () => render());
      cell.append(button);
    }
    row.append(cell);
    body.replaceChildren(row);
  }
  function row(post) {
    const item = document.createElement("tr");
    [post.sequence, CATEGORY_LABELS[post.category] ?? "자유", post.title, post.authorName, formatDate(post.createdAt)].forEach((text, index) => {
      const cell = document.createElement("td");
      if (index === 2) {
        cell.className = "board-title-cell";
        const link = document.createElement("a");
        link.className = "board-title-link";
        link.href = `./free-board-detail.html?id=${encodeURIComponent(post.id)}`;
        link.textContent = text;
        cell.append(link);
      } else {
        cell.textContent = text;
        if (index === 3) { cell.className = "board-author-cell"; cell.title = text; }
      }
      item.append(cell);
    });
    return item;
  }
  async function render(page = getPageNumber(new URLSearchParams(window.location.search))) {
    const request = ++generation;
    const query = { page, type: type.value, keyword: keyword.value.trim() };
    message("게시글을 불러오는 중입니다.");
    pagination.replaceChildren();
    count.textContent = "—";
    try {
      const result = await searchPosts(query);
      if (request !== generation) return;
      count.textContent = String(result.totalItems);
      if (!result.items.length) message(query.keyword ? "검색 결과가 없습니다." : "아직 작성된 게시글이 없습니다.");
      else body.replaceChildren(...result.items.map(row));
      const url = new URL(window.location.href);
      url.searchParams.set("page", String(result.page));
      url.searchParams.set("type", query.type);
      if (query.keyword) url.searchParams.set("keyword", query.keyword);
      else url.searchParams.delete("keyword");
      window.history.replaceState({}, "", url);
      renderPagination(pagination, result.page, result.totalPages, (next) => {
        render(next);
        document.querySelector("#free-board").focus();
      });
    } catch (error) {
      if (request !== generation) return;
      message(error.message, true);
    }
  }
  form.addEventListener("submit", (event) => { event.preventDefault(); render(1); });
  document.querySelector("#free-board-write-button")?.addEventListener("click", (event) => {
    if (getCurrentUser()) return;
    event.preventDefault();
    openLoginModal();
  });
  window.addEventListener("pageshow", (event) => { if (event.persisted) render(); });
  render();
}
