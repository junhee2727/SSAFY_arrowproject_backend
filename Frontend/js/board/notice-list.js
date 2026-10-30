import { getNotices } from "./board-storage.js";
import {
  formatDate,
  getPageNumber,
  paginate,
  renderPagination,
  setUrlPage,
} from "./board-ui.js";

const PAGE_SIZE = 7;

function matchesSearch(notice, type, keyword) {
  if (!keyword) return true;

  const normalizedKeyword = keyword.toLocaleLowerCase("ko-KR");
  const fields = {
    title: notice.title,
    content: notice.content,
    all: `${notice.title} ${notice.content}`,
  };

  return String(fields[type] ?? fields.all)
    .toLocaleLowerCase("ko-KR")
    .includes(normalizedKeyword);
}

function createNoticeRow(notice) {
  const row = document.createElement("tr");
  const numberCell = document.createElement("td");
  const titleCell = document.createElement("td");
  const dateCell = document.createElement("td");
  const viewsCell = document.createElement("td");
  const titleLink = document.createElement("a");

  if (notice.pinned) {
    row.className = "notice-row-pinned";
    const badge = document.createElement("span");
    badge.className = "notice-badge";
    badge.textContent = notice.badge ?? "공지";
    numberCell.append(badge);
  } else {
    numberCell.textContent = notice.sequence;
  }

  titleCell.className = "board-title-cell";
  titleLink.className = "board-title-link";
  titleLink.href = `./notice-detail.html?id=${encodeURIComponent(notice.id)}`;
  titleLink.textContent = notice.title;
  titleCell.append(titleLink);
  dateCell.textContent = formatDate(notice.createdAt);
  viewsCell.textContent = notice.views ?? 0;
  row.append(numberCell, titleCell, dateCell, viewsCell);
  return row;
}

export function initNoticeList() {
  const tableBody = document.querySelector("#notice-board-body");
  const countElement = document.querySelector("#notice-count");
  const paginationElement = document.querySelector("#notice-pagination");
  const searchForm = document.querySelector("#notice-search-form");
  const searchType = document.querySelector("#notice-search-type");
  const searchKeyword = document.querySelector("#notice-search-keyword");

  if (!tableBody || !countElement || !paginationElement || !searchForm) return;

  const initialParams = new URLSearchParams(window.location.search);
  searchType.value = initialParams.get("type") ?? "all";
  searchKeyword.value = initialParams.get("keyword") ?? "";

  function render(requestedPage = getPageNumber(new URLSearchParams(window.location.search))) {
    const type = searchType.value;
    const keyword = searchKeyword.value.trim();
    const filteredNotices = getNotices().filter((notice) => matchesSearch(notice, type, keyword));
    const pageData = paginate(filteredNotices, requestedPage, PAGE_SIZE);

    tableBody.replaceChildren();
    countElement.textContent = String(filteredNotices.length);

    if (pageData.items.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.className = "board-empty";
      cell.colSpan = 4;
      cell.textContent = "검색 결과가 없습니다.";
      row.append(cell);
      tableBody.append(row);
    } else {
      pageData.items.forEach((notice) => tableBody.append(createNoticeRow(notice)));
    }

    renderPagination(paginationElement, pageData.page, pageData.totalPages, (page) => {
      setUrlPage(page);
      render(page);
      document.querySelector("#notice-board")?.focus();
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

  render();
}
