// Order detail modal — view + update status/payment + delete.
import { api } from "../api.js";
import { el, esc, money, formatTime, formatDate, statusChip, payChip,
         openModal, closeModal, toast } from "../ui.js";
import { ORDER_STATUS } from "../config.js";

export async function openOrderDetail(orderId, onChange) {
  const body = el(`<div><div class="spinner"></div></div>`);
  openModal(body);
  let o;
  try { o = await api.get(`/orders/${orderId}`); }
  catch (e) { body.innerHTML = `<p class="error-text">${esc(e.message)}</p>`; return; }

  const itemsHtml = o.items.map(i =>
    `<div class="detail-row"><span class="k">${esc(i.item_name)} ×${i.quantity}</span>
       <span class="v">${money(i.price * i.quantity)}</span></div>`).join("");

  body.innerHTML = `
    <h2>${esc(o.customer_name || "—")}</h2>
    ${o.customer_mobile ? `<p class="muted">📞 ${esc(o.customer_mobile)}</p>` : ""}
    ${o.is_late ? `<div class="late-badge">🚨 મોડો ઓર્ડર</div>` : ""}

    <div class="detail-row"><span class="k">પિકઅપ</span>
      <span class="v">${formatDate(o.pickup_date)} · ${formatTime(o.pickup_time)}</span></div>
    ${itemsHtml}
    <div class="detail-row"><span class="k">કુલ રકમ</span><span class="v">${money(o.total_amount)}</span></div>
    <div class="detail-row"><span class="k">એડવાન્સ</span><span class="v">${money(o.advance_amount)}</span></div>
    <div class="detail-row"><span class="k">બાકી</span>
      <span class="v" style="color:var(--red)">${money(o.remaining_amount)}</span></div>
    <div class="detail-row"><span class="k">ઓર્ડર સ્થિતિ</span><span class="v">${statusChip(o.order_status)}</span></div>
    <div class="detail-row"><span class="k">ચૂકવણી</span><span class="v">${payChip(o.payment_status)}</span></div>
    ${o.notes ? `<div class="detail-row"><span class="k">નોંધ</span><span class="v">${esc(o.notes)}</span></div>` : ""}
    <div class="detail-row" style="border:none"><span class="k">બનાવનાર</span>
      <span class="v">${esc(o.created_by_name || "")}</span></div>

    <div style="margin-top:16px">
      <label class="field">ઓર્ડર સ્થિતિ બદલો</label>
      <div class="row wrap" style="gap:8px" id="status-btns">
        ${ORDER_STATUS.map(s => `<button class="btn btn-sm ${s === o.order_status ? "btn-primary" : "btn-ghost"}"
            data-status="${esc(s)}">${esc(s)}</button>`).join("")}
      </div>

      <label class="field" style="margin-top:14px">ચૂકવણી અપડેટ (કુલ ચૂકવેલ ₹)</label>
      <div class="row" style="gap:8px">
        <input id="pay-input" class="grow" type="number" min="0" value="${o.advance_amount}"
               style="padding:12px;border:2px solid var(--border);border-radius:12px" />
        <button class="btn btn-success btn-sm" id="pay-btn">સેવ</button>
      </div>

      <div class="row" style="gap:8px;margin-top:18px">
        <button class="btn btn-danger grow" id="del-btn">🗑 ડિલીટ</button>
      </div>
    </div>`;

  body.querySelectorAll("#status-btns button").forEach(btn => {
    btn.onclick = async () => {
      try {
        await api.patch(`/orders/${orderId}/status`, { order_status: btn.dataset.status });
        toast("સ્થિતિ અપડેટ થઈ", "ok");
        closeModal(); onChange?.();
      } catch (e) { toast(e.message, "err"); }
    };
  });

  body.querySelector("#pay-btn").onclick = async () => {
    const amt = parseFloat(body.querySelector("#pay-input").value) || 0;
    try {
      await api.patch(`/orders/${orderId}/payment`, { advance_amount: amt });
      toast("ચૂકવણી અપડેટ થઈ", "ok");
      closeModal(); onChange?.();
    } catch (e) { toast(e.message, "err"); }
  };

  body.querySelector("#del-btn").onclick = async () => {
    if (!confirm("આ ઓર્ડર ડિલીટ કરવો છે?")) return;
    try {
      await api.del(`/orders/${orderId}`);
      toast("ઓર્ડર ડિલીટ થયો", "ok");
      closeModal(); onChange?.();
    } catch (e) { toast(e.message, "err"); }
  };
}
