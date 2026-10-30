import { dropVisitIndex } from "./route-optimizer.js";

// Pointer Events를 사용해 마우스·터치·펜에서 같은 드롭 위치 판정을 사용합니다.
export const initPlanSortable = (list, { onMove, onError, isBusy }) => {
  if (!list) return { cancel() {} };
  let drag = null;
  let frame = 0;
  const rows = () => [...list.querySelectorAll("[data-place-index]")];
  const scrollArea = list.closest(".tab-content");

  function cancel() {
    if (!drag) return;
    const previous = drag;
    drag = null;
    cancelAnimationFrame(frame);
    previous.row.classList.remove("is-dragging");
    previous.row.style.transform = "";
    previous.handle.setAttribute("aria-pressed", "false");
    previous.indicator?.remove();
    if (previous.handle.hasPointerCapture(previous.id)) previous.handle.releasePointerCapture(previous.id);
  }

  function destination() {
    const rects = rows().map((row) => row.getBoundingClientRect());
    // 드래그 중인 행의 transform은 나머지 행의 기준 위치를 바꾸지 않습니다.
    return { rects, index: dropVisitIndex(rects, drag.from, drag.y) };
  }

  function paint() {
    if (!drag?.active) return;
    const { rects, index } = destination();
    drag.to = index;
    const others = rects.filter((_, position) => position !== drag.from);
    const top = index < others.length ? others[index].top - 4 : others.at(-1)?.bottom + 4;
    drag.indicator.style.top = `${top - list.getBoundingClientRect().top + list.scrollTop}px`;
    drag.row.style.transform = `translateY(${drag.y - drag.startY + (scrollArea?.scrollTop || 0) - drag.scrollTop + window.scrollY - drag.pageScroll}px)`;
    const target = rows()[index];
    drag.indicator.classList.toggle("is-blocked", target?.dataset.locked === "true");
  }

  function autoScroll() {
    if (!drag?.active) return;
    if (scrollArea) {
      const rect = scrollArea.getBoundingClientRect();
      const top = Math.max(0, rect.top);
      const bottom = Math.min(window.innerHeight, rect.bottom);
      const delta = drag.y < top + 36 ? -10 : drag.y > bottom - 36 ? 10 : 0;
      if (delta) {
        if (scrollArea.scrollHeight > scrollArea.clientHeight) scrollArea.scrollTop += delta;
        else window.scrollBy(0, delta);
        paint();
      }
    }
    frame = requestAnimationFrame(autoScroll);
  }

  list.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-drag-place]");
    if (!handle || handle.disabled || event.button !== 0 || isBusy()) return;
    const row = handle.closest("[data-place-index]");
    if (row.dataset.locked === "true" || rows().length < 2) return;
    cancel();
    event.preventDefault();
    handle.focus({ preventScroll: true });
    drag = { handle, row, id: event.pointerId, from: Number(row.dataset.placeIndex), startY: event.clientY, y: event.clientY, x: event.clientX, scrollTop: scrollArea?.scrollTop || 0, pageScroll: window.scrollY, active: false };
    handle.setPointerCapture(event.pointerId);
  });
  list.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.y = event.clientY;
    drag.x = event.clientX;
    if (!drag.active && Math.abs(drag.y - drag.startY) < 4) return;
    if (!drag.active) {
      drag.active = true;
      drag.indicator = document.createElement("div");
      drag.indicator.className = "itinerary-drop-indicator";
      drag.indicator.setAttribute("aria-hidden", "true");
      list.append(drag.indicator);
      drag.row.classList.add("is-dragging");
      drag.handle.setAttribute("aria-pressed", "true");
      frame = requestAnimationFrame(autoScroll);
    }
    event.preventDefault();
    paint();
  });
  list.addEventListener("pointerup", async (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.y = event.clientY;
    const { from, active } = drag;
    const to = destination().index;
    const rect = list.getBoundingClientRect();
    const inside = event.clientX >= rect.left - 12 && event.clientX <= rect.right + 12 && event.clientY >= rect.top - 16 && event.clientY <= rect.bottom + 16;
    cancel();
    if (!active || !inside || from === to) return;
    try { await onMove(from, to); } catch (error) { onError(error); }
  });
  list.addEventListener("pointercancel", cancel);
  list.addEventListener("lostpointercapture", cancel);
  list.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") { cancel(); return; }
    const handle = event.target.closest("[data-drag-place]");
    if (!handle || handle.disabled || isBusy() || !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const from = Number(handle.dataset.dragPlace);
    const available = rows().filter((row) => row.dataset.locked !== "true").map((row) => Number(row.dataset.placeIndex));
    const position = available.indexOf(from);
    const to = event.key === "Home" ? available[0] : event.key === "End" ? available.at(-1)
      : available[position + (event.key === "ArrowUp" ? -1 : 1)];
    if (to == null || to === from) return;
    try { await onMove(from, to); } catch (error) { onError(error); }
  });
  return { cancel };
};
