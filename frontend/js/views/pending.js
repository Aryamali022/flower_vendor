// Pending Bills — every order with money still to collect.
import { api } from "../api.js";
import { el, esc, money, formatDate, payChip, spinner, empty } from "../ui.js";
import { openOrderDetail } from "./orderdetail.js";

export async function renderPending(container) {
  container.innerHTML = `
    <div class="section-head">
      <h2 class="section-title">બાકી બિલ</h2>
      <span class="badge-count" id="p-total">₹0</span>
    </div>
    <div id="pending-list">${spinner()}</div>`;
  await load(container);
}

async function load(container) {
  const list = container.querySelector("#pending-list");
  try {
    const orders = await api.get("/orders/pending-bills");
    const total = orders.reduce((s, o) => s + o.remaining_amount, 0);
    container.querySelector("#p-total").textContent = money(total);
    if (!orders.length) {
      list.innerHTML = empty("✅", "બધી ચૂકવણી પૂર્ણ! કોઈ બાકી બિલ નથી.");
      return;
    }
    list.innerHTML = "";
    orders.forEach(o => list.appendChild(billCard(o, container)));
  } catch (e) {
    list.innerHTML = empty("⚠️", e.message);
  }
}

function billCard(o, container) {
  const card = el(`
    <div class="order-card" style="border-left-color:var(--red)">
      <div class="oc-top">
        <div>
          <div class="oc-name">${esc(o.customer_name || "—")}</div>
          ${o.customer_mobile ? `<div class="oc-phone">📞 ${esc(o.customer_mobile)}</div>` : ""}
          <div class="oc-date">પિકઅપ: ${formatDate(o.pickup_date)}</div>
        </div>
        <div style="text-align:right">
          <div class="oc-remain" style="font-size:20px">${money(o.remaining_amount)}</div>
          <div class="oc-date">કુલ ${money(o.total_amount)}</div>
        </div>
      </div>
      <div class="oc-foot">
        ${payChip(o.payment_status)}
        <span class="muted" style="font-size:13px">ચૂકવેલ: ${money(o.advance_amount)}</span>
      </div>
    </div>`);
  card.addEventListener("click", () => openOrderDetail(o.id, () => load(container)));
  return card;
}
