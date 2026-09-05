import { useEffect, useState } from "react";
import { readAccessibilityPreferences } from "../../accessibilityPreferences.js";

export function useTranscriptPreference() {
  const [open, setOpen] = useState(() => readAccessibilityPreferences().autoTranscript);
  useEffect(() => {
    const update = (event) => setOpen(event.detail?.autoTranscript !== false);
    window.addEventListener("jde:accessibility-change", update);
    return () => window.removeEventListener("jde:accessibility-change", update);
  }, []);
  return { open, onToggle: (event) => setOpen(event.currentTarget.open) };
}
