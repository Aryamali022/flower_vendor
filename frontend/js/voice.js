// Voice-to-text (Gujarati: gu-IN).
//  • In the browser  -> Web Speech API (Chrome/Edge).
//  • In the Android APK -> native @capacitor-community/speech-recognition plugin
//    (the WebView itself has no Web Speech support).
import { toast } from "./ui.js";

const Cap = window.Capacitor;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const NativeSR = isNative ? Cap.Plugins?.SpeechRecognition : null;

const WebSR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const voiceSupported = isNative ? !!NativeSR : !!WebSR;

export function attachMic(inputEl, { lang = "gu-IN", mode = "replace" } = {}) {
  if (!inputEl) return;

  const wrap = document.createElement("div");
  wrap.className = "with-mic";
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mic-btn";
  btn.textContent = "🎤";
  btn.title = "બોલીને લખો";
  wrap.appendChild(btn);

  if (!voiceSupported) {
    btn.style.opacity = "0.5";
    btn.addEventListener("click", () => {
      toast("આ બ્રાઉઝર વોઇસ સપોર્ટ કરતું નથી — Chrome વાપરો", "err");
    });
    return;
  }

  const fill = (text) => {
    if (!text) return;
    if (mode === "append" && inputEl.value.trim()) inputEl.value = inputEl.value.trim() + " " + text;
    else inputEl.value = text;
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  };

  btn.addEventListener("click", () => {
    if (isNative) startNative(btn, lang, fill);
    else startWeb(btn, lang, fill);
  });
}

// ---------------- native (Android APK) ----------------
async function startNative(btn, lang, fill) {
  try {
    const perm = await NativeSR.checkPermissions();
    if (perm.speechRecognition !== "granted") {
      const req = await NativeSR.requestPermissions();
      if (req.speechRecognition !== "granted") {
        toast("માઇક પરવાનગી જરૂરી છે 🎤", "err");
        return;
      }
    }
    btn.classList.add("listening");
    toast("🎤 બોલો...", "");
    const { matches } = await NativeSR.start({
      language: lang, maxResults: 1, partialResults: false, popup: false,
    });
    fill(matches && matches[0] ? matches[0].trim() : "");
  } catch (e) {
    console.error("[voice native]", e);
    toast("અવાજ સમજાયો નહીં — ફરી પ્રયત્ન કરો", "err");
  } finally {
    btn.classList.remove("listening");
  }
}

// ---------------- web (browser) ----------------
function startWeb(btn, lang, fill) {
  const recognition = new WebSR();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  btn.classList.add("listening");
  toast("🎤 બોલો...", "");
  let gotResult = false, errored = false;

  recognition.onresult = (e) => { gotResult = true; fill(e.results[0][0].transcript.trim()); };
  recognition.onerror = (e) => {
    errored = true;
    const messages = {
      "not-allowed": "માઇક પરવાનગી નથી — બ્રાઉઝરમાં માઇક Allow કરો 🎤",
      "service-not-allowed": "માઇક પરવાનગી નથી — Allow કરો 🎤",
      "no-speech": "અવાજ સંભળાયો નહીં — ફરી બોલો",
      "audio-capture": "માઇક મળ્યું નથી",
      "network": "ઇન્ટરનેટ જરૂરી છે",
      "aborted": "",
    };
    const msg = messages[e.error] ?? `વોઇસ ભૂલ: ${e.error}`;
    if (msg) toast(msg, "err");
  };
  recognition.onend = () => {
    btn.classList.remove("listening");
    if (!gotResult && !errored) toast("અવાજ સમજાયો નહીં — ગુજરાતી માટે Chrome વાપરો", "err");
  };
  try { recognition.start(); } catch { btn.classList.remove("listening"); }
}
