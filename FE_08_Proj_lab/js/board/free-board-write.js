import { getCurrentUser } from "../auth/auth-storage.js";
import {
  createFreePost,
  getFreePost,
  updateFreePost,
} from "./board-storage.js";
import { openLoginModal } from "./board-ui.js";

const MAX_IMAGE_COUNT = 3;
const MAX_IMAGE_SIZE = 700 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function readImages(fileList) {
  const files = [...fileList];

  if (files.length > MAX_IMAGE_COUNT) {
    throw new Error("TOO_MANY_IMAGES");
  }

  if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  return Promise.all(files.map(async (file) => ({
    name: file.name,
    type: file.type,
    dataUrl: await readFileAsDataUrl(file),
  })));
}

export function initFreeBoardWrite() {
  const form = document.querySelector("#free-board-write-form");
  const categoryInput = document.querySelector("#post-category");
  const titleInput = document.querySelector("#post-title");
  const contentInput = document.querySelector("#post-content");
  const imageInput = document.querySelector("#post-images");
  const formMessage = document.querySelector("#board-form-message");
  const submitButton = form?.querySelector('[type="submit"]');
  const pageTitle = document.querySelector("#write-title");
  const titleCount = document.querySelector("#post-title-count");
  const contentCount = document.querySelector("#post-content-count");

  if (!form || !categoryInput || !titleInput || !contentInput || !imageInput) return;

  const postId = new URLSearchParams(window.location.search).get("id");
  const editingPost = postId ? getFreePost(postId) : null;
  const initialUser = getCurrentUser();

  function showMessage(message, isError = true) {
    formMessage.textContent = message;
    formMessage.classList.toggle("is-success", !isError);
  }

  function updateCounts() {
    titleCount.textContent = `${titleInput.value.length}/80`;
    contentCount.textContent = `${contentInput.value.length}/2,000`;
  }

  if (postId && !editingPost) {
    alert("수정할 게시글을 찾을 수 없습니다.");
    window.location.replace("./free-board.html");
    return;
  }

  if (editingPost) {
    if (!initialUser || initialUser.id !== editingPost.authorId) {
      alert("작성자만 게시글을 수정할 수 있습니다.");
      window.location.replace(`./free-board-detail.html?id=${encodeURIComponent(editingPost.id)}`);
      return;
    }

    categoryInput.value = editingPost.category;
    titleInput.value = editingPost.title;
    contentInput.value = editingPost.content;
    pageTitle.textContent = "게시글 수정";
    submitButton.textContent = "수정 완료";
    document.title = "푸른 하늘 여행 · 게시글 수정";

    if (editingPost.images?.length) {
      showMessage(`기존 사진 ${editingPost.images.length}장이 있습니다. 새 사진을 선택하면 기존 사진이 교체됩니다.`, false);
    }
  } else if (!initialUser) {
    showMessage("게시글을 작성하려면 먼저 로그인해주세요.");
    openLoginModal();
  }

  titleInput.addEventListener("input", updateCounts);
  contentInput.addEventListener("input", updateCounts);
  updateCounts();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.textContent = "";

    const user = getCurrentUser();
    if (!user) {
      showMessage("게시글을 등록하려면 로그인이 필요합니다.");
      openLoginModal();
      return;
    }

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      showMessage("분류, 제목, 내용을 모두 입력해주세요.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = editingPost ? "수정 중..." : "등록 중...";

    try {
      const selectedImages = imageInput.files.length
        ? await readImages(imageInput.files)
        : (editingPost?.images ?? []);
      const values = {
        category: categoryInput.value,
        title: titleInput.value,
        content: contentInput.value,
        images: selectedImages,
      };
      const savedPost = editingPost
        ? updateFreePost(editingPost.id, values, user.id)
        : createFreePost({ ...values, user });

      window.location.href = `./free-board-detail.html?id=${encodeURIComponent(savedPost.id)}`;
    } catch (error) {
      if (error.message === "TOO_MANY_IMAGES") {
        showMessage("사진은 최대 3장까지 첨부할 수 있습니다.");
      } else if (error.message === "IMAGE_TOO_LARGE") {
        showMessage("사진 한 장의 크기는 700KB 이하여야 합니다.");
      } else if (error.name === "QuotaExceededError") {
        showMessage("브라우저 저장 공간이 부족합니다. 사진 수나 크기를 줄여주세요.");
      } else {
        console.error(error);
        showMessage("게시글을 저장하지 못했습니다. 다시 시도해주세요.");
      }

      submitButton.disabled = false;
      submitButton.textContent = editingPost ? "수정 완료" : "게시글 등록";
    }
  });
}
