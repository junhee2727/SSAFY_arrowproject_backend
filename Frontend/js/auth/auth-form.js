import { authenticateUser, registerUser } from "./auth-storage.js";
import { notifyAuthChange } from "./auth-state.js";
import { initPasswordRecovery, showRecoveryCode } from "./auth-recovery.js";

export function initAuthForms() {
  const login = document.querySelector("#login-form");
  const signup = document.querySelector("#signup-form");
  if (!login || !signup) return;
  initPasswordRecovery();

  function clearErrors(form) {
    form.querySelectorAll(".auth-field-error").forEach((item) => { item.textContent = ""; });
  }
  function showError(id, message) { document.querySelector(id).textContent = message; }
  [login, signup].forEach((form) => form.addEventListener("input", () => clearErrors(form)));

  login.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(login);
    const email = document.querySelector("#login-email");
    const password = document.querySelector("#login-password");
    if (!email.value.trim() || !email.validity.valid) {
      showError("#login-email-error", "올바른 이메일을 입력해주세요.");
      return;
    }
    if (!password.value) { showError("#login-password-error", "비밀번호를 입력해주세요."); return; }
    const submit = login.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "로그인 중...";
    try {
      notifyAuthChange(await authenticateUser(email.value.trim(), password.value));
      login.reset();
      document.querySelector("#login-success-message").textContent = "";
      document.querySelector("#auth-status-message").hidden = true;
      document.querySelector("#login-modal").close();
    } catch (error) { showError("#login-password-error", error.message); }
    finally { submit.disabled = false; submit.textContent = "로그인"; }
  });

  signup.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(signup);
    const name = document.querySelector("#signup-name").value.trim();
    const email = document.querySelector("#signup-email");
    const password = document.querySelector("#signup-password").value;
    const passwordConfirm = document.querySelector("#signup-password-confirm").value;
    const terms = document.querySelector("#signup-terms").checked;
    let valid = true;
    if (name.length < 2 || name.length > 20) { showError("#signup-name-error", "이름은 2자 이상 20자 이하로 입력해주세요."); valid = false; }
    if (!email.value.trim() || !email.validity.valid) { showError("#signup-email-error", "올바른 이메일을 입력해주세요."); valid = false; }
    if (password.length < 8) { showError("#signup-password-error", "비밀번호는 8자 이상 입력해주세요."); valid = false; }
    if (password !== passwordConfirm) { showError("#signup-password-confirm-error", "비밀번호가 일치하지 않습니다."); valid = false; }
    if (!terms) { showError("#signup-terms-error", "약관에 동의해주세요."); valid = false; }
    if (!valid) return;
    const submit = signup.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = "가입 중...";
    try {
      const result = await registerUser({ name, email: email.value.trim(), password, passwordConfirm, terms });
      document.querySelector("#login-email").value = email.value.trim();
      document.querySelector("#login-success-message").textContent = "회원가입이 완료되었습니다. 로그인해주세요.";
      signup.reset();
      showRecoveryCode(result, "회원가입이 완료되었습니다. 복구코드를 보관하고 로그인해주세요.");
    } catch (error) { showError("#signup-email-error", error.message); }
    finally { submit.disabled = false; submit.textContent = "회원가입"; }
  });
}
