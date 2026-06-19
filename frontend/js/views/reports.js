// Reports — daily / weekly / monthly.
import { api } from "../api.js";
import { esc, money, spinner, empty } from "../ui.js";

export async function renderReports(container) {
  container.innerHTML = `
    <h2 class="section-title">રિપોર્ટ</h2>
    <div class="filter-row" id="rp-tabs">
      <button class="btn btn-primary btn-sm" data-p="daily">આજનો</button>
      <button class="btn btn-ghost btn-sm" data-p="weekly">સાપ્તાહિક</button>
      <button class="btn btn-ghost btn-sm" data-p="monthly">માસિક</button>
    </div>
    <div id="rp-body">${spinner()}</div>`;

  const tabs = container.querySelectorAll("#rp-tabs button");
  tabs.forEach(t => t.onclick = () => {
    tabs.forEach(x => x.className = "btn btn-ghost btn-sm");
    t.className = "btn btn-primary btn-sm";
    load(t.dataset.p);
  });
  load("daily");
}

async function load(period) {
  const body = document.querySelector("#rp-body");
  body.innerHTML = spinner();
  try {
    const r = await api.get(`/reports/${period}`);
    const items = (r.most_ordered_items || []).map(m =>
      `<div class="detail-row"><span class="k">${esc(m.item)}</span>
         <span class="v">${m.quantity} નંગ</span></div>`).join("");
    body.innerHTML = `
      <p class="muted">${r.start_date} → ${r.end_date}</p>
      <div class="stat-grid">
        ${stat("કુલ ઓર્ડર", r.total_orders, "pink")}
        ${stat("પૂર્ણ", r.completed_orders, "green")}
        ${stat("બાકી", r.pending_orders, "amber")}
        ${stat("આવક", money(r.revenue), "blue")}
      </div>
      <div class="card" style="margin-top:14px">
        <div class="detail-row"><span class="k">બાકી રકમ</span>
          <span class="v" style="color:var(--red)">${money(r.pending_amount)}</span></div>
      </div>
      ${items ? `<h3 class="section-title" style="font-size:17px;margin-top:14px">સૌથી વધુ ઓર્ડર થયેલ વસ્તુઓ</h3>
        <div class="card">${items}</div>` : ""}`;
  } catch (e) { body.innerHTML = empty("⚠️", e.message); }
}

function stat(label, num, accent) {
  return `<div class="stat accent-${accent}"><div class="num" style="font-size:24px">${num}</div>
            <div class="lbl">${label}</div></div>`;
}
