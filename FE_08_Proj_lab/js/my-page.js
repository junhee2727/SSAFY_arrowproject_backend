import {
  deleteUserAccount,
  getCurrentUserProfile,
  updateUserName,
} from "./auth/auth-storage.js";
import { updateAuthUI } from "./auth/auth-state.js";
import {
  deleteComment,
  deleteFreePost,
  deleteUserContent,
  getFreePosts,
  updateAuthorName,
} from "./board/board-storage.js";
import {
  CATEGORY_LABELS,
  formatDate,
  formatDateTime,
} from "./board/board-ui.js";

function createAction(label, href, extraClass = "") {
  const action = document.createElement(href ? "a" : "button");
  action.className = `activity-action ${extraClass}`.trim();
  action.textContent = label;

  if (href) action.href = href;
  else action.type = "button";

  return action;
}

function createEmptyState(message) {
  const empty = document.createElement("p");
  empty.className = "activity-empty";
  empty.textContent = message;
  return empty;
}

export function initMyPage() {
  const loginRequired = document.querySelector("#my-page-login-required");
  const content = document.querySelector("#my-page-content");
  const profileForm = document.querySelector("#profile-form");
  const profileName = document.querySelector("#profile-name");
  const profileEmail = document.querySelector("#profile-email");
  const profileCreatedAt = document.querySelector("#profile-created-at");
  const profileHeadingName = document.querySelector("#profile-heading-name");
  const profileAvatar = document.querySelector("#profile-avatar");
  const profileMessage = document.querySelector("#profile-message");
  const passwordButton = document.querySelector("#profile-password-button");
  const postCount = document.querySelector("#my-post-count");
  const commentCount = document.querySelector("#my-comment-count");
  const viewCount = document.querySelector("#my-view-count");
  const postList = document.querySelector("#my-post-list");
  const commentList = document.querySelector("#my-comment-list");
  const deleteAccountButton = document.querySelector("#delete-account-button");

  if (!loginRequired || !content || !profileForm || !postList || !commentList) return;

  function getUserActivity(userId) {
    const allPosts = getFreePosts();
    const posts = allPosts.filter((post) => post.authorId === userId);
    const comments = allPosts.flatMap((post) => {
      return (post.comments ?? [])
        .filter((comment) => comment.authorId === userId)
        .map((comment) => ({ comment, post }));
    });

    return { posts, comments };
  }

  function renderPosts(posts, userId) {
    postList.replaceChildren();

    if (posts.length === 0) {
      postList.append(createEmptyState("아직 작성한 게시글이 없습니다."));
      return;
    }

    posts.forEach((post) => {
      const item = document.createElement("article");
      const main = document.createElement("div");
      const title = document.createElement("a");
      const meta = document.createElement("p");
      const actions = document.createElement("div");
      const detailAction = createAction("상세", `./free-board-detail.html?id=${encodeURIComponent(post.id)}`);
      const editAction = createAction("수정", `./free-board-write.html?id=${encodeURIComponent(post.id)}`);
      const deleteAction = createAction("삭제", null, "is-danger");

      item.className = "activity-item";
      main.className = "activity-main";
      title.className = "activity-title";
      title.href = `./free-board-detail.html?id=${encodeURIComponent(post.id)}`;
      title.textContent = post.title;
      meta.className = "activity-meta";
      meta.textContent = `${CATEGORY_LABELS[post.category] ?? "자유"} · ${formatDate(post.createdAt)} · 조회 ${post.views ?? 0} · 댓글 ${post.comments?.length ?? 0}`;
      actions.className = "activity-actions";

      deleteAction.addEventListener("click", () => {
        if (!confirm(`“${post.title}” 게시글을 삭제할까요?`)) return;

        deleteFreePost(post.id, userId);
        render();
      });

      main.append(title, meta);
      actions.append(detailAction, editAction, deleteAction);
      item.append(main, actions);
      postList.append(item);
    });
  }

  function renderComments(comments, userId) {
    commentList.replaceChildren();

    if (comments.length === 0) {
      commentList.append(createEmptyState("아직 작성한 댓글이 없습니다."));
      return;
    }

    comments.forEach(({ comment, post }) => {
      const item = document.createElement("article");
      const main = document.createElement("div");
      const title = document.createElement("a");
      const meta = document.createElement("p");
      const actions = document.createElement("div");
      const detailAction = createAction("게시글 보기", `./free-board-detail.html?id=${encodeURIComponent(post.id)}`);
      const deleteAction = createAction("삭제", null, "is-danger");

      item.className = "activity-item";
      main.className = "activity-main";
      title.className = "activity-title";
      title.href = `./free-board-detail.html?id=${encodeURIComponent(post.id)}`;
      title.textContent = comment.content;
      meta.className = "activity-meta";
      meta.textContent = `${post.title} · ${formatDateTime(comment.createdAt)}`;
      actions.className = "activity-actions";

      deleteAction.addEventListener("click", () => {
        if (!confirm("이 댓글을 삭제할까요?")) return;

        deleteComment(post.id, comment.id, userId);
        render();
      });

      main.append(title, meta);
      actions.append(detailAction, deleteAction);
      item.append(main, actions);
      commentList.append(item);
    });
  }

  function render() {
    const user = getCurrentUserProfile();
    const isLoggedIn = Boolean(user);

    loginRequired.hidden = isLoggedIn;
    content.hidden = !isLoggedIn;
    if (!user) return;

    const activity = getUserActivity(user.id);
    const totalViews = activity.posts.reduce((sum, post) => sum + (Number(post.views) || 0), 0);

    profileName.value = user.name;
    profileEmail.value = user.email;
    profileCreatedAt.value = user.createdAt ? formatDate(user.createdAt) : "가입일 정보 없음";
    profileHeadingName.textContent = `${user.name}님`;
    profileAvatar.textContent = user.name.trim().charAt(0) || "여";
    postCount.textContent = String(activity.posts.length);
    commentCount.textContent = String(activity.comments.length);
    viewCount.textContent = String(totalViews);
    renderPosts(activity.posts, user.id);
    renderComments(activity.comments, user.id);
  }

  profileName.addEventListener("input", () => {
    profileMessage.textContent = "";
    profileMessage.classList.remove("is-success");
  });

  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const user = getCurrentUserProfile();
    if (!user) return;

    const name = profileName.value.trim();
    profileMessage.classList.remove("is-success");

    if (name.length < 2 || name.length > 20) {
      profileMessage.textContent = "이름은 2자 이상 20자 이하로 입력해주세요.";
      profileName.focus();
      return;
    }

    try {
      const updatedUser = updateUserName(user.id, name);
      updateAuthorName(user.id, updatedUser.name);
      updateAuthUI(updatedUser);
      render();
      profileMessage.textContent = "회원정보가 수정되었습니다.";
      profileMessage.classList.add("is-success");
    } catch (error) {
      console.error(error);
      profileMessage.textContent = "회원정보를 수정하지 못했습니다.";
    }
  });

  passwordButton.addEventListener("click", () => {
    const user = getCurrentUserProfile();
    if (!user) return;

    const resetName = document.querySelector("#reset-name");
    const resetEmail = document.querySelector("#reset-email");
    if (resetName) resetName.value = user.name;
    if (resetEmail) resetEmail.value = user.email;
  });

  deleteAccountButton.addEventListener("click", () => {
    const user = getCurrentUserProfile();
    if (!user) return;

    const confirmed = confirm("계정을 삭제하면 작성한 게시글과 댓글도 모두 삭제됩니다. 정말 삭제할까요?");
    if (!confirmed) return;

    deleteUserContent(user.id);
    deleteUserAccount(user.id);
    updateAuthUI(null);
    window.location.replace("./map.html");
  });

  document.addEventListener("auth:state-changed", () => {
    profileMessage.textContent = "";
    render();
  });

  render();
}
