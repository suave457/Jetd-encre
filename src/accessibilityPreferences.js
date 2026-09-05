export const ACCESSIBILITY_DEFAULTS = Object.freeze({ textSize: "Confortable", reduceMotion: false, autoTranscript: true });
const KEYS = { textSize: "jde.a11y.textSize", reduceMotion: "jde.a11y.reduceMotion", autoTranscript: "jde.a11y.autoTranscript" };
function resolveStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}
export function normalizeAccessibilityPreferences(value = {}) {
  return {
    textSize: ["Standard", "Confortable", "Grand"].includes(value.textSize) ? value.textSize : ACCESSIBILITY_DEFAULTS.textSize,
    reduceMotion: value.reduceMotion === true,
    autoTranscript: value.autoTranscript !== false,
  };
}
export function readAccessibilityPreferences(storage) {
  try {
    const source = resolveStorage(storage);
    return normalizeAccessibilityPreferences({
      textSize: source?.getItem(KEYS.textSize),
      reduceMotion: source?.getItem(KEYS.reduceMotion) === "true",
      autoTranscript: source?.getItem(KEYS.autoTranscript) !== "false",
    });
  } catch { return { ...ACCESSIBILITY_DEFAULTS }; }
}
export function saveAccessibilityPreferences(value, storage) {
  const preferences = normalizeAccessibilityPreferences(value);
  try {
    const target = resolveStorage(storage);
    if (!target) return { ok: false, preferences };
    for (const [key, name] of Object.entries(KEYS)) target.setItem(name, String(preferences[key]));
    return { ok: true, preferences };
  } catch { return { ok: false, preferences }; }
}
export function applyAccessibilityPreferences(value, root = globalThis.document?.documentElement) {
  const preferences = normalizeAccessibilityPreferences(value);
  if (!root) return preferences;
  root.dataset.textSize = ({ Standard: "standard", Confortable: "confortable", Grand: "grand" })[preferences.textSize];
  root.dataset.reduceMotion = String(preferences.reduceMotion);
  root.dataset.autoTranscript = String(preferences.autoTranscript);
  root.style.setProperty("--jde-text-scale", ({ Standard: "1", Confortable: "1.08", Grand: "1.18" })[preferences.textSize]);
  root.ownerDocument?.defaultView?.dispatchEvent(new CustomEvent("jde:accessibility-change", { detail: preferences }));
  return preferences;
}

