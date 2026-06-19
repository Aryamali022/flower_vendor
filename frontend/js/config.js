// App configuration.
// For production, replace these values (or generate this file at build time).
export const CONFIG = {
  // FastAPI backend base URL (no trailing slash)
  API_BASE: "http://localhost:8000",

  // Supabase — used ONLY for realtime subscriptions (anon public key, safe to ship)
  SUPABASE_URL: "https://fuyblbggwisryhzgdfzu.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_nEAmUaijazfE94PH2EP7EA_WsHo_7O7",
};

// Status constants (must match backend / DB)
export const ORDER_STATUS = ["ઓર્ડર બાકી", "તૈયાર થઈ રહ્યું છે", "તૈયાર", "આપી દીધો"];
export const PAYMENT_STATUS = ["બાકી", "આંશિક ચૂકવણી", "પૂર્ણ ચૂકવણી"];

export const STATUS_CLASS = {
  "ઓર્ડર બાકી": "st-pending",
  "તૈયાર થઈ રહ્યું છે": "st-progress",
  "તૈયાર": "st-ready",
  "આપી દીધો": "st-done",
};
export const PAY_CLASS = {
  "બાકી": "pay-due",
  "આંશિક ચૂકવણી": "pay-partial",
  "પૂર્ણ ચૂકવણી": "pay-full",
};
