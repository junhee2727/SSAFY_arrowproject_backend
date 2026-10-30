import { resetPassword, loadCurrentUser } from "./auth-storage.js";
import { notifyAuthChange } from "./auth-state.js";

export function showRecoveryCode(result, message) {
  const modal = document.querySelector("#recovery-code-modal");
  document.querySelector("#recovery-code-value").value = result.recoveryCode;
  document.querySelector("#recovery-code-message").textContent = message;
  document.querySelector("#recovery-copy-status").textContent = "";
  document.querySelector("#login-email").value = result.email;
  document.querySelector(".auth-modal[open]")?.close();
  modal.showModal();
  document.querySelector("#copy-recovery-code").focus();
}

export function initPasswordRecovery() {
  const form = document.querySelector("#password-reset-form");
  const codeModal = document.querySelector("#recovery-code-modal");
  if (!form || !codeModal) return;
  const error = document.querySelector("#reset-error");
  const email = document.querySelector("#reset-email");
  const code = document.querySelector("#reset-recovery-code");
  const password = document.querySelector("#reset-password");
  const confirmation = document.querySelector("#reset-password-confirm");

  form.addEventListener("input", () => { error.textContent = ""; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    if (!email.value.trim() || !email.validity.valid) {
      error.textContent = "올바른 이메일을 입력해주세요."; email.focus(); return;
    }
    if (!code.value.trim()) {
      error.textContent = "가입 시 보관한 복구코드를 입력해주세요."; code.focus(); return;
    }
    if (password.value.length < 8) {
      error.textContent = "비밀번호는 8자 이상 입력해주세요."; password.focus(); return;
    }
    if (password.value !== confirmation.value) {
      error.textContent = "비밀번호가 일치하지 않습니다."; confirmation.focus(); return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "변경 중...";
    try {
      const result = await resetPassword({ email: email.value.trim(), recoveryCode: code.value.trim(), password: password.value, passwordConfirm: confirmation.value });
      form.reset();
      // 서버의 기존 세션이 만료되었음을 화면에도 반영한다. 다른 계정의 세션은 유지한다.
      try { notifyAuthChange(await loadCurrentUser()); } catch { notifyAuthChange(null); }
      document.querySelector("#login-password").value = "";
      document.querySelector("#login-success-message").textContent = "새 비밀번호로 로그인해주세요.";
      showRecoveryCode(result, "비밀번호를 변경했습니다. 이전 복구코드 대신 새 코드를 보관해주세요.");
    } catch (cause) {
      error.textContent = cause.message;
    } finally {
      submit.disabled = false;
      submit.textContent = "비밀번호 재설정";
    }
  });
  document.querySelector("#password-reset-modal").addEventListener("close", () => {
    form.reset();
    error.textContent = "";
  });
  codeModal.addEventListener("close", () => {
    document.querySelector("#recovery-code-value").value = "";
    document.querySelector("#recovery-copy-status").textContent = "";
  });
  document.querySelector("#recovery-code-continue").addEventListener("click", () => {
    codeModal.close();
    document.querySelector("#login-modal").showModal();
  });
  document.querySelector("#copy-recovery-code").addEventListener("click", async () => {
    const value = document.querySelector("#recovery-code-value");
    const codeToCopy = value.value;
    try {
      await navigator.clipboard.writeText(codeToCopy);
      if (codeModal.open) document.querySelector("#recovery-copy-status").textContent = "복사했습니다. 안전한 곳에 보관해주세요.";
    } catch {
      if (!codeModal.open) return;
      value.focus(); value.select();
      document.querySelector("#recovery-copy-status").textContent = "선택한 코드를 직접 복사해주세요.";
    }
  });
}
