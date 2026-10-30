// 로그인·회원가입 모달 동작을 구현하는 파일입니다.
// 트리거: [data-modal-target], 닫기: [data-modal-close]

export function initAuthModals() {
  let returnFocus = null;

  document.addEventListener("click", (e) => {
    const openButton = e.target.closest("[data-modal-target]");

    if(openButton) {
      const modalId = openButton.dataset.modalTarget;
      const targetModal = document.getElementById(modalId);

      if(!(targetModal instanceof HTMLDialogElement)) return;

      const openedModal = document.querySelector(".auth-modal[open]");

      if(!openedModal) {
        returnFocus = openButton;
      }

      if(openedModal && openedModal !== targetModal) {
        openedModal.close();
      }

      if(!targetModal.open) {
        targetModal.showModal();
      }

      return;
    }

    const closeButton = e.target.closest("[data-modal-close]");
    if(closeButton) {
      closeButton.closest("dialog")?.close();
    }
  });

  document.querySelectorAll(".auth-modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if(e.target === modal) {
        modal.close();
      }
    });

    modal.addEventListener("close", () => {
      queueMicrotask(() => {
        if(!document.querySelector(".auth-modal[open]")) {
          returnFocus?.focus();
          returnFocus = null;
        }
      });
    });
  })
}




