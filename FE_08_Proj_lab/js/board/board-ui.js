export const CATEGORY_LABELS = {
  review: "여행 후기",
  question: "질문",
  info: "정보 공유",
  food: "맛집",
  companion: "동행",
  free: "자유",
};

export function formatDate(dateValue) {
  if (!dateValue) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateValue)).replaceAll(". ", ".").replace(/\.$/, "");
}

export function formatDateTime(dateValue) {
  if (!dateValue) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateValue));
}

export function getPageNumber(searchParams) {
  const page = Number(searchParams.get("page"));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function paginate(items, requestedPage, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    page,
    totalPages,
    items: items.slice(startIndex, startIndex + pageSize),
  };
}

export function renderPagination(container, page, totalPages, onSelectPage) {
  container.replaceChildren();

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);

  pages.push({ label: "‹", page: page - 1, disabled: page === 1, ariaLabel: "이전 페이지" });

  for (let currentPage = Math.max(1, end - 4); currentPage <= end; currentPage += 1) {
    pages.push({ label: String(currentPage), page: currentPage, current: currentPage === page });
  }

  pages.push({ label: "›", page: page + 1, disabled: page === totalPages, ariaLabel: "다음 페이지" });

  pages.forEach((item) => {
    const listItem = document.createElement("li");
    const control = document.createElement(item.disabled ? "span" : "button");
    control.className = `board-page-link${item.disabled ? " is-disabled" : ""}`;
    control.textContent = item.label;

    if (item.ariaLabel) control.setAttribute("aria-label", item.ariaLabel);
    if (item.current) control.setAttribute("aria-current", "page");

    if (!item.disabled) {
      control.type = "button";
      control.addEventListener("click", () => onSelectPage(item.page));
    }

    listItem.append(control);
    container.append(listItem);
  });
}

export function createMetaItem(label, value) {
  const item = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = label;
  item.append(strong, ` ${value}`);
  return item;
}

export function renderParagraphs(container, content) {
  container.replaceChildren();

  String(content)
    .split(/\n{2,}/)
    .filter(Boolean)
    .forEach((paragraphText) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = paragraphText;
      container.append(paragraph);
    });
}

export function setUrlPage(page) {
  const url = new URL(window.location.href);
  url.searchParams.set("page", String(page));
  window.history.replaceState({}, "", url);
}

export function openLoginModal() {
  const loginModal = document.querySelector("#login-modal");

  if (loginModal && !loginModal.open) {
    loginModal.showModal();
  }
}
