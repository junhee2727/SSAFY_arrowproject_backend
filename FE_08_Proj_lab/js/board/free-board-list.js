import { getCurrentUser } from "../auth/auth-storage.js";
import { getFreePosts } from "./board-storage.js";
import {
  CATEGORY_LABELS,
  formatDate,
  getPageNumber,
  openLoginModal,
  paginate,
  renderPagination,
  setUrlPage,
} from "./board-ui.js";

const PAGE_SIZE = 7;

function matchesSearch(post, type, keyword) {
  if (!keyword) return true;

  const normalizedKeyword = keyword.toLocaleLowerCase("ko-KR");
  const fields = {
    title: post.title,
    author: post.authorName,
    all: `${post.title} ${post.content}`,
  };

  return String(fields[type] ?? fields.all)
    .toLocaleLowerCase("ko-KR")
    .includes(normalizedKeyword);
}

function createPostRow(post) {
  const row = document.createElement("tr");
  const numberCell = document.createElement("td");
  const categoryCell = document.createElement("td");
  const titleCell = document.createElement("td");
  const authorCell = document.createElement("td");
  const dateCell = document.createElement("td");
  const viewsCell = document.createElement("td");
  const category = document.createElement("span");
  const titleLink = document.createElement("a");

  numberCell.textContent = post.sequence;
  category.className = "board-category";
  category.textContent = CATEGORY_LABELS[post.category] ?? "자유";
  categoryCell.append(category);

  titleCell.className = "board-title-cell";
  titleLink.className = "board-title-link";
  titleLink.href = `./free-board-detail.html?id=${encodeURIComponent(post.id)}`;
  titleLink.textContent = post.title;
  titleCell.append(titleLink);

  const commentCount = post.comments?.length ?? 0;
  if (commentCount > 0) {
    const commentBadge = document.createElement("span");
    commentBadge.className = "comment-count";
    commentBadge.textContent = `[${commentCount}]`;
    titleCell.append(commentBadge);
  }

  authorCell.textContent = post.authorName;
  dateCell.textContent = formatDate(post.createdAt);
  viewsCell.textContent = post.views ?? 0;
  row.append(numberCell, categoryCell, titleCell, authorCell, dateCell, viewsCell);
  return row;
}

export function initFreeBoardList() {
  const tableBody = document.querySelector("#free-board-body");
  const countElement = document.querySelector("#free-board-count");
  const paginationElement = document.querySelector("#free-board-pagination");
  const searchForm = document.querySelector("#free-board-search-form");
  const searchType = document.querySelector("#free-board-search-type");
  const searchKeyword = document.querySelector("#free-board-search-keyword");
  const writeButton = document.querySelector("#free-board-write-button");

  if (!tableBody || !countElement || !paginationElement || !searchForm) return;

  const initialParams = new URLSearchParams(window.location.search);
  searchType.value = initialParams.get("type") ?? "all";
  searchKeyword.value = initialParams.get("keyword") ?? "";

  function render(requestedPage = getPageNumber(new URLSearchParams(window.location.search))) {
    const type = searchType.value;
    const keyword = searchKeyword.value.trim();
    const filteredPosts = getFreePosts().filter((post) => matchesSearch(post, type, keyword));
    const pageData = paginate(filteredPosts, requestedPage, PAGE_SIZE);

    tableBody.replaceChildren();
    countElement.textContent = String(filteredPosts.length);

    if (pageData.items.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.className = "board-empty";
      cell.colSpan = 6;
      cell.textContent = keyword ? "검색 결과가 없습니다." : "아직 작성된 게시글이 없습니다.";
      row.append(cell);
      tableBody.append(row);
    } else {
      pageData.items.forEach((post) => tableBody.append(createPostRow(post)));
    }

    renderPagination(paginationElement, pageData.page, pageData.totalPages, (page) => {
      setUrlPage(page);
      render(page);
      document.querySelector("#free-board")?.focus();
    });
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const url = new URL(window.location.href);
    const keyword = searchKeyword.value.trim();

    url.searchParams.set("type", searchType.value);
    if (keyword) url.searchParams.set("keyword", keyword);
    else url.searchParams.delete("keyword");
    url.searchParams.set("page", "1");
    window.history.replaceState({}, "", url);
    render(1);
  });

  writeButton?.addEventListener("click", (event) => {
    if (getCurrentUser()) return;

    event.preventDefault();
    openLoginModal();
  });

  render();
}
