import {
  authenticateUser,
  registerUser,
  resetPassword,
  saveCurrentUser,
} from "./auth-storage.js";
import { updateAuthUI } from "./auth-state.js";

export function initAuthForms() {
  const loginForm = document.querySelector("#login-form");
  const signupForm = document.querySelector("#signup-form");
  const resetPasswordForm = document.querySelector("#reset-password-form");

  if (!loginForm || !signupForm || !resetPasswordForm) {
    return;
  }

  const emailInput = document.querySelector("#login-email");
  const passwordInput = document.querySelector("#login-password");
  const rememberInput = document.querySelector("#login-remember");
  const emailError = document.querySelector("#login-email-error");
  const passwordError = document.querySelector("#login-password-error");
  const loginMessage = document.querySelector("#login-success-message");
  const loginSubmitButton = loginForm.querySelector('[type="submit"]');

  const signupNameInput = document.querySelector("#signup-name");
  const signupEmailInput = document.querySelector("#signup-email");
  const signupPasswordInput = document.querySelector("#signup-password");
  const signupPasswordConfirmInput = document.querySelector("#signup-password-confirm");
  const signupTermsInput = document.querySelector("#signup-terms");
  const signupNameError = document.querySelector("#signup-name-error");
  const signupEmailError = document.querySelector("#signup-email-error");
  const signupPasswordError = document.querySelector("#signup-password-error");
  const signupPasswordConfirmError = document.querySelector("#signup-password-confirm-error");
  const signupTermsError = document.querySelector("#signup-terms-error");
  const signupSubmitButton = signupForm.querySelector('[type="submit"]');

  const resetNameInput = document.querySelector("#reset-name");
  const resetEmailInput = document.querySelector("#reset-email");
  const resetPasswordInput = document.querySelector("#reset-password");
  const resetPasswordConfirmInput = document.querySelector("#reset-password-confirm");
  const resetNameError = document.querySelector("#reset-name-error");
  const resetEmailError = document.querySelector("#reset-email-error");
  const resetPasswordError = document.querySelector("#reset-password-error");
  const resetPasswordConfirmError = document.querySelector("#reset-password-confirm-error");
  const resetSubmitButton = resetPasswordForm.querySelector('[type="submit"]');

  emailInput.addEventListener("input", () => {
    emailError.textContent = "";
    loginMessage.textContent = "";
  });

  passwordInput.addEventListener("input", () => {
    passwordError.textContent = "";
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    emailError.textContent = "";
    passwordError.textContent = "";
    loginMessage.textContent = "";

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    let isValid = true;

    if (!email) {
      emailError.textContent = "이메일을 입력해 주세요.";
      isValid = false;
    } else if (!emailInput.validity.valid) {
      emailError.textContent = "올바른 이메일 형식을 입력해 주세요.";
      isValid = false;
    }

    if (!password) {
      passwordError.textContent = "비밀번호를 입력해주세요.";
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    loginSubmitButton.disabled = true;
    loginSubmitButton.textContent = "로그인 중...";

    try {
      const user = await authenticateUser(email, password);

      if (!user) {
        passwordError.textContent = "이메일 또는 비밀번호가 올바르지 않습니다.";
        return;
      }

      saveCurrentUser(user, rememberInput.checked);
      updateAuthUI(user);
      document.dispatchEvent(new CustomEvent("auth:state-changed", { detail: { user } }));

      loginForm.reset();
      document.querySelector("#login-modal")?.close();
    } catch (error) {
      console.error(error);

      passwordError.textContent = "로그인 처리 중 문제가 발생했습니다.";
    } finally {
      loginSubmitButton.disabled = false;
      loginSubmitButton.textContent = "로그인";
    }
  });

  signupNameInput.addEventListener("input", () => {
    signupNameError.textContent = "";
  });

  signupEmailInput.addEventListener("input", () => {
    signupEmailError.textContent = "";
  });

  signupPasswordInput.addEventListener("input", () => {
    signupPasswordError.textContent = "";
    signupPasswordConfirmError.textContent = "";
  });

  signupPasswordConfirmInput.addEventListener("input", () => {
    signupPasswordConfirmError.textContent = "";
  });

  signupTermsInput.addEventListener("change", () => {
    signupTermsError.textContent = "";
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    signupNameError.textContent = "";
    signupEmailError.textContent = "";
    signupPasswordError.textContent = "";
    signupPasswordConfirmError.textContent = "";
    signupTermsError.textContent = "";

    const name = signupNameInput.value.trim();
    const email = signupEmailInput.value.trim();
    const password = signupPasswordInput.value;
    const passwordConfirm = signupPasswordConfirmInput.value;
    let isValid = true;

    if (!name) {
      signupNameError.textContent = "이름을 입력해주세요.";
      isValid = false;
    }

    if (!email) {
      signupEmailError.textContent = "이메일을 입력해주세요.";
      isValid = false;
    } else if (!signupEmailInput.validity.valid) {
      signupEmailError.textContent = "올바른 이메일 형식을 입력해주세요.";
      isValid = false;
    }

    if (password.length < 8) {
      signupPasswordError.textContent = "비밀번호는 8자 이상 입력해주세요.";
      isValid = false;
    }

    if (password !== passwordConfirm) {
      signupPasswordConfirmError.textContent = "비밀번호가 일치하지 않습니다.";
      isValid = false;
    }

    if (!signupTermsInput.checked) {
      signupTermsError.textContent = "약관에 동의해주세요.";
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    signupSubmitButton.disabled = true;
    signupSubmitButton.textContent = "가입 중...";

    try {
      await registerUser({ name, email, password });

      signupForm.reset();
      emailInput.value = email;
      loginMessage.textContent = "회원가입이 완료되었습니다. 로그인해주세요.";

      document.querySelector("#signup-modal")?.close();

      const loginModal = document.querySelector("#login-modal");
      if (loginModal && !loginModal.open) {
        loginModal.showModal();
      }
    } catch (error) {
      if (error.message === "EMAIL_ALREADY_EXISTS") {
        signupEmailError.textContent = "이미 가입된 이메일입니다.";
      } else {
        console.error(error);
        signupEmailError.textContent = "회원가입 처리 중 문제가 발생했습니다.";
      }
    } finally {
      signupSubmitButton.disabled = false;
      signupSubmitButton.textContent = "회원가입";
    }
  });

  resetNameInput.addEventListener("input", () => {
    resetNameError.textContent = "";
  });

  resetEmailInput.addEventListener("input", () => {
    resetEmailError.textContent = "";
  });

  resetPasswordInput.addEventListener("input", () => {
    resetPasswordError.textContent = "";
    resetPasswordConfirmError.textContent = "";
  });

  resetPasswordConfirmInput.addEventListener("input", () => {
    resetPasswordConfirmError.textContent = "";
  });

  resetPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    resetNameError.textContent = "";
    resetEmailError.textContent = "";
    resetPasswordError.textContent = "";
    resetPasswordConfirmError.textContent = "";

    const name = resetNameInput.value.trim();
    const email = resetEmailInput.value.trim();
    const password = resetPasswordInput.value;
    const passwordConfirm = resetPasswordConfirmInput.value;
    let isValid = true;

    if (!name) {
      resetNameError.textContent = "가입한 이름을 입력해주세요.";
      isValid = false;
    }

    if (!email) {
      resetEmailError.textContent = "가입한 이메일을 입력해주세요.";
      isValid = false;
    } else if (!resetEmailInput.validity.valid) {
      resetEmailError.textContent = "올바른 이메일 형식을 입력해주세요.";
      isValid = false;
    }

    if (password.length < 8) {
      resetPasswordError.textContent = "새 비밀번호는 8자 이상 입력해주세요.";
      isValid = false;
    }

    if (password !== passwordConfirm) {
      resetPasswordConfirmError.textContent = "새 비밀번호가 일치하지 않습니다.";
      isValid = false;
    }

    if (!isValid) return;

    resetSubmitButton.disabled = true;
    resetSubmitButton.textContent = "변경 중...";

    try {
      await resetPassword({ name, email, password });

      resetPasswordForm.reset();
      emailInput.value = email;
      loginMessage.textContent = "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.";
      document.querySelector("#reset-password-modal")?.close();

      const loginModal = document.querySelector("#login-modal");
      if (loginModal && !loginModal.open) {
        loginModal.showModal();
      }
    } catch (error) {
      if (error.message === "USER_NOT_FOUND") {
        resetEmailError.textContent = "이름과 이메일이 일치하는 계정을 찾을 수 없습니다.";
      } else {
        console.error(error);
        resetEmailError.textContent = "비밀번호 변경 중 문제가 발생했습니다.";
      }
    } finally {
      resetSubmitButton.disabled = false;
      resetSubmitButton.textContent = "비밀번호 변경";
    }
  });
}
