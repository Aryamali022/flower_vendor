// App bootstrap: tap-name + PIN login, hash router, realtime wiring.
import { api, session, ApiError } from "./api.js";
import { $, el, esc, toast } from "./ui.js";
import { subscribeOrders } from "./realtime.js";
import { renderQueue } from "./views/queue.js";
import { renderPending } from "./views/pending.js";
import { renderNewOrder } from "./views/neworder.js";
import { renderItems } from "./views/items.js";
import { renderReports } from "./views/reports.js";

const loginView = $("#login-view");
const appShell = $("#app-shell");
const container = $("#view-container");
const loginContent = $("#login-content");
let unsubscribe = null;

const ROUTES = {
  queue: renderQueue,
  pending: renderPending,
  new: renderNewOrder,
  items: renderItems,
  reports: renderReports,
};

// ========================= LOGIN =========================
async function renderStaffList() {
  $("#login-error").textContent = "";
  loginContent.innerHTML = `<p class="muted">તમારું નામ પસંદ કરો</p><div class="staff-list" id="staff-list"></div>`;
  const list = $("#staff-list");
  try {
    const staff = await api.get("/auth/staff");
    if (!staff.length) { list.innerHTML = `<p class="error-text">કોઈ સ્ટાફ નથી</p>`; return; }
    staff.forEach(s => {
      const b = el(`<button class="staff-btn">
        <span class="staff-avatar">${esc(s.name[0] || "?")}</span>${esc(s.name)}</button>`);
      b.onclick = () => renderPinPad(s);
      list.appendChild(b);
    });
  } catch (e) {
    list.innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
  }
}

function renderPinPad(staff) {
  let pin = "";
  loginContent.innerHTML = `
    <div class="pin-name">${esc(staff.name)}</div>
    <p class="muted">4 અંકનો પિન દાખલ કરો</p>
    <div class="pin-dots" id="pin-dots">
      ${[0,1,2,3].map(() => `<span class="pin-dot"></span>`).join("")}
    </div>
    <div class="keypad" id="keypad">
      ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="key" data-k="${n}">${n}</button>`).join("")}
      <button class="key alt" data-k="back">← નામ</button>
      <button class="key" data-k="0">0</button>
      <button class="key alt" data-k="del">⌫</button>
    </div>`;

  const dots = [...loginContent.querySelectorAll(".pin-dot")];
  const draw = () => dots.forEach((d, i) => d.classList.toggle("filled", i < pin.length));

  loginContent.querySelectorAll(".key").forEach(k => {
    k.onclick = async () => {
      const v = k.dataset.k;
      if (v === "back") return renderStaffList();
      if (v === "del") { pin = pin.slice(0, -1); draw(); return; }
      if (pin.length >= 4) return;
      pin += v; draw();
      if (pin.length === 4) await submitPin(staff, pin, () => { pin = ""; draw(); });
    };
  });
}

async function submitPin(staff, pin, reset) {
  try {
    const res = await api.post("/auth/login", { name: staff.name, password: pin });
    session.save(res.access_token, res.employee);
    showApp();
  } catch (ex) {
    $("#login-error").textContent = ex instanceof ApiError ? ex.message : "લોગિન નિષ્ફળ";
    reset();
  }
}

// ========================= SHELL =========================
function showApp() {
  loginView.classList.add("hidden");
  appShell.classList.remove("hidden");
  const u = session.user;
  $("#header-user").innerHTML =
    `${esc(u?.name || "")} <button id="logout-btn">બહાર</button>`;
  $("#logout-btn").onclick = logout;
  unsubscribe = subscribeOrders(liveRefresh);
  if (!location.hash) location.hash = "#queue";
  else route();
}

function showLogin() {
  appShell.classList.add("hidden");
  loginView.classList.remove("hidden");
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  renderStaffList();
}

function logout() {
  session.clear();
  location.hash = "";
  showLogin();
}

window.addEventListener("auth:expired", () => {
  toast("સત્ર સમાપ્ત — ફરી લોગિન કરો", "err");
  showLogin();
});

// realtime: re-render the live views when orders change anywhere
function liveRefresh() {
  const name = location.hash.replace("#", "") || "queue";
  if (name === "queue" || name === "pending") route();
}

// ========================= ROUTER =========================
async function route() {
  if (!session.token) { showLogin(); return; }
  const name = (location.hash.replace("#", "") || "queue");
  const render = ROUTES[name] || renderQueue;
  document.querySelectorAll(".nav-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.route === name));
  container.innerHTML = "";
  try { await render(container); }
  catch (e) {
    container.innerHTML = `<div class="empty"><div class="big">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

window.addEventListener("hashchange", route);
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => { location.hash = "#" + btn.dataset.route; });
});

// ========================= BOOT =========================
if (session.token) showApp();
else showLogin();
