import {
  getNotice,
  getNotices,
  incrementNoticeViews,
} from "./board-storage.js";
import {
  createMetaItem,
  formatDate,
  renderParagraphs,
} from "./board-ui.js";

function createNavigationRow(label, notice) {
  const row = document.createElement("div");
  const labelElement = document.createElement("span");
  const titleElement = document.createElement(notice ? "a" : "span");
  const dateElement = document.createElement("span");

  row.className = "post-navigation-row";
  labelElement.className = "post-navigation-label";
  labelElement.textContent = label;
  titleElement.className = "post-navigation-title";
  dateElement.className = "post-navigation-date";

  if (notice) {
    titleElement.href = `./notice-detail.html?id=${encodeURIComponent(notice.id)}`;
    titleElement.textContent = notice.title;
    dateElement.textContent = formatDate(notice.createdAt);
  } else {
    titleElement.textContent = `${label}이 없습니다.`;
  }

  row.append(labelElement, titleElement, dateElement);
  return row;
}

export function initNoticeDetail() {
  const notices = getNotices();
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  const noticeId = requestedId ?? notices[0]?.id;
  let notice = noticeId ? getNotice(noticeId) : null;
  const article = document.querySelector("#notice-detail");
  const notFound = document.querySelector("#notice-not-found");

  if (!notice || !article) {
    article?.setAttribute("hidden", "");
    document.querySelector("#notice-detail-actions")?.setAttribute("hidden", "");
    notFound?.removeAttribute("hidden");
    return;
  }

  if (!requestedId) {
    const url = new URL(window.location.href);
    url.searchParams.set("id", notice.id);
    window.history.replaceState({}, "", url);
  }

  const viewKey = `travel_viewed_${notice.id}`;
  if (!sessionStorage.getItem(viewKey)) {
    notice = incrementNoticeViews(notice.id) ?? notice;
    sessionStorage.setItem(viewKey, "true");
  }

  const badge = document.querySelector("#notice-detail-badge");
  const title = document.querySelector("#notice-detail-title");
  const meta = document.querySelector("#notice-detail-meta");
  const body = document.querySelector("#notice-detail-body");
  const navigation = document.querySelector("#notice-navigation");

  badge.textContent = notice.badge ?? "공지";
  badge.hidden = !notice.badge;
  title.textContent = notice.title;
  meta.replaceChildren(
    createMetaItem("작성자", notice.authorName),
    createMetaItem("작성일", formatDate(notice.createdAt)),
    createMetaItem("조회", notice.views ?? 0),
  );
  renderParagraphs(body, notice.content);
  document.title = `${notice.title} · 푸른 하늘 여행`;

  const orderedNotices = getNotices();
  const currentIndex = orderedNotices.findIndex((item) => item.id === notice.id);
  const newerNotice = currentIndex > 0 ? orderedNotices[currentIndex - 1] : null;
  const olderNotice = currentIndex >= 0 ? orderedNotices[currentIndex + 1] : null;
  navigation.replaceChildren(
    createNavigationRow("다음 글", newerNotice),
    createNavigationRow("이전 글", olderNotice),
  );
}
