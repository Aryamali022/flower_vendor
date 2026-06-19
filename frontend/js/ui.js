// Small UI helpers: toast, modal, formatting, status chips.
import { STATUS_CLASS, PAY_CLASS } from "./config.js";

export function $(sel, root = document) { return root.querySelector(sel); }
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let toastTimer;
export function toast(msg, kind = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

export function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

export function formatTime(t) {
  // "14:30:00" -> "02:30 PM"
  if (!t) return "";
  const [h, m] = t.split(":");
  let hr = parseInt(h, 10);
  const ap = hr >= 12 ? "PM" : "AM";
  hr = hr % 12 || 12;
  return `${String(hr).padStart(2, "0")}:${m} ${ap}`;
}

export function formatDate(d) {
  if (!d) return "";
  const [y, mo, da] = d.split("-");
  return `${da}/${mo}/${y}`;
}

export function statusChip(status) {
  return `<span class="chip ${STATUS_CLASS[status] || ""}">${esc(status)}</span>`;
}
export function payChip(status) {
  return `<span class="chip ${PAY_CLASS[status] || ""}">${esc(status)}</span>`;
}

// --- modal ---
export function openModal(contentEl) {
  closeModal();
  const overlay = el(`<div class="modal-overlay"></div>`);
  const modal = el(`<div class="modal"></div>`);
  const close = el(`<button class="close-x" aria-label="બંધ">×</button>`);
  close.onclick = closeModal;
  modal.appendChild(close);
  modal.appendChild(contentEl);
  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById("modal-root").appendChild(overlay);
  return overlay;
}
export function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
}

// --- AM/PM time picker ---
// Returns { element, getValue }. getValue() -> "HH:MM:00" (24h) or null.
export function buildTimePicker(initial = { hour: 10, min: 0, ampm: "AM" }) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const mins = Array.from({ length: 12 }, (_, i) => i * 5); // 00..55 step 5
  const opt = (v, sel) => `<option value="${v}" ${v === sel ? "selected" : ""}>${String(v).padStart(2, "0")}</option>`;
  const wrap = el(`
    <div class="timepick">
      <select class="tp-hour">${hours.map(h => opt(h, initial.hour)).join("")}</select>
      <span style="font-weight:700">:</span>
      <select class="tp-min">${mins.map(m => opt(m, initial.min)).join("")}</select>
      <div class="ampm">
        <button type="button" class="tp-am ${initial.ampm === "AM" ? "on" : ""}">AM</button>
        <button type="button" class="tp-pm ${initial.ampm === "PM" ? "on" : ""}">PM</button>
      </div>
    </div>`);
  const am = wrap.querySelector(".tp-am"), pm = wrap.querySelector(".tp-pm");
  am.onclick = () => { am.classList.add("on"); pm.classList.remove("on"); };
  pm.onclick = () => { pm.classList.add("on"); am.classList.remove("on"); };

  return {
    element: wrap,
    getValue() {
      let h = parseInt(wrap.querySelector(".tp-hour").value, 10);
      const m = parseInt(wrap.querySelector(".tp-min").value, 10);
      const isPM = pm.classList.contains("on");
      if (isPM && h !== 12) h += 12;
      if (!isPM && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    },
  };
}

export function spinner() { return `<div class="spinner"></div>`; }
export function empty(icon, text) {
  return `<div class="empty"><div class="big">${icon}</div><p>${esc(text)}</p></div>`;
}
