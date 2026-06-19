// New Order — checkbox item picker, voice input (Gujarati), AM/PM time.
import { api } from "../api.js";
import { el, esc, money, toast, buildTimePicker } from "../ui.js";
import { attachMic, voiceSupported } from "../voice.js";

let masterItems = [];
let timePicker = null;

export async function renderNewOrder(container) {
  container.innerHTML = `
    <h2 class="section-title">નવો ઓર્ડર</h2>
    <form id="order-form">
      <div class="field">
        <label>મોબાઇલ નંબર</label>
        <input id="f-mobile" type="tel" inputmode="numeric" maxlength="10"
               placeholder="9876543210" required />
        <div class="hint">નંબર નાખતા જૂના ગ્રાહકની વિગત આપમેળે આવશે</div>
      </div>
      <div id="cust-banner"></div>
      <div class="field">
        <label>ગ્રાહક નામ ${voiceSupported ? "🎤" : ""}</label>
        <input id="f-name" placeholder="ગ્રાહકનું નામ" required />
      </div>
      <div class="row">
        <div class="field grow">
          <label>પિકઅપ તારીખ</label>
          <input id="f-date" type="date" required />
        </div>
      </div>
      <div class="field">
        <label>પિકઅપ સમય</label>
        <div id="time-mount"></div>
      </div>

      <label class="section-title" style="font-size:17px">વસ્તુઓ પસંદ કરો</label>
      <div id="items-pick"></div>

      <div id="custom-list"></div>
      <button type="button" class="btn btn-ghost btn-sm btn-block" id="add-custom"
        style="margin-bottom:12px">✏️ કસ્ટમ વસ્તુ ઉમેરો</button>

      <div class="field">
        <label>એડવાન્સ રકમ (₹)</label>
        <input id="f-advance" type="number" min="0" step="1" value="0" />
      </div>
      <div class="field">
        <label>નોંધ ${voiceSupported ? "🎤" : ""}</label>
        <textarea id="f-notes" placeholder="ખાસ સૂચના..."></textarea>
      </div>

      <div class="total-box">
        <div class="line"><span>કુલ રકમ</span><span id="t-total">₹0</span></div>
        <div class="line"><span>એડવાન્સ</span><span id="t-adv">₹0</span></div>
        <div class="line big"><span>બાકી</span><span id="t-remain">₹0</span></div>
      </div>

      <button type="submit" class="btn btn-primary btn-lg" id="save-btn">✅ ઓર્ડર સેવ કરો</button>
      <p class="error-text" id="form-err"></p>
    </form>`;

  // defaults
  container.querySelector("#f-date").value = new Date().toISOString().slice(0, 10);
  timePicker = buildTimePicker({ hour: 10, min: 0, ampm: "AM" });
  container.querySelector("#time-mount").appendChild(timePicker.element);

  // voice input on name + notes
  attachMic(container.querySelector("#f-name"));
  attachMic(container.querySelector("#f-notes"), { mode: "append" });

  // master items as checkboxes
  try { masterItems = await api.get("/items"); } catch { masterItems = []; }
  const pick = container.querySelector("#items-pick");
  if (!masterItems.length) {
    pick.innerHTML = `<p class="muted">કોઈ વસ્તુ નથી — નીચે કસ્ટમ વસ્તુ ઉમેરો.</p>`;
  }
  masterItems.forEach(it => pick.appendChild(itemPickRow(it)));

  container.querySelector("#add-custom").onclick = () => addCustomLine(container.querySelector("#custom-list"));
  container.querySelector("#f-advance").addEventListener("input", recalc);
  container.querySelector("#f-mobile").addEventListener("change", lookupCustomer);
  container.querySelector("#order-form").addEventListener("submit", submitOrder);
  recalc();
}

function itemPickRow(it) {
  const row = el(`
    <div class="item-pick" data-id="${it.id}" data-price="${it.price}">
      <input type="checkbox" class="cb" />
      <span class="ip-name">${esc(it.item_name_gujarati)}</span>
      <span class="ip-price">${money(it.price)}</span>
      <input class="ip-qty" type="number" min="1" value="1" />
    </div>`);
  const cb = row.querySelector(".cb");
  row.addEventListener("click", (e) => {
    if (e.target.classList.contains("ip-qty") || e.target === cb) return;
    cb.checked = !cb.checked; cb.dispatchEvent(new Event("change"));
  });
  cb.addEventListener("change", () => { row.classList.toggle("checked", cb.checked); recalc(); });
  row.querySelector(".ip-qty").addEventListener("input", recalc);
  return row;
}

function addCustomLine(wrap) {
  const line = el(`
    <div class="item-line" data-custom="1">
      <input class="grow ci-name" placeholder="કસ્ટમ વસ્તુ નામ" />
      <input class="qty" type="number" min="1" value="1" />
      <input class="price" type="number" min="0" placeholder="₹" />
      <button type="button" class="del">🗑</button>
    </div>`);
  line.querySelectorAll(".qty,.price,.ci-name").forEach(i => i.addEventListener("input", recalc));
  line.querySelector(".del").onclick = () => { line.remove(); recalc(); };
  wrap.appendChild(line);
  attachMic(line.querySelector(".ci-name"));
  recalc();
}

function readItems() {
  const items = [];
  // checked master items
  document.querySelectorAll(".item-pick").forEach(row => {
    if (row.querySelector(".cb").checked) {
      const qty = parseInt(row.querySelector(".ip-qty").value, 10) || 1;
      items.push({
        item_id: row.dataset.id,
        item_name: row.querySelector(".ip-name").textContent.trim(),
        quantity: qty,
        price: parseFloat(row.dataset.price) || 0,
      });
    }
  });
  // custom items
  document.querySelectorAll(".item-line[data-custom]").forEach(ln => {
    const name = ln.querySelector(".ci-name").value.trim();
    const qty = parseInt(ln.querySelector(".qty").value, 10) || 0;
    const price = parseFloat(ln.querySelector(".price").value) || 0;
    if (name && qty > 0) items.push({ item_id: null, item_name: name, quantity: qty, price });
  });
  return items;
}

function recalc() {
  const items = readItems();
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const adv = Math.min(parseFloat(document.querySelector("#f-advance").value) || 0, total);
  document.querySelector("#t-total").textContent = money(total);
  document.querySelector("#t-adv").textContent = money(adv);
  document.querySelector("#t-remain").textContent = money(Math.max(total - adv, 0));
}

async function lookupCustomer() {
  const mobile = document.querySelector("#f-mobile").value.trim();
  const banner = document.querySelector("#cust-banner");
  if (!/^[6-9]\d{9}$/.test(mobile)) { banner.innerHTML = ""; return; }
  try {
    const h = await api.get(`/customers/by-mobile/${mobile}`);
    if (h) {
      document.querySelector("#f-name").value = h.customer.name_gujarati;
      banner.innerHTML = `<div class="cust-banner">
        ✅ <b>${esc(h.customer.name_gujarati)}</b> — ${h.orders_count} જૂના ઓર્ડર
        ${h.last_order_date ? ` · છેલ્લો: ${h.last_order_date}` : ""}
        ${h.recent_items.length ? `<br>🌸 ${h.recent_items.map(esc).join("، ")}` : ""}
      </div>`;
    } else {
      banner.innerHTML = `<div class="cust-banner" style="background:#fff3e0;border-color:#ffcc80;color:#e65100">નવો ગ્રાહક — નામ ભરો</div>`;
    }
  } catch { banner.innerHTML = ""; }
}

async function submitOrder(e) {
  e.preventDefault();
  const err = document.querySelector("#form-err");
  err.textContent = "";
  const items = readItems();
  if (!items.length) { err.textContent = "ઓછામાં ઓછી એક વસ્તુ પસંદ કરો"; return; }

  const payload = {
    customer_name: document.querySelector("#f-name").value.trim(),
    customer_mobile: document.querySelector("#f-mobile").value.trim(),
    pickup_date: document.querySelector("#f-date").value,
    pickup_time: timePicker.getValue(),
    advance_amount: parseFloat(document.querySelector("#f-advance").value) || 0,
    notes: document.querySelector("#f-notes").value.trim() || null,
    items: items.map(i => ({ ...i, save_to_master: false })),
  };

  const btn = document.querySelector("#save-btn");
  btn.disabled = true; btn.textContent = "સેવ થઈ રહ્યું છે...";
  try {
    await api.post("/orders", payload);
    toast("✅ ઓર્ડર સફળતાપૂર્વક સેવ થયો", "ok");
    window.location.hash = "#queue";
  } catch (ex) {
    err.textContent = ex.message;
    btn.disabled = false; btn.textContent = "✅ ઓર્ડર સેવ કરો";
  }
}
