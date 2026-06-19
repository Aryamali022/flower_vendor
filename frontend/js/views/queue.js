// Home — order list with date tabs (Today / Tomorrow / All / pick a date),
// a today-summary strip, search, and tap-to-update via the detail modal.
import { api } from "../api.js";
import { el, esc, money, formatTime, formatDate, statusChip, payChip,
         spinner, empty } from "../ui.js";
import { openOrderDetail } from "./orderdetail.js";

let currentTab = "today";   // today | tomorrow | all | <YYYY-MM-DD>

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const todayStr = () => ymd(new Date());
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); };

export async function renderQueue(container) {
  container.innerHTML = `
    <div class="summary-strip" id="summary"></div>
    <div class="date-tabs" id="date-tabs">
      <button data-tab="today">આજે</button>
      <button data-tab="tomorrow">આવતીકાલ</button>
      <button data-tab="all">બધા બાકી</button>
      <input type="date" id="date-pick" title="તારીખ પસંદ કરો" />
    </div>
    <div class="search-bar">
      <input id="q-search" placeholder="🔍 ગ્રાહક, મોબાઇલ કે વસ્તુ શોધો" />
    </div>
    <div id="queue-list">${spinner()}</div>`;

  loadSummary(container);

  const tabs = container.querySelectorAll("#date-tabs button");
  tabs.forEach(t => t.onclick = () => { currentTab = t.dataset.tab; setActiveTab(container); load(container); });
  container.querySelector("#date-pick").addEventListener("change", (e) => {
    if (e.target.value) { currentTab = e.target.value; setActiveTab(container); load(container); }
  });
  const search = container.querySelector("#q-search");
  search.addEventListener("input", () => filterCards(search.value.trim()));

  setActiveTab(container);
  await load(container);
}

function setActiveTab(container) {
  container.querySelectorAll("#date-tabs button").forEach(b =>
    b.classList.toggle("on", b.dataset.tab === currentTab));
}

async function loadSummary(container) {
  try {
    const d = await api.get("/reports/dashboard");
    container.querySelector("#summary").innerHTML = `
      <div class="pill"><div class="n">${d.todays_orders}</div><div class="l">આજના ઓર્ડર</div></div>
      <div class="pill"><div class="n">${d.tomorrows_orders}</div><div class="l">આવતીકાલ</div></div>
      <div class="pill due"><div class="n">${money(d.pending_payments_amount)}</div><div class="l">બાકી રકમ</div></div>`;
  } catch { /* non-critical */ }
}

async function load(container) {
  const list = container.querySelector("#queue-list");
  if (!list) return;
  list.innerHTML = spinner();
  try {
    let orders;
    if (currentTab === "all") {
      orders = await api.get("/orders/queue");
    } else {
      const date = currentTab === "today" ? todayStr()
                 : currentTab === "tomorrow" ? tomorrowStr() : currentTab;
      orders = await api.get(`/orders?pickup_date=${date}`);
      orders.sort((a, b) => (a.is_late === b.is_late ? 0 : a.is_late ? -1 : 1)
        || a.pickup_time.localeCompare(b.pickup_time));
    }
    if (!orders.length) { list.innerHTML = empty("🌼", "આ દિવસે કોઈ ઓર્ડર નથી"); return; }
    list.innerHTML = "";
    orders.forEach(o => list.appendChild(orderCard(o, container)));
  } catch (e) {
    list.innerHTML = empty("⚠️", e.message);
  }
}

function filterCards(q) {
  const list = document.getElementById("queue-list");
  if (!list) return;
  const lower = q.toLowerCase();
  list.querySelectorAll(".order-card").forEach(card => {
    card.style.display = (!q || card.dataset.search.includes(lower)) ? "" : "none";
  });
}

function orderCard(o, container) {
  const itemsText = o.items.map(i => `${esc(i.item_name)} ×${i.quantity}`).join("، ");
  const searchKey = `${o.customer_name} ${o.customer_mobile} ${itemsText}`.toLowerCase();
  const card = el(`
    <div class="order-card ${o.is_late ? "late" : ""}" data-search="${esc(searchKey)}">
      ${o.is_late ? `<div class="late-badge">🚨 મોડો ઓર્ડર</div>` : ""}
      <div class="oc-top">
        <div>
          <div class="oc-name">${esc(o.customer_name || "—")}</div>
          <div class="oc-phone">📞 ${esc(o.customer_mobile || "")}</div>
        </div>
        <div>
          <div class="oc-time">🕐 ${formatTime(o.pickup_time)}</div>
          <div class="oc-date">${formatDate(o.pickup_date)}</div>
        </div>
      </div>
      <div class="oc-items">🌸 ${itemsText}</div>
      <div class="oc-foot">
        <div class="row wrap" style="gap:6px">
          ${statusChip(o.order_status)} ${payChip(o.payment_status)}
        </div>
        <div style="text-align:right">
          ${o.remaining_amount > 0
            ? `<span class="oc-remain">બાકી: ${money(o.remaining_amount)}</span>` : ""}
          <div class="oc-emp">— ${esc(o.created_by_name || "")}</div>
        </div>
      </div>
    </div>`);
  card.addEventListener("click", () => openOrderDetail(o.id, () => {
    load(container); loadSummary(container);
  }));
  return card;
}
