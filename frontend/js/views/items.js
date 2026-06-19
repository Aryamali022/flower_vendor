// Item (flower product) management.
import { api } from "../api.js";
import { el, esc, money, toast, openModal, closeModal, spinner, empty } from "../ui.js";
import { attachMic } from "../voice.js";

export async function renderItems(container) {
  container.innerHTML = `
    <div class="section-head">
      <h2 class="section-title">વસ્તુઓ</h2>
      <button class="btn btn-primary btn-sm" id="add-btn">➕ નવી</button>
    </div>
    <div class="search-bar"><input id="i-search" placeholder="🔍 વસ્તુ શોધો" /></div>
    <div id="items-list">${spinner()}</div>`;

  container.querySelector("#add-btn").onclick = () => itemForm();
  const search = container.querySelector("#i-search");
  search.addEventListener("input", () => load(container, search.value.trim()));
  await load(container);
}

async function load(container, q = "") {
  const list = container.querySelector("#items-list");
  try {
    const items = await api.get(`/items?active_only=false${q ? `&q=${encodeURIComponent(q)}` : ""}`);
    if (!items.length) { list.innerHTML = empty("🌹", "કોઈ વસ્તુ નથી"); return; }
    list.innerHTML = "";
    items.forEach(i => list.appendChild(itemRow(i, container)));
  } catch (e) { list.innerHTML = empty("⚠️", e.message); }
}

function itemRow(i, container) {
  const row = el(`
    <div class="item-row ${i.active ? "" : "inactive"}">
      <div><div class="nm">${esc(i.item_name_gujarati)}</div>
        <div class="pr">${money(i.price)}</div></div>
      <div class="row" style="gap:6px">
        <button class="btn btn-secondary btn-sm edit">✏️</button>
        <button class="btn btn-ghost btn-sm del">🗑</button>
      </div>
    </div>`);
  row.querySelector(".edit").onclick = () => itemForm(i, container);
  row.querySelector(".del").onclick = async () => {
    if (!confirm(`"${i.item_name_gujarati}" નિષ્ક્રિય કરવી છે?`)) return;
    try { await api.del(`/items/${i.id}`); toast("વસ્તુ દૂર થઈ", "ok"); load(container); }
    catch (e) { toast(e.message, "err"); }
  };
  return row;
}

function itemForm(item = null, container) {
  const isEdit = !!item;
  const body = el(`
    <div>
      <h2>${isEdit ? "વસ્તુ સંપાદિત કરો" : "નવી વસ્તુ"}</h2>
      <div class="field"><label>વસ્તુ નામ (ગુજરાતી)</label>
        <input id="it-name" value="${esc(item?.item_name_gujarati || "")}" placeholder="ગુલાબનો બુકે" /></div>
      <div class="field"><label>ભાવ (₹)</label>
        <input id="it-price" type="number" min="0" value="${item?.price ?? ""}" placeholder="250" /></div>
      ${isEdit ? `<div class="field"><label><input type="checkbox" id="it-active"
          ${item.active ? "checked" : ""}/> સક્રિય</label></div>` : ""}
      <button class="btn btn-primary btn-lg" id="it-save">સેવ કરો</button>
      <p class="error-text" id="it-err"></p>
    </div>`);
  openModal(body);
  attachMic(body.querySelector("#it-name"));

  body.querySelector("#it-save").onclick = async () => {
    const name = body.querySelector("#it-name").value.trim();
    const price = parseFloat(body.querySelector("#it-price").value);
    if (!name || isNaN(price)) { body.querySelector("#it-err").textContent = "નામ અને ભાવ ભરો"; return; }
    try {
      if (isEdit) {
        const active = body.querySelector("#it-active").checked;
        await api.put(`/items/${item.id}`, { item_name_gujarati: name, price, active });
      } else {
        await api.post("/items", { item_name_gujarati: name, price, active: true });
      }
      toast("વસ્તુ સેવ થઈ", "ok");
      closeModal();
      load(document.getElementById("view-container"));
    } catch (e) { body.querySelector("#it-err").textContent = e.message; }
  };
}
