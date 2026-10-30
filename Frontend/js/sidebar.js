// API 로딩과 관계없이 Bootstrap Collapse로 메뉴를 여닫습니다.
(() => {
  const sidebar = document.getElementById("explorer-sidebar");
  const button = document.getElementById("sidebar-toggle");
  if (!sidebar || !button) return;

  const explorer = sidebar.closest(".explorer-body");
  const label = button.querySelector(".sidebar-toggle-label");
  const updateState = (expanded) => {
    const action = expanded ? "접기" : "펼치기";
    explorer.classList.toggle("is-sidebar-collapsed", !expanded);
    button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute("aria-label", `여행 탐색 메뉴 ${action}`);
    button.title = `메뉴 ${action}`;
    label.textContent = `메뉴 ${action}`;
    sidebar.inert = !expanded;
  };

  sidebar.addEventListener("hide.bs.collapse", (event) => {
    // 계획 생성 등 내부 Collapse 이벤트는 메뉴 상태를 바꾸지 않습니다.
    if (event.target !== sidebar) return;
    if (sidebar.contains(document.activeElement)) button.focus({ preventScroll: true });
    updateState(false);
  });
  sidebar.addEventListener("show.bs.collapse", (event) => {
    if (event.target === sidebar) updateState(true);
  });
  updateState(sidebar.classList.contains("show"));
})();
