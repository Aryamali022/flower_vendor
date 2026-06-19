// Supabase Realtime — subscribe to order changes so every device updates live.
import { CONFIG } from "./config.js";

let client = null;
let channel = null;

function getClient() {
  if (client) return client;
  if (!window.supabase || CONFIG.SUPABASE_URL.includes("YOUR-PROJECT")) {
    console.warn("Supabase not configured — realtime disabled, using polling fallback.");
    return null;
  }
  client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}

// onChange() is called (debounced) whenever orders or order_items change.
export function subscribeOrders(onChange) {
  const c = getClient();
  if (!c) {
    // Fallback: poll every 15s if realtime isn't configured.
    const id = setInterval(onChange, 15000);
    return () => clearInterval(id);
  }

  let debounce;
  const trigger = () => { clearTimeout(debounce); debounce = setTimeout(onChange, 250); };

  channel = c.channel("orders-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, trigger)
    .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, trigger)
    .subscribe();

  return () => { if (channel) c.removeChannel(channel); channel = null; };
}
