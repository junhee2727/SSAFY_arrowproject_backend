import { getCurrentUser } from "../auth/auth-storage.js";
import {
  addComment,
  deleteComment,
  deleteFreePost,
  getFreePost,
  getFreePosts,
  incrementFreePostViews,
} from "./board-storage.js";
import {
  CATEGORY_LABELS,
  createMetaItem,
  formatDate,
  formatDateTime,
  openLoginModal,
  renderParagraphs,
} from "./board-ui.js";

function createNavigationRow(label, post) {
  const row = document.createElement("div");
  const labelElement = document.createElement("span");
  const titleElement = document.createElement(post ? "a" : "span");
  const dateElement = document.createElement("span");

  row.className = "post-navigation-row";
  labelElement.className = "post-navigation-label";
  labelElement.textContent = label;
  titleElement.className = "post-navigation-title";
  dateElement.className = "post-navigation-date";

  if (post) {
    titleElement.href = `./free-board-detail.html?id=${encodeURIComponent(post.id)}`;
    titleElement.textContent = post.title;
    dateElement.textContent = formatDate(post.createdAt);
  } else {
    titleElement.textContent = `${label}이 없습니다.`;
  }

  row.append(labelElement, titleElement, dateElement);
  return row;
}

export function initFreeBoardDetail() {
  const params = new URLSearchParams(window.location.search);
  const requestedId = params.get("id");
  const posts = getFreePosts();
  const postId = requestedId ?? posts[0]?.id;
  let post = postId ? getFreePost(postId) : null;
  const article = document.querySelector("#free-board-detail");
  const notFound = document.querySelector("#free-board-not-found");

  if (!post || !article) {
    article?.setAttribute("hidden", "");
    document.querySelector("#free-board-detail-actions")?.setAttribute("hidden", "");
    document.querySelector("#free-board-comments")?.setAttribute("hidden", "");
    notFound?.removeAttribute("hidden");
    return;
  }

  if (!requestedId) {
    const url = new URL(window.location.href);
    url.searchParams.set("id", post.id);
    window.history.replaceState({}, "", url);
  }

  const viewKey = `travel_viewed_${post.id}`;
  if (!sessionStorage.getItem(viewKey)) {
    post = incrementFreePostViews(post.id) ?? post;
    sessionStorage.setItem(viewKey, "true");
  }

  const categoryElement = document.querySelector("#free-board-detail-category");
  const titleElement = document.querySelector("#free-board-detail-title");
  const metaElement = document.querySelector("#free-board-detail-meta");
  const bodyElement = document.querySelector("#free-board-detail-body");
  const imageSection = document.querySelector("#free-board-images");
  const navigation = document.querySelector("#free-board-navigation");
  const ownerActions = document.querySelector("#post-owner-actions");
  const editButton = document.querySelector("#post-edit-button");
  const deleteButton = document.querySelector("#post-delete-button");
  const commentCount = document.querySelector("#comment-count");
  const commentList = document.querySelector("#comment-list");
  const commentForm = document.querySelector("#comment-form");
  const commentInput = document.querySelector("#comment-content");
  const commentMessage = document.querySelector("#comment-message");
  function renderPost() {
    categoryElement.textContent = CATEGORY_LABELS[post.category] ?? "자유";
    titleElement.textContent = post.title;
    metaElement.replaceChildren(
      createMetaItem("작성자", post.authorName),
      createMetaItem(post.updatedAt ? "수정일" : "작성일", formatDate(post.updatedAt ?? post.createdAt)),
      createMetaItem("조회", post.views ?? 0),
    );
    renderParagraphs(bodyElement, post.content);
    document.title = `${post.title} · 푸른 하늘 여행`;

    imageSection.replaceChildren();
    if (post.images?.length) {
      post.images.forEach((imageData, index) => {
        const link = document.createElement("a");
        const image = document.createElement("img");
        link.className = "post-image-link";
        link.href = imageData.dataUrl;
        link.target = "_blank";
        link.rel = "noopener";
        image.src = imageData.dataUrl;
        image.alt = `${post.title} 첨부 사진 ${index + 1}`;
        link.append(image);
        imageSection.append(link);
      });
      imageSection.removeAttribute("hidden");
    } else {
      imageSection.setAttribute("hidden", "");
    }

    const orderedPosts = getFreePosts();
    const currentIndex = orderedPosts.findIndex((item) => item.id === post.id);
    const newerPost = currentIndex > 0 ? orderedPosts[currentIndex - 1] : null;
    const olderPost = currentIndex >= 0 ? orderedPosts[currentIndex + 1] : null;
    navigation.replaceChildren(
      createNavigationRow("다음 글", newerPost),
      createNavigationRow("이전 글", olderPost),
    );

    const currentUser = getCurrentUser();
    const isOwner = Boolean(currentUser && currentUser.id === post.authorId);
    ownerActions.hidden = !isOwner;
    editButton.href = `./free-board-write.html?id=${encodeURIComponent(post.id)}`;
  }

  function renderComments() {
    const comments = post.comments ?? [];
    const currentUser = getCurrentUser();
    commentCount.textContent = String(comments.length);
    commentList.replaceChildren();

    if (comments.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "comment-empty";
      emptyItem.textContent = "첫 번째 댓글을 남겨보세요.";
      commentList.append(emptyItem);
      return;
    }

    comments.forEach((comment) => {
      const item = document.createElement("li");
      const header = document.createElement("div");
      const author = document.createElement("span");
      const date = document.createElement("span");
      const content = document.createElement("p");

      item.className = "comment-item";
      header.className = "comment-author";
      author.textContent = comment.authorName;
      date.className = "comment-date";
      date.textContent = formatDateTime(comment.createdAt);
      content.className = "comment-content";
      content.textContent = comment.content;
      header.append(author, date);

      if (currentUser?.id === comment.authorId) {
        const deleteCommentButton = document.createElement("button");
        deleteCommentButton.className = "comment-delete-button";
        deleteCommentButton.type = "button";
        deleteCommentButton.textContent = "삭제";
        deleteCommentButton.addEventListener("click", () => {
          if (!confirm("댓글을 삭제할까요?")) return;
          deleteComment(post.id, comment.id, currentUser.id);
          post = getFreePost(post.id);
          renderComments();
        });
        header.append(deleteCommentButton);
      }

      item.append(header, content);
      commentList.append(item);
    });
  }

  deleteButton.addEventListener("click", () => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.id !== post.authorId) return;
    if (!confirm("게시글을 삭제할까요? 삭제한 글은 복구할 수 없습니다.")) return;

    deleteFreePost(post.id, currentUser.id);
    window.location.replace("./free-board.html");
  });

  commentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    commentMessage.textContent = "";
    const user = getCurrentUser();
    const content = commentInput.value.trim();

    if (!user) {
      commentMessage.textContent = "댓글을 작성하려면 로그인이 필요합니다.";
      openLoginModal();
      return;
    }

    if (!content) {
      commentMessage.textContent = "댓글 내용을 입력해주세요.";
      commentInput.focus();
      return;
    }

    addComment(post.id, content, user);
    post = getFreePost(post.id);
    commentForm.reset();
    renderComments();
  });

  renderPost();
  renderComments();
}
