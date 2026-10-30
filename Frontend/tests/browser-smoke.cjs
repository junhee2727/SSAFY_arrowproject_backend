// Optional end-to-end check: requires Playwright, Chrome, Live Server and Tomcat.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const base = process.env.ENJOYTRIP_BASE_URL || "http://127.0.0.1:5500";
  const apiBase = process.env.ENJOYTRIP_API_BASE_URL || "http://127.0.0.1:8080/enjoytrip";
  const screenshots = path.resolve(__dirname, "../../Backend/.runtime/screenshots");
  fs.mkdirSync(screenshots, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const email = `browser-${Date.now()}@example.com`;
  let password = "browser1234";
  let recoveryCode;
  let guest;
  let deleted = false;
  async function api(method, route, data) {
    return context.request.fetch(`${apiBase}/api/${route}`, { method, data, headers: { "X-Requested-With": "EnjoyTrip", Origin: new URL(base).origin } });
  }
  async function login() {
    await page.locator("[data-auth-guest] [data-modal-target=login-modal]").click();
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
    await page.locator("#login-form [type=submit]").click();
    await page.locator("[data-auth-user]").waitFor({ state: "visible" });
  }
  try {
    await page.goto(`${base}/pages/free-board.html`);
    await page.locator("#free-board-body tr").first().waitFor();
    const signupButton = page.locator("[data-auth-guest] [data-modal-target=signup-modal]");
    await signupButton.click();
    await page.keyboard.press("Escape");
    await page.locator("#signup-modal").waitFor({ state: "hidden" });
    assert.equal(await signupButton.evaluate((element) => element === document.activeElement), true);
    await signupButton.click();
    await page.locator("#signup-name").fill("브라우저여행자");
    await page.locator("#signup-email").fill(email);
    await page.locator("#signup-password").fill(password);
    await page.locator("#signup-password-confirm").fill(password);
    await page.locator("#signup-terms").check();
    await page.locator("#signup-form [type=submit]").click();
    await page.locator("#recovery-code-modal").waitFor({ state: "visible" });
    recoveryCode = await page.locator("#recovery-code-value").inputValue();
    assert.match(recoveryCode, /^[A-Za-z0-9_-]{43}$/);
    await page.locator("#recovery-code-continue").click();
    await page.locator("#login-modal").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector("#recovery-code-value").value === "");
    assert.equal(await page.locator("#recovery-code-value").inputValue(), "");
    assert.match(await page.locator("#login-success-message").innerText(), /회원가입이 완료/);
    await page.locator("#login-password").fill(password);
    await page.locator("#login-form [type=submit]").click();
    await page.locator("[data-auth-user]").waitFor({ state: "visible" });
    await page.locator("#free-board-write-button").click();
    await page.waitForURL("**/free-board-write.html");
    await page.locator("#post-category").selectOption("review");
    await page.locator("#post-title").fill("UI 한글 여행 후기");
    await page.locator("#post-content").fill("첫 번째 문단\n\n<script>window.shouldNotRun=true</script>");
    // Expire the real server session while a draft is open, then recover it.
    assert.equal((await api("POST", "auth/logout")).status(), 204);
    await page.locator("#free-board-write-form [type=submit]").click();
    await page.locator("#login-modal").waitFor({ state: "visible" });
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
    await page.locator("#login-form [type=submit]").click();
    await page.locator("#login-modal").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#post-title").inputValue(), "UI 한글 여행 후기");
    await page.locator("#free-board-write-form [type=submit]").click();
    await page.waitForURL("**/free-board-detail.html?id=*");
    await page.locator("#free-board-detail-title").filter({ hasText: "UI 한글 여행 후기" }).waitFor();
    const postId = new URL(page.url()).searchParams.get("id");
    assert.equal(await page.evaluate(() => window.shouldNotRun), undefined);
    assert.match(await page.locator("#free-board-detail-body").innerText(), /<script>/);
    await page.locator("#post-edit-button").click();
    await page.waitForURL("**/free-board-write.html?id=*");
    await page.waitForFunction(() => document.querySelector("#post-title").value === "UI 한글 여행 후기");
    await page.locator("#post-title").fill("UI 수정한 여행 후기");
    await page.locator("#free-board-write-form [type=submit]").click();
    await page.waitForURL("**/free-board-detail.html?id=*");
    await page.locator("#free-board-detail-title").filter({ hasText: "UI 수정한 여행 후기" }).waitFor();
    await page.reload();
    await page.locator("#post-owner-actions").waitFor({ state: "visible" });
    guest = await browser.newContext();
    const otherPage = await guest.newPage();
    otherPage.on("pageerror", (error) => errors.push(error.message));
    await otherPage.goto(`${base}/pages/free-board-detail.html?id=${postId}`);
    await otherPage.locator("#free-board-detail-title").filter({ hasText: "UI 수정한 여행 후기" }).waitFor();
    assert.equal(await otherPage.locator("#post-owner-actions").isVisible(), false);
    assert.equal(await otherPage.evaluate(() => localStorage.getItem("travel_users")), null);
    for (let i = 0; i < 8; i++) {
      const response = await api("POST", "posts", { category: "info", title: `페이징 검증 ${i}`, content: "검색 결과 검증" });
      assert.equal(response.status(), 201);
    }
    await page.goto(`${base}/pages/free-board.html`);
    await page.locator("#free-board-body tr").first().waitFor();
    await page.locator("#free-board-search-keyword").fill("페이징 검증");
    await page.locator("#free-board-search-form [type=submit]").click();
    await page.waitForFunction(() => document.querySelector("#free-board-count").textContent === "8");
    assert.equal(await page.locator("#free-board-body tr").count(), 7);
    await page.locator("#free-board-pagination").getByRole("button", { name: "2", exact: true }).click();
    await page.waitForFunction(() => new URL(location.href).searchParams.get("page") === "2");
    assert.equal(await page.locator("#free-board-body tr").count(), 1);
    await page.locator("#free-board-search-keyword").fill("없는검색결과-unique");
    await page.locator("#free-board-search-form [type=submit]").click();
    await page.getByText("검색 결과가 없습니다.", { exact: true }).waitFor();
    await page.locator("#free-board-search-keyword").fill("");
    await page.locator("#free-board-search-form [type=submit]").click();
    await page.waitForFunction(() => document.querySelector("#free-board-count").textContent === "9");
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator("header.site-header").count(), 1);
      await page.screenshot({ path: `${screenshots}/board-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `board overflow at ${width}`);
    }
    // A transient list failure must offer a working retry, not local seed data.
    await page.route("**/api/posts?**", (route) => route.abort(), { times: 1 });
    await page.reload();
    await page.getByRole("button", { name: "다시 시도", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#free-board-count").textContent === "9");
    // Also exercise deletion through the UI, separately from account cascade.
    const temporary = await api("POST", "posts", { category: "free", title: "삭제 버튼 검증", content: "삭제할 글" });
    const temporaryId = (await temporary.json()).data.id;
    await page.goto(`${base}/pages/free-board-detail.html?id=${temporaryId}`);
    await page.locator("#post-owner-actions").waitFor({ state: "visible" });
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#post-delete-button").click();
    await page.waitForURL("**/free-board.html");
    await page.locator("#free-board-body tr").first().waitFor();
    assert.equal((await api("GET", `posts/${temporaryId}`)).status(), 404);
    await page.locator(".my-page-link").click();
    await page.locator("#my-page-content").waitFor({ state: "visible" });
    await page.locator("#profile-name").fill("이름변경여행자");
    await page.locator("#profile-form [type=submit]").click();
    await page.getByText("회원정보가 수정되었습니다.", { exact: true }).waitFor();
    assert.equal(await page.locator("[data-user-name]").innerText(), "이름변경여행자");
    for (const width of [1440, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator("header.site-header").count(), 1);
      await page.screenshot({ path: `${screenshots}/profile-${width}.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `profile overflow at ${width}`);
    }
    await otherPage.reload();
    await otherPage.locator("#free-board-detail-meta").filter({ hasText: "이름변경여행자" }).waitFor();

    // Recover from a separate, signed-out browser. Existing authenticated sessions must expire.
    await otherPage.locator("[data-auth-guest] [data-modal-target=login-modal]").click();
    await otherPage.locator("[data-modal-target=password-reset-modal]").click();
    await otherPage.locator("#reset-recovery-code").fill("discard-on-close");
    await otherPage.locator("#reset-password").fill("discardPassword123");
    for (let tab = 0; tab < 8; tab++) {
      await otherPage.keyboard.press("Tab");
      const focus = await otherPage.evaluate(() => ({ inPage: document.hasFocus(), dialog: document.activeElement.closest("dialog")?.id }));
      // Native dialog navigation may visit the browser toolbar; page controls remain modal.
      if (focus.inPage) assert.equal(focus.dialog, "password-reset-modal");
    }
    await otherPage.keyboard.press("Escape");
    await otherPage.locator("#password-reset-modal").waitFor({ state: "hidden" });
    await otherPage.waitForFunction(() => document.querySelector("#reset-recovery-code").value === "" && document.querySelector("#reset-password").value === "");
    await otherPage.locator("[data-auth-guest] [data-modal-target=login-modal]").click();
    await otherPage.locator("[data-modal-target=password-reset-modal]").click();
    await otherPage.locator("#reset-email").fill(email);
    await otherPage.locator("#reset-recovery-code").fill("wrong");
    await otherPage.locator("#reset-password").fill("newBrowser1234");
    await otherPage.locator("#reset-password-confirm").fill("mismatch");
    await otherPage.locator("#password-reset-form [type=submit]").click();
    await otherPage.getByText("비밀번호가 일치하지 않습니다.", { exact: true }).waitFor();
    await otherPage.locator("#reset-password-confirm").fill("newBrowser1234");
    await otherPage.locator("#password-reset-form [type=submit]").click();
    await otherPage.getByText("이메일 또는 복구코드를 확인해주세요.", { exact: true }).waitFor();
    await otherPage.locator("#reset-recovery-code").fill(recoveryCode);
    for (const width of [1440, 820, 390]) {
      await otherPage.setViewportSize({ width, height: 1000 });
      await otherPage.screenshot({ path: `${screenshots}/password-reset-${width}.png`, fullPage: true });
      assert.equal(await otherPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    }
    await otherPage.locator("#password-reset-form [type=submit]").click();
    await otherPage.locator("#recovery-code-modal").waitFor({ state: "visible" });
    const nextCode = await otherPage.locator("#recovery-code-value").inputValue();
    assert.match(nextCode, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(nextCode, recoveryCode);
    assert.equal((await api("GET", "members/me")).status(), 401);
    assert.equal((await api("POST", "auth/login", { email, password })).status(), 401);
    assert.equal((await api("POST", "auth/password-reset", { email, recoveryCode, password: "unusedPassword123", passwordConfirm: "unusedPassword123" })).status(), 400);
    password = "newBrowser1234";
    recoveryCode = nextCode;
    await otherPage.locator("#recovery-code-continue").click();
    await otherPage.waitForFunction(() => document.querySelector("#recovery-code-value").value === "");
    assert.equal(await otherPage.locator("#recovery-code-value").inputValue(), "");
    assert.equal(await otherPage.locator("#reset-password").inputValue(), "");
    await otherPage.locator("#login-password").fill(password);
    await otherPage.locator("#login-form [type=submit]").click();
    await otherPage.locator("[data-auth-user]").waitFor({ state: "visible" });
    await otherPage.reload();
    await otherPage.locator("[data-auth-user]").waitFor({ state: "visible" });
    assert.equal(await otherPage.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }).includes("recoveryCode")), false);
    await page.reload();
    await page.locator("#my-page-login-required").waitFor({ state: "visible" });
    await login();
    await page.locator("[data-logout]").click();
    await page.locator("#my-page-login-required").waitFor({ state: "visible" });
    await login();
    await page.locator("#my-page-content").waitFor({ state: "visible" });
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#delete-account-button").click();
    await page.waitForURL("**/map.html");
    deleted = true;
    assert.equal((await api("GET", `posts/${postId}`)).status(), 404);
    assert.equal((await api("GET", "members/me")).status(), 401);
    await page.goto(`${base}/pages/free-board.html`);
    await page.locator("#free-board-body tr").first().waitFor();
    assert.equal(await page.locator("#free-board-count").innerText(), "0");
    assert.deepEqual(errors, []);
    // A missing tourism config must not prevent member controls on the map.
    await page.route("**/config.env", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "" }));
    await page.goto(`${base}/pages/map.html`);
    await page.locator("[data-auth-guest]").waitFor({ state: "visible" });
    await page.locator("[data-modal-target=signup-modal]").first().click();
    await page.locator("#signup-modal").waitFor({ state: "visible" });
    await page.keyboard.press("Escape");
    await page.locator("#signup-modal").waitFor({ state: "hidden" });
    console.log("PASS: browser signup/recovery-code/password-reset, old session expiry, new password login, keyboard focus, board CRUD, search/paging, rename/logout/delete and 1440/820/390 layouts");
  } finally {
    if (!deleted) {
      try { await api("POST", "auth/login", { email, password }); await api("DELETE", "members/me"); } catch {}
    }
    if (guest) await guest.close();
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
